/**
 * Ported (as exactly as TypeScript allows) from
 * CMNT-Notation-Studio-source/src/cmnt/core/Layout.java.
 */
import { Fraction } from "../model/Fraction.js";
import { gatiLabel } from "../model/Gati.js";
import { Swara } from "../model/Swara.js";
import { Song } from "../model/Song.js";
import { SongBlock } from "../model/SongBlock.js";
import { Heading } from "../model/Heading.js";
import { SongBreak, PageBreak, GatiSwitch } from "../model/Breaks.js";
import { Tala } from "../model/Tala.js";
import { applyCyclesPerRow } from "./AdaptiveLayout.js";

export type CellKind = "swara" | "marker" | "gap" | "gati";

export class Cell {
  kind: CellKind = "swara";
  text = "";
  lyrics: string[] = [];
  speed = 0;
  defaultSpeed = 1;
  gamaka: string | null = null;
  octave = 0;
  phraseEnd = false;
  isRest = false;
  isSustain = false;
  clusterGamaka: string | null = null;
  clusterStart = false;
  clusterEnd = false;
  /**
   * Parallel to lyrics: whether each lyric line's syllable here starts a new word
   * (used only for Tamil's dental/alveolar na distinction).
   */
  lyricWordStart: boolean[] = [];
  phraseHyphens = 0;
  gatiOverride: number | null = null;
  width = 1.0;
  duration: Fraction = Fraction.ONE;

  speedLines(): number {
    if (this.kind !== "swara") return 0;
    return Math.max(0, this.speed - this.defaultSpeed);
  }
}

export class VisualRow {
  cells: Cell[] = [];
  blockHeading: string | null = null;
  language = "english";
  font: string | null = null;
  swaraFontSize: string | null = null;
  lyricFontSize: string | null = null;
  swaraColor: string | null = null;
  lyricColor: string | null = null;
  swaraFont: string | null = null;
  lyricFont: string | null = null;
  swaraBold = false;
  lyricBold = false;
  gamakaFontSize: string | null = null;
  gamakaColor: string | null = null;
  rowSpacing = 1.0;
  cellSpacing = 1.0;
}

export class VisualHeading {
  constructor(public heading: Heading) {}
}
export class VisualBreak {}
export class VisualPageBreak {}

/** Discriminated union of everything layoutSong can emit; consumers should
 *  instanceof-check against VisualRow / VisualHeading / VisualBreak / VisualPageBreak. */
export type LayoutItem = VisualRow | VisualHeading | VisualBreak | VisualPageBreak;

function cyclePos(pos: Fraction, aksharas: number): Fraction {
  if (aksharas <= 0) return pos;
  if (pos.compareTo(Fraction.ZERO) < 0) return pos;
  return pos.mod(aksharas);
}

export function gatiAt(tala: Tala, absPos: Fraction): number {
  if (tala.parts.length === 0) return tala.primaryGati();
  const cp = cyclePos(absPos, tala.aksharaCount);
  let best = tala.parts[0]!;
  for (const p of tala.parts) {
    if (Fraction.of(p.index).lte(cp)) best = p;
  }
  for (const p of tala.parts) {
    if (Fraction.of(p.index).equals(cp)) return p.gati;
  }
  return best.gati;
}

function markerAt(tala: Tala, cp: Fraction): string | null {
  if (!cp.isWhole()) return null;
  const idx = tala.aksharaCount > 0 ? Math.trunc(cp.num / cp.den) % tala.aksharaCount : 0;
  for (const p of tala.parts) {
    if (p.index === idx && p.marker !== "") return p.marker;
  }
  return null;
}

/**
 * First absolute whole-akshara position strictly inside (start, end) that carries a
 * tala anga marker. Notes that straddle this boundary should be split as note + ",".
 */
export function firstCrossingMarker(tala: Tala, start: Fraction, end: Fraction): Fraction | null {
  if (!end.gt(start)) return null;
  const first = Math.floor(start.doubleValue()) + 1;
  const last = end.isWhole() ? end.doubleValue() - 1 : Math.floor(end.doubleValue());
  for (let p = first; p <= last; p++) {
    const fp = Fraction.of(p);
    if (!(fp.gt(start) && fp.lt(end))) continue;
    if (markerAt(tala, cyclePos(fp, tala.aksharaCount)) != null) return fp;
  }
  return null;
}

/** Short single-letter form when a dheergam is split before an anga marker (rI -> r). */
export function shortenSwaraDisplay(display: string | null): string | null {
  if (display == null || display === "") return display;
  const star = display.endsWith("*") ? "*" : "";
  const base = star === "" ? display : display.slice(0, -1);
  if (base.length === 2) {
    const a = base[0]!.toLowerCase();
    const b = base[1]!.toLowerCase();
    if ((a === "s" || a === "r" || a === "g" || a === "m" || a === "p" || a === "d" || a === "n") && (b === "a" || b === "i")) {
      return a + star;
    }
  }
  return display;
}

