/**
 * Ported (as exactly as TypeScript allows) from
 * CMNT-Notation-Studio-source/src/cmnt/core/CmntParser.java.
 */
import { Fraction } from "../model/Fraction.js";
import { Gati } from "../model/Gati.js";
import { Swara } from "../model/Swara.js";
import { Song } from "../model/Song.js";
import { SongBlock, Notation } from "../model/SongBlock.js";
import { Heading } from "../model/Heading.js";
import { SongBreak, PageBreak, GatiSwitch } from "../model/Breaks.js";
import { Tala } from "../model/Tala.js";
import type { SongPart } from "../model/SongPart.js";
import * as Talas from "./Talas.js";
import * as Ragas from "./Ragas.js";
import * as YamlFrontMatter from "./YamlFrontMatter.js";

export class ParseException extends Error {
  public readonly line: number;
  constructor(message: string, line: number) {
    super(line > 0 ? `line ${line}: ${message}` : message);
    this.name = "ParseException";
    this.line = line;
  }
}

// (['`]?) octave marker, (\*?) emphasis marker, then an optional gamaka
// symbol (^, //, /, \\, \, ~~, ~, =, or a parenthesized free-form tag), then
// trailing phrase-end hyphens.
const SWARA_RE = /^([srgmpdn][ai]?)(['`]?)(\*?)(?:(\^|\/\/|\/|\\\\|\\|~~|~|=|\([^)]*\)))?(-*)/i;

const HEADING_RE = /^Heading:\s*"([^"]*)"(.*)$/i;
const LABEL_RE = /^"([^"]*)"$/;
const GATI_BEGIN_RE = /^<\/?GTB(?::([A-Za-z]+))?>$/i;
const GATI_END_RE = /^<\/?GTE>$/i;
const CLUSTER_END_RE = /^\}\(([A-Za-z0-9]+)\)$/;

const NAMED_COLORS = new Set([
  "black",
  "white",
  "red",
  "green",
  "blue",
  "yellow",
  "orange",
  "purple",
  "gray",
  "grey",
  "brown",
  "cyan",
  "magenta",
]);

const GATI_NAMES: Record<string, number> = {
  catusra: Gati.CATUSRA,
  tisra: Gati.TISRA,
  khanda: Gati.KHANDA,
  misra: Gati.MISRA,
  sankirna: Gati.SANKIRNA,
};

const SWARA_LABELS = new Set(["sa", "ri", "ga", "ma", "pa", "da", "ni"]);
const LANGUAGES = new Set(["english", "tamil", "kannada", "telugu", "sanskrit"]);

class Prefs {
  color: string | null = null;
  fontSize: string;
  fontName: string | null = null;
  bold = false;
  constructor(fontSize: string) {
    this.fontSize = fontSize;
  }
}

class SwaraResult {
  swara: Swara | null = null;
  error: string | null = null;
  ignore = false;
}