function rowCapacity(tala: Tala, rowIdx: number): Fraction {
  if (tala.layoutRows.length === 0) return Fraction.of(tala.aksharaCount);
  return tala.layoutRows[rowIdx % tala.layoutRows.length]!.duration;
}

/** floor(pos / pattern) * pattern, using double for the floor only. */
function patternFloorMul(pos: Fraction, pattern: Fraction): Fraction {
  const p = pattern.doubleValue();
  if (p <= 0) return Fraction.ZERO;
  const n = Math.floor(pos.doubleValue() / p);
  return pattern.mul(n);
}

/**
 * For each lyric line, determines which notations start a new "word" -- i.e. the
 * syllable there is either the first non-blank lyric in the line, or the previous
 * non-blank lyric was followed by a blank (space) placeholder. Used only for
 * Tamil's word-initial dental "n" (ந) vs mid/end-word alveolar "n" (ன) distinction.
 */
function computeWordStarts(block: SongBlock): boolean[][] {
  const result: boolean[][] = [];
  const n = block.notations.length;
  for (let li = 0; li < block.nLyricLines; li++) {
    const flags: boolean[] = new Array(n).fill(false);
    let atStart = true;
    for (let i = 0; i < n; i++) {
      const lyrics = block.notations[i]!.lyrics;
      const tok = li < lyrics.length ? lyrics[li]! : null;
      const trimmed = tok == null ? "" : tok.trim();
      if (trimmed === "") {
        flags[i] = false;
        atStart = true;
      } else {
        flags[i] = atStart;
        atStart = false;
      }
    }
    result.push(flags);
  }
  return result;
}