function isRgb(spec: string): boolean {
  return /^rgb\s*\(/i.test(spec);
}

function parseRgb(spec: string): string | null {
  const m = /rgb\s*\(\s*([0-9.]+)\s*[,.]\s*([0-9.]+)\s*[,.]\s*([0-9.]+)\s*\)/i.exec(spec);
  if (!m) return null;
  return `rgb(${m[1]},${m[2]},${m[3]})`;
}

/** Mirrors Java's Integer.parseInt: optional sign, digits only (leading zeros
 *  allowed), no other formats accepted. Returns -1 on parse failure (matching
 *  every call site here, which all catch NumberFormatException and use -1). */
function parseJavaInt(v: string): number {
  if (!/^[+-]?\d+$/.test(v)) return -1;
  return parseInt(v, 10);
}

class Parser {
  private defSpeed: number | null = null;
  private defTalaName: string | null = null;
  // Ragam/Talam are shown as one combined heading line once both are known; whichever
  // of Raagam:/Melakarta: or Tala: is seen second patches the heading the first one
  // already created, so either order in the file produces the same combined line.
  private ragamTalamHeading: Heading | null = null;
  private pendingRagamClause: string | null = null;
  private pendingTalamClause: string | null = null;
  private pendingAroAvaText: string | null = null;
  private talaIsPlaceholder = false; // song was lazily created before a real Tala: was seen
  private layout: string | null = null;
  private compact = true;
  private portrait = true;
  private phraseEndsStyle = "show";
  private curLang = "english";
  private song: Song | null = null;
  private swaras: Swara[] = [];
  private lyrics: string[][] = [];
  private lastSwaraLineCount = 0;
  private lyricLineIndex = 0;
  private curNotationHeading: string | null = null;
  private headingPrefs = new Prefs("12");
  private swaraPrefs = new Prefs("10");
  private lyricPrefs = new Prefs("10");
  private gamakaPrefs = new Prefs("7");
  private curGati: number = Gati.CATUSRA;
  private inlineGati: number | null = null;
  private inlineRegionDur: Fraction = Fraction.ZERO;
  private notationPos: Fraction = Fraction.ZERO;
  private clusterStartIndex = -1; // index into `swaras` where an open {..} gamaka cluster began, or -1

  private isGitamLayout(): boolean {
    return (this.layout ?? "").toLowerCase() === "gitam";
  }

  private commitBlock(): void {
    if (this.swaras.length === 0 || this.song === null) {
      this.swaras = [];
      this.lyrics = [];
      return;
    }
    const song = this.song;
    const block = new SongBlock();
    block.heading = this.curNotationHeading;
    block.language = this.curLang;
    block.swaraFontSize = this.swaraPrefs.fontSize;
    block.lyricFontSize = this.lyricPrefs.fontSize;
    block.swaraColor = this.swaraPrefs.color;
    block.lyricColor = this.lyricPrefs.color;
    block.swaraFont = this.swaraPrefs.fontName;
    block.lyricFont = this.lyricPrefs.fontName;
    block.swaraBold = this.swaraPrefs.bold;
    block.lyricBold = this.lyricPrefs.bold;
    block.gamakaFontSize = this.gamakaPrefs.fontSize;
    block.gamakaColor = this.gamakaPrefs.color;
    block.nLyricLines = this.lyrics.length;
    this.curNotationHeading = null;

    const notations: Notation[] = [];
    for (const sw of this.swaras) notations.push(block.addSwara(sw));

    for (let j = 0; j < this.lyrics.length; j++) {
      const ll = this.lyrics[j]!;
      let lyricIdx = 0;
      for (const n of notations) {
        if (n.swara.label === "|" || n.swara.label === "||") continue;
        if (lyricIdx < ll.length) n.lyrics[j] = ll[lyricIdx]!;
        lyricIdx++;
      }
    }
    song.add(block);
    this.swaras = [];
    this.lyrics = [];
  }

  /** Builds or patches the single combined "Ragam : X (mel)     Talam : Y (angas)"
   *  heading line, plus an Aro/Ava line beneath it when raga info is available.
   *  Called from both the Tala: and Raagam:/Melakarta: handlers, whichever runs
   *  second fills in what the first one didn't have yet -- so either order in the
   *  file produces the same combined heading. */
  private updateRagamTalamHeading(lineNo: number): void {
    if (this.pendingRagamClause === null && this.pendingTalamClause === null) return;
    this.ensureSong(lineNo);
    const song = this.song!;
    let text = "";
    if (this.pendingRagamClause !== null) text += this.pendingRagamClause;
    if (this.pendingTalamClause !== null) {
      if (text.length > 0) text += " | ";
      text += this.pendingTalamClause;
    }
    if (this.pendingAroAvaText !== null) text += "\n" + this.pendingAroAvaText;
    if (this.ragamTalamHeading === null) {
      const h = new Heading(text);
      h.bold = true;
      h.alignment = "center";
      h.fontSize = this.headingPrefs.fontSize;
      h.language = this.curLang;
      h.role = "ragamTalam";
      this.ragamTalamHeading = h;
      song.add(h);
    } else {
      this.ragamTalamHeading.text = text;
      this.ragamTalamHeading.language = this.curLang;
      this.ragamTalamHeading.role = "ragamTalam";
    }
  }

  private ensureSong(lineNo: number): Song {
    if (this.defSpeed === null) this.defSpeed = this.layout === "gitam" ? 0 : 1;
    if (this.song === null) {
      const talaNameToUse = this.defTalaName !== null ? this.defTalaName : "Adi";
      const tala = Talas.fromPredefinedName(talaNameToUse, this.layout);
      if (tala === null) throw new ParseException("invalid tala specification", lineNo);
      this.talaIsPlaceholder = this.defTalaName === null;
      const song = new Song(tala);
      // defaultSpeed stays the raw, user-facing value (what they typed, for UI
      // display); effectiveDefaultSpeed is the layout-shifted value actually used
      // for duration/speedLines calculations (see the S: line handling below).
      song.defaultSpeed = this.defSpeed;
      song.effectiveDefaultSpeed = this.isGitamLayout() ? this.defSpeed : this.defSpeed + 2;
      song.phraseEndsStyle = this.phraseEndsStyle;
      song.compact = this.compact;
      song.portrait = this.portrait;
      song.layoutName = this.layout == null ? "krithi" : this.layout;
      song.language = this.curLang;
      song.add(tala);
      this.curGati = tala.primaryGati();
      this.song = song;
    }
    return this.song;
  }

  private parseSwaraToken(tok: string, speed: number, talaName: string): SwaraResult {
    const r = new SwaraResult();
    const s = tok;
    if (s === "|" || s === "||") {
      if (talaName.toLowerCase() !== "manual") {
        r.ignore = true;
        return r;
      }
      r.swara = new Swara(s, false, 0, 0, 0, null, 0);
      r.ignore = true;
      return r;
    }
    if (s === "," || s === "-" || s === "--" || s === ",-") {
      r.swara = new Swara(s, true, 0, 1, speed, null, 0);
      return r;
    }
    if (s === "=") {
      r.swara = new Swara("..", false, 0, 1, 0, null, 0);
      return r;
    }
    if (s === ";" || s === ";-") {
      r.swara = new Swara(s, true, 0, 2, speed, null, 0);
      return r;
    }
    if (s === "_") {
      r.swara = new Swara("_", false, 0, 1, speed, null, 0);
      return r;
    }
    if (s === "__") {
      r.swara = new Swara("__", false, 0, 2, speed, null, 0);
      return r;
    }

    let m = SWARA_RE.exec(s);
    const full = m !== null && m[0].length === s.length;
    if (!full) {
      if (m === null) {
        r.error = `invalid swara: '${s}'`;
        return r;
      }
      const rest = s.slice(m[0].length);
      if (rest.length > 0 && !/^[,]+$/.test(rest)) {
        r.error = `invalid swara: '${s}'`;
        return r;
      }
    }
    let label = m![1]!;
    let length = 1;
    if (label.length === 2) {
      const lc = label.toLowerCase();
      if (!SWARA_LABELS.has(lc)) {
        r.error = `invalid swara: '${label}'`;
        return r;
      }
      length = 2;
    }

    let octave = 0;
    if (m![2] === "'") octave = 1;
    else if (m![2] === "`") octave = -1;
    if (m![3] === "*") label += "*";

    let gamaka: string | null = null;
    const g = m![4];
    if (g !== undefined && g.length > 0) {
      if (/^\([^)]*\)$/.test(g)) gamaka = g.slice(1, -1);
      else gamaka = g;
    }
    const hyphens = m![5] === undefined ? 0 : m![5].length;
    if (hyphens > 0) label += "-";

    r.swara = new Swara(label, false, octave, length, speed, gamaka, hyphens);
    return r;
  }

  doParse(text: string): Song {
    text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const rawLines = text.split("\n");
    const lines: string[] = [...rawLines];
    lines.push("END");

    for (let i = 0; i < lines.length; i++) {
      const lineNo = i + 1;
      const raw = lines[i]!;
      const line = raw.trim();
      if (line === "") continue;

      const isEndSentinel = line === "END" && lineNo === lines.length;

      // ---- preamble directives ----
      if (this.defTalaName === null) {
        const m = /^Tala:\s*(.*)$/i.exec(line);
        if (m) {
          const name = m[1]!.trim();
          const tala = Talas.fromPredefinedName(name, this.layout);
          if (tala === null) throw new ParseException("invalid tala specification", lineNo);
          this.defTalaName = name;
          if (this.talaIsPlaceholder && this.song !== null) {
            // A directive earlier in the file (Melakarta:/Raagam:/Language:/etc.)
            // already created the song with a placeholder tala -- swap in the
            // real one now that we have it, instead of erroring over ordering.
            this.song.tala = tala;
            for (let pi = 0; pi < this.song.parts.length; pi++) {
              if (this.song.parts[pi] instanceof Tala) {
                this.song.parts[pi] = tala;
                break;
              }
            }
            this.curGati = tala.primaryGati();
            this.talaIsPlaceholder = false;
          }
          const angas = Talas.angaBreakdown(tala);
          this.pendingTalamClause = `Talam : ${tala.name}${angas !== null ? ` (${angas})` : ""}`;
          this.updateRagamTalamHeading(lineNo);
          continue;
        }
      }
      {
        const m = /^DefaultSpeed:\s*([012])\s*$/i.exec(line);
        if (m) {
          this.defSpeed = parseInt(m[1]!, 10);
          if (this.song !== null) {
            // Some earlier directive (Melakarta:/Raagam:/Language:/etc.) already
            // triggered lazy song creation before this explicit DefaultSpeed: was
            // seen, using a fallback value -- correct it now rather than silently
            // dropping the user's actual DefaultSpeed:.
            this.song.defaultSpeed = this.defSpeed;
            this.song.effectiveDefaultSpeed = this.isGitamLayout() ? this.defSpeed : this.defSpeed + 2;
          }
          continue;
        }
      }
      {
        const m = /^SpeedMarks:\s*(.*)$/i.exec(line);
        if (this.song === null && m) continue; // accepted, not used in MVP rendering
      }
      {
        const pe = /^PhraseEnds:\s*(.*)$/i.exec(line);
        if (pe && this.swaras.length === 0) {
          const parts = pe[1]!.trim().split(",");
          const style = parts[0]!.trim().toLowerCase();
          if (!(style === "show" || style === "hide" || style === "handle" || style === "handlethick")) {
            throw new ParseException(`invalid phrase ends specification: ${style}`, lineNo);
          }
          this.phraseEndsStyle = style;
          if (this.song !== null) (this.song as Song).phraseEndsStyle = style;
          continue;
        }
      }
      if (this.song === null && this.swaras.length === 0) {
        let m = /^Orientation:\s*(.*)$/i.exec(line);
        if (m) {
          const s = m[1]!.trim().toLowerCase();
          if (s === "portrait") this.portrait = true;
          else if (s === "landscape") this.portrait = false;
          else throw new ParseException(`invalid orientation specification: ${s}`, lineNo);
          continue;
        }
        m = /^Layout:\s*(.*)$/i.exec(line);
        if (m) {
          if (this.defTalaName !== null) throw new ParseException("layout must appear before tala", lineNo);
          const s = m[1]!.trim().toLowerCase();
          for (let part of s.split(",")) {
            part = part.trim();
            if (part === "kriti" || part === "krithi") this.layout = "krithi";
            else if (part === "geetam" || part === "gitam") this.layout = "gitam";
            else if (part === "varnam") this.layout = "varnam";
            else if (part === "fullwidth") this.compact = false;
            else if (part === "compact") this.compact = true;
          }
          continue;
        }
      }

      let keyval: string | null = null;
      let key: string | null = null;
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const akey = line.slice(0, colonIdx).trim();
        keyval = line.slice(colonIdx + 1).trim();
        key = akey.toLowerCase();
      } else if (
        line.toLowerCase() === "songbreak" ||
        line.toLowerCase() === "pagebreak" ||
        line.toLowerCase() === "end"
      ) {
        key = line.toLowerCase();
      }

      let isHeading = false;
      let headingMatch: RegExpExecArray | null = null;
      let isLang = false;
      let langMatch: RegExpExecArray | null = null;
      let putSwaras = false;

      if (isEndSentinel) {
        putSwaras = true;
      } else {
        const low = line.toLowerCase();
        if (low === "songbreak" || low === "pagebreak" || low === "end") {
          putSwaras = true;
        } else {
          headingMatch = HEADING_RE.exec(line);
          if (headingMatch && headingMatch.index === 0) {
            isHeading = true;
            putSwaras = true;
          } else {
            langMatch = /^Language:\s*([^\s].*)$/i.exec(line);
            if (langMatch) {
              isLang = true;
              putSwaras = true;
            } else if (key !== "l") {
              putSwaras = true;
            }
          }
        }
      }

      this.ensureSong(lineNo);
      const song = this.song!;

      if (putSwaras) {
        this.commitBlock();
        if (isEndSentinel) break;
        const low = line.toLowerCase();
        if (low === "songbreak") {
          song.add(new SongBreak());
          continue;
        }
        if (low === "pagebreak") {
          song.add(new PageBreak());
          continue;
        }
        if (low === "end") continue;
      }

      if (isHeading) {
        const txt = headingMatch![1]!;
        const rest = headingMatch![2] ?? "";
        const split = rest.split(",");
        let fontName: string | null = null;
        let fontSize = this.headingPrefs.fontSize;
        let color = this.headingPrefs.color;
        let bold = false;
        let italic = false;
        let tight = false;
        let alignment = "left";
        let lang = this.curLang;
        for (let k = 1; k < split.length; k++) {
          const p = split[k]!.trim();
          if (p === "") continue;
          if (/^[1-9][0-9]*$/.test(p)) {
            fontSize = p;
            continue;
          }
          const sl = p.toLowerCase();
          if (sl === "bold") bold = true;
          else if (sl === "italic") italic = true;
          else if (sl === "tight") tight = true;
          else if (sl === "left" || sl === "right" || sl === "center") alignment = sl;
          else if (isRgb(p)) color = parseRgb(p);
          else if (NAMED_COLORS.has(sl)) color = p;
          else {
            const base = sl.split(":")[0]!;
            if (LANGUAGES.has(base)) lang = sl;
            else if (fontName === null && p !== "") fontName = p;
          }
        }
        const h = new Heading(txt);
        h.font = fontName;
        h.fontSize = fontSize;
        h.alignment = alignment;
        h.color = color;
        h.bold = bold;
        h.italic = italic;
        h.language = lang;
        h.tightAbove = tight;
        song.add(h);
        continue;
      }

      if (isLang) {
        const s = langMatch![1]!.trim().toLowerCase();
        const base = s.split(":")[0]!;
        if (!LANGUAGES.has(base)) {
          throw new ParseException(`invalid language '${s}'`, lineNo);
        }
        this.curLang = s;
        song.language = base;
        // Raagam:/Tala: often appear before Language: (YAML emits them that way
        // historically; classic files do too). Retag the combined heading so it
        // follows the score language instead of staying stuck on english.
        if (this.ragamTalamHeading !== null) {
          this.ragamTalamHeading.language = s;
        }
        continue;
      }

      if (key === "s" || key === "l") {
        const tokens = line.split(/\s+/);
        if (key === "s") {
          if (this.talaIsPlaceholder) {
            throw new ParseException(
              "this S: line needs a Tala: directive, but none has been given yet -- " +
                'add a line like "Tala: Adi" earlier in the file (typically right after the title/' +
                "composer headings, before any S:/L: notation)",
              lineNo,
            );
          }
          // Sarali varisai/Geetham-tier notation (Layout: Gitam) uses
          // DefaultSpeed 0/1/2 meaning 1/2/4 notes per akshara. Swarajathi/
          // Varnam/Krithi-tier notation (everything else, including no Layout:
          // at all) uses the same 0/1/2 numbering for 1st/2nd/3rd speed, but it
          // means 4/8/16 notes per akshara -- two octaves denser. Applying that
          // shift once here (rather than changing the duration formula itself)
          // means inline ( )/(( )) speed changes compound correctly on top of it.
          let baseSpeed = this.defSpeed !== null ? this.defSpeed : 1;
          if (!this.isGitamLayout()) baseSpeed += 2;
          let speed = baseSpeed;
          this.lastSwaraLineCount = 0;
          this.lyricLineIndex = 0;
          let start = 1;
          this.curNotationHeading = null;
          if (start < tokens.length) {
            const lm = LABEL_RE.exec(tokens[start]!);
            if (lm) {
              this.curNotationHeading = lm[1]!;
              start++;
            }
          }
          const talaName = song.tala.name;
          for (let ti = start; ti < tokens.length; ti++) {
            const tok = tokens[ti]!;
            if (tok === "") continue;
            if (tok === "(") {
              speed++;
              continue;
            }
            if (tok === ")") {
              if (speed === baseSpeed) throw new ParseException("paren mismatch", lineNo);
              speed--;
              continue;
            }
            if (tok === "{") {
              if (this.clusterStartIndex !== -1) {
                throw new ParseException("nested gamaka cluster { } is not supported", lineNo);
              }
              this.clusterStartIndex = this.swaras.length;
              continue;
            }
            const clusterEnd = CLUSTER_END_RE.exec(tok);
            if (clusterEnd) {
              if (this.clusterStartIndex === -1) {
                throw new ParseException(`'${tok}' without a matching '{'`, lineNo);
              }
              if (this.clusterStartIndex >= this.swaras.length) {
                throw new ParseException("empty gamaka cluster { }", lineNo);
              }
              const tag = clusterEnd[1]!;
              for (let ci = this.clusterStartIndex; ci < this.swaras.length; ci++) {
                this.swaras[ci]!.clusterGamaka = tag;
              }
              this.swaras[this.clusterStartIndex]!.clusterStart = true;
              this.swaras[this.swaras.length - 1]!.clusterEnd = true;
              this.clusterStartIndex = -1;
              continue;
            }
            const gb = GATI_BEGIN_RE.exec(tok);
            if (gb) {
              const gname = (gb[1] === undefined ? "tisra" : gb[1]).toLowerCase();
              if (!(gname in GATI_NAMES)) throw new ParseException(`invalid inline gati '${gname}'`, lineNo);
              if (this.inlineGati !== null) throw new ParseException("nested inline gati region", lineNo);
              if (!this.notationPos.isWhole()) {
                throw new ParseException("inline gati begin must start on akshara boundary", lineNo);
              }
              this.inlineGati = GATI_NAMES[gname]!;
              this.inlineRegionDur = Fraction.ZERO;
              continue;
            }
            if (GATI_END_RE.test(tok)) {
              if (this.inlineGati === null) throw new ParseException("<GTE> without matching <GTB>", lineNo);
              if (!this.inlineRegionDur.isWhole()) {
                throw new ParseException("inline gati region must fill whole aksharas", lineNo);
              }
              this.inlineGati = null;
              this.inlineRegionDur = Fraction.ZERO;
              continue;
            }
            const sr = this.parseSwaraToken(tok, speed, talaName);
            if (sr.error !== null) throw new ParseException(sr.error, lineNo);
            if (sr.swara === null) continue;
            const sw = sr.swara;
            if (this.inlineGati !== null) sw.gatiOverride = this.inlineGati;
            const effGati = sw.gatiOverride !== null ? sw.gatiOverride : this.curGati;
            const dur = sw.duration(effGati);
            this.notationPos = this.notationPos.add(dur);
            if (this.inlineGati !== null) this.inlineRegionDur = this.inlineRegionDur.add(dur);
            this.swaras.push(sw);
            if (!sr.ignore) this.lastSwaraLineCount++;
          }
          if (this.clusterStartIndex !== -1) {
            this.clusterStartIndex = -1;
            throw new ParseException("unclosed gamaka cluster (missing '}(tag)')", lineNo);
          }
        } else {
          // lyric
          while (this.lyrics.length <= this.lyricLineIndex) this.lyrics.push([]);
          const lyricLine = this.lyrics[this.lyricLineIndex]!;
          let nLyrics = 0;
          for (let ti = 1; ti < tokens.length; ti++) {
            let tok = tokens[ti]!;
            if (tok === "") continue;
            if (tok === "_" || tok === "''" || tok === "' '" || tok === '""' || tok === '" "') tok = " ";
            lyricLine.push(tok);
            nLyrics++;
          }
          if (nLyrics !== this.lastSwaraLineCount) {
            throw new ParseException(
              `lyric line does not match swara line - has ${nLyrics} lyrics - expected ${this.lastSwaraLineCount}`,
              lineNo,
            );
          }
          this.lyricLineIndex++;
        }
        continue;
      }

      if (key === "gati") {
        const gname = (keyval ?? "").trim().toLowerCase();
        if (!(gname in GATI_NAMES)) throw new ParseException(`invalid gati '${keyval}'`, lineNo);
        if (!song.tala.gatiSwitchable) throw new ParseException("Cannot switch gatis with this tala", lineNo);
        if (this.inlineGati !== null) throw new ParseException("Gati: inside an open inline region", lineNo);
        this.curGati = GATI_NAMES[gname]!;
        song.add(new GatiSwitch(this.curGati));
        continue;
      }

      if (key === "melakarta") {
        const v = (keyval ?? "").trim();
        const n = parseJavaInt(v);
        if (n < 1 || n > 72) {
          throw new ParseException(`invalid Melakarta number '${keyval}' (must be 1-72)`, lineNo);
        }
        if (song.ragaName !== null && song.melakarta !== null && song.melakarta !== n) {
          throw new ParseException(
            `Melakarta: ${n} contradicts the earlier Raagam: ${song.ragaName}, which belongs to Melakarta ${song.melakarta} -- remove one or fix the mismatch`,
            lineNo,
          );
        }
        song.melakarta = n;
        continue;
      }

      if (key === "cyclesperrow") {
        const v = (keyval ?? "").trim();
        const n = parseJavaInt(v);
        if (n < 1 || n > 8) {
          throw new ParseException(`invalid CyclesPerRow value '${keyval}' (must be 1-8)`, lineNo);
        }
        song.cyclesPerRow = n;
        continue;
      }

      if (key === "rowspacing") {
        const v = (keyval ?? "").trim();
        const n = Number.parseFloat(v);
        if (!Number.isFinite(n) || n < 0.3 || n > 3.0) {
          throw new ParseException(`invalid RowSpacing value '${keyval}' (must be 0.3-3.0)`, lineNo);
        }
        song.rowSpacing = n;
        continue;
      }

      if (key === "cellspacing") {
        const v = (keyval ?? "").trim();
        const n = Number.parseFloat(v);
        if (!Number.isFinite(n) || n < 0.1 || n > 3.0) {
          throw new ParseException(`invalid CellSpacing value '${keyval}' (must be 0.1-3.0)`, lineNo);
        }
        song.cellSpacing = n;
        continue;
      }

      if (key === "raagam" || key === "ragam") {
        const name = (keyval ?? "").trim();
        song.ragaName = name;
        const number = Ragas.melakartaNumberForName(name);
        const dwija = number === null ? Ragas.dwijaForName(name) : null;
        const janya = number === null && dwija === null ? Ragas.janyaForName(name) : null;
        const resolvedMelakarta = number !== null ? number : dwija !== null ? dwija.melakarta : janya !== null ? janya.melakarta : null;
        // If a Melakarta: directive already set a different number, this Raagam:
        // contradicts it -- flag it clearly rather than silently picking one.
        if (resolvedMelakarta !== null && song.melakarta !== null && song.melakarta !== resolvedMelakarta) {
          throw new ParseException(
            `Raagam: ${name} belongs to Melakarta ${resolvedMelakarta} (${Ragas.melakartaName(resolvedMelakarta)}), but Melakarta: ${song.melakarta} was already set -- remove one or fix the mismatch`,
            lineNo,
          );
        }
        let displayName: string;
        if (number !== null) {
          song.melakarta = number;
          displayName = Ragas.melakartaName(number);
          this.pendingAroAvaText = Ragas.melakartaAroAva(number);
        } else if (dwija !== null) {
          // Dwi-madhyama (both M1 and M2) scale -- playback can only use one
          // fixed madhyama per song for now, so this sets the parent melakarta
          // (M1's pitch is what Play uses); the *displayed* Aro/Ava correctly
          // shows both madhyamas either way.
          song.melakarta = dwija.melakarta;
          displayName = dwija.name;
          this.pendingAroAvaText = Ragas.dwijaAroAva(dwija);
        } else if (janya !== null) {
          song.melakarta = janya.melakarta;
          displayName = janya.name;
          this.pendingAroAvaText = Ragas.janyaAroAva(janya);
        } else {
          // Not recognized (name not in the melakarta, dwi-madhyama, or bundled
          // janya table) -- still show the name; playback falls back to the
          // standard major-scale variants until an Aro/Ava spec or a recognized
          // Melakarta:/Raagam: name says otherwise.
          displayName = name;
        }
        this.pendingRagamClause = `Ragam : ${displayName}${resolvedMelakarta !== null ? ` (${resolvedMelakarta})` : ""}`;
        this.updateRagamTalamHeading(lineNo);
        continue;
      }

      if (key === "swaraprefs" || key === "lyricprefs" || key === "headingprefs" || key === "gamakaprefs") {
        const split = (keyval ?? "").split(",");
        let fontSize: string | null = null;
        let color: string | null = null;
        let fontName: string | null = null;
        let bold = false;
        for (const sRaw of split) {
          const s0 = sRaw.trim();
          if (s0 === "") continue;
          if (/^[1-9][0-9]*$/.test(s0)) fontSize = s0;
          else if (s0.toLowerCase() === "bold") bold = true;
          else if (isRgb(s0)) color = parseRgb(s0);
          else if (NAMED_COLORS.has(s0.toLowerCase())) color = s0;
          else fontName = s0;
        }
        const prefs =
          key === "swaraprefs"
            ? this.swaraPrefs
            : key === "lyricprefs"
              ? this.lyricPrefs
              : key === "headingprefs"
                ? this.headingPrefs
                : this.gamakaPrefs;
        if (fontSize !== null) prefs.fontSize = fontSize;
        if (color !== null) prefs.color = color;
        if (fontName !== null) prefs.fontName = fontName;
        if (bold) prefs.bold = true;
        continue;
      }

      // languagefont / languageprefs / mid-song tala: accepted but ignored in MVP
    }

    if (this.song === null) throw new ParseException("empty or incomplete song (missing tala/content)", 0);
    if (this.inlineGati !== null) throw new ParseException("unclosed inline gati region (missing <GTE>)", 0);

    const song = this.song;
    for (const p of song.parts as SongPart[]) {
      if (p instanceof Heading && p.text.trim() !== "") {
        song.title = p.text;
        break;
      }
    }
    return song;
  }
}

export function parse(text: string): Song {
  let preprocessed: string;
  try {
    preprocessed = YamlFrontMatter.preprocess(text);
  } catch (e) {
    if (e instanceof YamlFrontMatter.YamlFrontMatterError) throw new ParseException(e.message, 0);
    throw e;
  }
  return new Parser().doParse(preprocessed);
}