/** Returns the resulting rows and the ending position. */
export function layoutBlock(
  block: SongBlock,
  tala: Tala,
  startPos: Fraction,
  defaultSpeed: number,
  rowSpacing: number,
  cellSpacing: number,
): [VisualRow[], Fraction] {
  const manual = tala.name.toLowerCase() === "manual";
  const rows: VisualRow[] = [];
  let cells: Cell[] = [];
  let pos = startPos;
  let rowIdx = 0;
  let rowUsed = Fraction.ZERO;
  let capacity = rowCapacity(tala, 0);
  let firstRow = true;
  const wordStarts = computeWordStarts(block);
  let notationIndex = 0;

  let pattern = Fraction.ZERO;
  for (const r of tala.layoutRows) pattern = pattern.add(r.duration);
  if (pattern.isZero()) pattern = Fraction.of(Math.max(tala.aksharaCount, 1));
  // Precise offset within the row pattern (avoids double rounding issues for
  // typical integer patterns).
  const offset = startPos.sub(patternFloorMul(startPos, pattern));

  let acc = Fraction.ZERO;
  let found = false;
  for (let i = 0; i < tala.layoutRows.length; i++) {
    const r = tala.layoutRows[i]!;
    if (offset.lt(acc.add(r.duration))) {
      rowIdx = i;
      rowUsed = offset.sub(acc);
      capacity = r.duration;
      found = true;
      break;
    }
    acc = acc.add(r.duration);
  }
  if (!found) {
    rowIdx = 0;
    rowUsed = Fraction.ZERO;
    capacity = rowCapacity(tala, 0);
  }

  const flush = (): void => {
    if (cells.length === 0) return;
    const vr = new VisualRow();
    vr.cells = cells.slice();
    vr.blockHeading = firstRow ? block.heading : null;
    vr.language = block.language ?? "english";
    vr.font = block.font;
    vr.swaraFontSize = block.swaraFontSize;
    vr.lyricFontSize = block.lyricFontSize;
    vr.swaraColor = block.swaraColor;
    vr.lyricColor = block.lyricColor;
    vr.swaraFont = block.swaraFont;
    vr.lyricFont = block.lyricFont;
    vr.swaraBold = block.swaraBold;
    vr.lyricBold = block.lyricBold;
    vr.gamakaFontSize = block.gamakaFontSize;
    vr.gamakaColor = block.gamakaColor;
    vr.rowSpacing = rowSpacing;
    vr.cellSpacing = cellSpacing;
    rows.push(vr);
    cells = [];
    firstRow = false;
    rowIdx = tala.layoutRows.length === 0 ? 0 : (rowIdx + 1) % tala.layoutRows.length;
    capacity = rowCapacity(tala, rowIdx);
    rowUsed = Fraction.ZERO;
  };

  const insertMarker = (text: string | null): void => {
    if (text == null || text === "") return;
    const last = cells[cells.length - 1];
    if (last != null && last.kind === "marker" && last.text === text) return;
    if (last != null && last.kind === "swara") {
      const gap = new Cell();
      gap.kind = "gap";
      gap.width = 0.35;
      cells.push(gap);
    }
    const marker = new Cell();
    marker.kind = "marker";
    marker.text = text;
    marker.width = 0.7;
    cells.push(marker);
    if (text === "|" || text === "||") {
      const gap = new Cell();
      gap.kind = "gap";
      gap.width = 0.35;
      cells.push(gap);
    }
  };

  const ensureMarkersBeforePlace = (): void => {
    const cp = cyclePos(pos, tala.aksharaCount);
    const m = markerAt(tala, cp);
    if (m == null) return;
    if (m === "||" && cells.length === 0) return;
    insertMarker(m);
  };

  let prevOverride: number | null = null;

  for (const n of block.notations) {
    const myIndex = notationIndex++;
    const sw = n.swara;
    if (sw.label === "|" || sw.label === "||") {
      if (manual && cells.length > 0) insertMarker(sw.label);
      continue;
    }
    const gati = sw.gatiOverride != null ? sw.gatiOverride : gatiAt(tala, pos);
    const dur = sw.duration(gati);
    if (dur.compareTo(Fraction.ZERO) <= 0) continue;

    let hyphens = sw.phraseHyphens;
    const bareDash = sw.label === "-" || sw.label === "--";
    if (hyphens <= 0 && sw.label.endsWith("-") && !bareDash) hyphens = 1;
    const phraseEnd = hyphens > 0;
    // "," and ";" (karvai) extend the previous note rather than being silent --
    // that's the standard Carnatic meaning (a one-akshara/two-akshara karvai
    // sustains whatever was just sung/played). A bare "-"/"--" or an empty "_"/
    // "__" placeholder is a true rest.
    // "," / ";" with any number of trailing phrase hyphens (";--", ",-", …).
    const isKarvai = sw.pause && (/^,-*$/.test(sw.label) || /^;-*$/.test(sw.label));
    const isRest = (sw.pause && !isKarvai) || sw.empty;
    const unit = new Swara("x", false, 0, 1, sw.speed, null, 0).duration(gati);
    // Unit for emitted karvai commas after an anga-boundary split.
    const commaUnit = new Swara(",", true, 0, 1, sw.speed, null, 0).duration(gati);

    // Rests / karvais / bare dashes: place as a single cell (no anga split).
    const maySplit = !isRest && !isKarvai && !bareDash && !sw.empty;
    if (!maySplit) {
      if (rowUsed.gte(capacity)) {
        const cp0 = cyclePos(pos, tala.aksharaCount);
        if (cp0.isZero()) insertMarker("||");
        flush();
      }
      ensureMarkersBeforePlace();
      if (sw.gatiOverride != null && sw.gatiOverride !== prevOverride) {
        const gc = new Cell();
        gc.kind = "gati";
        gc.text = gatiLabel(sw.gatiOverride);
        gc.width = 0.9;
        cells.push(gc);
      }
      const c = new Cell();
      c.kind = "swara";
      c.text = sw.displayLabel();
      c.lyrics = [...n.lyrics];
      c.speed = sw.speed;
      c.defaultSpeed = defaultSpeed;
      c.gamaka = sw.gamaka;
      c.octave = sw.octave;
      c.isRest = isRest;
      c.isSustain = sw.label === ".." || isKarvai;
      c.clusterGamaka = sw.clusterGamaka;
      c.clusterStart = sw.clusterStart;
      c.clusterEnd = sw.clusterEnd;
      c.lyricWordStart = new Array(n.lyrics.length).fill(true);
      for (let li = 0; li < n.lyrics.length; li++) {
        c.lyricWordStart[li] = li < wordStarts.length ? wordStarts[li]![myIndex]! : true;
      }
      c.phraseEnd = phraseEnd;
      c.phraseHyphens = hyphens;
      c.gatiOverride = sw.gatiOverride;
      c.width = 1.0 + Math.max(0, hyphens - 1) * 0.55;
      c.duration = dur;
      cells.push(c);
      prevOverride = sw.gatiOverride;
      pos = pos.add(dur);
      rowUsed = rowUsed.add(dur);
      if (rowUsed.gte(capacity)) {
        const cp1 = cyclePos(pos, tala.aksharaCount);
        if (cp1.isZero()) insertMarker("||");
        flush();
      }
      continue;
    }

    // Pitched notes: if a note straddles an anga marker, split as note + ","
    // on either side of the separator (standard printed-book practice).
    let rem = dur;
    let pitchedPlaced = false;
    while (rem.gt(Fraction.ZERO)) {
      if (rowUsed.gte(capacity)) {
        const cp0 = cyclePos(pos, tala.aksharaCount);
        if (cp0.isZero()) insertMarker("||");
        flush();
      }

      ensureMarkersBeforePlace();

      if (!pitchedPlaced && sw.gatiOverride != null && sw.gatiOverride !== prevOverride) {
        const gc = new Cell();
        gc.kind = "gati";
        gc.text = gatiLabel(sw.gatiOverride);
        gc.width = 0.9;
        cells.push(gc);
      }

      const cross = firstCrossingMarker(tala, pos, pos.add(rem));
      let piece = cross != null ? cross.sub(pos) : rem;
      if (piece.lte(Fraction.ZERO)) piece = rem;

      if (!pitchedPlaced) {
        let display = sw.displayLabel();
        if (cross != null && sw.length >= 2 && piece.equals(unit)) {
          display = shortenSwaraDisplay(display) ?? display;
        }
        const c = new Cell();
        c.kind = "swara";
        c.text = display;
        c.lyrics = [...n.lyrics];
        c.speed = sw.speed;
        c.defaultSpeed = defaultSpeed;
        c.gamaka = sw.gamaka;
        c.octave = sw.octave;
        c.isRest = false;
        c.isSustain = sw.label === "..";
        c.clusterGamaka = sw.clusterGamaka;
        c.clusterStart = sw.clusterStart;
        c.clusterEnd = cross != null ? false : sw.clusterEnd;
        c.lyricWordStart = new Array(n.lyrics.length).fill(true);
        for (let li = 0; li < n.lyrics.length; li++) {
          c.lyricWordStart[li] = li < wordStarts.length ? wordStarts[li]![myIndex]! : true;
        }
        c.phraseEnd = cross != null ? false : phraseEnd;
        c.phraseHyphens = cross != null ? 0 : hyphens;
        c.gatiOverride = sw.gatiOverride;
        c.width = 1.0 + Math.max(0, c.phraseHyphens - 1) * 0.55;
        c.duration = piece;
        cells.push(c);
        pitchedPlaced = true;
        rem = rem.sub(piece);
        pos = pos.add(piece);
        rowUsed = rowUsed.add(piece);
      } else {
        // Sustain across / after the anga marker with "," cells.
        let fill = piece;
        while (fill.gt(Fraction.ZERO)) {
          const slice = fill.lt(commaUnit) ? fill : commaUnit;
          const lastSlice = rem.sub(slice).lte(Fraction.ZERO) && fill.sub(slice).lte(Fraction.ZERO) && cross == null;
          const kc = new Cell();
          kc.kind = "swara";
          kc.text = ",";
          kc.speed = sw.speed;
          kc.defaultSpeed = defaultSpeed;
          kc.isRest = false;
          kc.isSustain = true;
          kc.duration = slice;
          kc.lyrics = new Array(n.lyrics.length).fill("");
          kc.lyricWordStart = new Array(n.lyrics.length).fill(false);
          if (lastSlice) {
            kc.phraseEnd = phraseEnd;
            kc.phraseHyphens = hyphens;
            kc.clusterEnd = sw.clusterEnd;
            kc.width = 1.0 + Math.max(0, hyphens - 1) * 0.55;
          } else {
            kc.width = 1.0;
          }
          cells.push(kc);
          fill = fill.sub(slice);
          rem = rem.sub(slice);
          pos = pos.add(slice);
          rowUsed = rowUsed.add(slice);
        }
      }

      prevOverride = sw.gatiOverride;

      if (rowUsed.gte(capacity)) {
        const cp1 = cyclePos(pos, tala.aksharaCount);
        if (cp1.isZero()) insertMarker("||");
        flush();
      }
    }
  }

  if (cells.length > 0) {
    const cp = cyclePos(pos, tala.aksharaCount);
    if (cp.isZero() && pos.gt(startPos)) insertMarker("||");
    flush();
  }

  return [rows, pos];
}

export function layoutSong(song: Song): LayoutItem[] {
  applyCyclesPerRow(song);
  const items: LayoutItem[] = [];
  let tala = song.tala;
  let pos = Fraction.ZERO;
  const defaultSpeed = song.effectiveDefaultSpeed;

  for (const part of song.parts) {
    if (part instanceof Tala) {
      tala = part;
      pos = Fraction.ZERO;
    } else if (part instanceof GatiSwitch) {
      tala.switchGati(part.gati);
    } else if (part instanceof Heading) {
      items.push(new VisualHeading(part));
    } else if (part instanceof SongBreak) {
      items.push(new VisualBreak());
    } else if (part instanceof PageBreak) {
      items.push(new VisualPageBreak());
    } else if (part instanceof SongBlock) {
      const [rows, endPos] = layoutBlock(part, tala, pos, defaultSpeed, song.rowSpacing, song.cellSpacing);
      pos = endPos;
      items.push(...rows);
    }
  }
  return items;
}
