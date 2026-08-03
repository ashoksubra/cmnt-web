/**
 * Optional modern "---" YAML-style front-matter header, e.g.:
 *
 * ```
 * ---
 * title: Endaro Mahanubhavulu
 * composer: Tyagaraja
 * raga: Sri
 * tala: Adi
 * speed: 2
 * language: Tamil
 *
 * layout:
 *   type: krithi
 *   width: full
 *   cyclesPerRow: 4
 *
 * style:
 *   swara: { color: blue, size: 13 }
 *   lyric: { color: black, size: 13 }
 * ---
 *
 * Pallavi:
 * S: s r g m
 * L: sa ri ga ma
 * ```
 *
 * Ported from `CMNT-Notation-Studio-source/src/cmnt/core/YamlFrontMatter.java`.
 * This is purely a front-end convenience: it is translated into the exact
 * same classic directive lines (Tala:, DefaultSpeed:, Raagam:, SwaraPrefs:,
 * ...) that `CmntParser` already understands, so every existing rule --
 * validation, ordering flexibility, error messages -- applies unchanged.
 * Files using the classic flat-directive style are completely unaffected;
 * this only activates when the very first non-blank line is exactly "---".
 */

/** Thrown for malformed front-matter (unrecognized keys, missing "text:", ...).
 *  `CmntParser.parse` catches this and rethrows as a `ParseException`. */
export class YamlFrontMatterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YamlFrontMatterError";
  }
}

interface YamlMap {
  [key: string]: YamlValue;
}
type YamlValue = string | YamlMap;

/** If the text starts with a "---" front-matter block, returns the text with
 *  that block replaced by equivalent classic directives (everything else
 *  unchanged). Otherwise returns the text unmodified. */
export function preprocess(text: string): string {
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length && lines[i]!.trim() === "") i++;
  if (i >= lines.length || lines[i]!.trim() !== "---") return text;

  const blockStart = i + 1;
  let blockEnd = -1;
  for (let j = blockStart; j < lines.length; j++) {
    if (lines[j]!.trim() === "---") {
      blockEnd = j;
      break;
    }
  }
  if (blockEnd === -1) return text; // no closing fence -- classic parser reports the real error

  const blockLines = lines.slice(blockStart, blockEnd);
  const parsed = parseBlock(blockLines);
  const directives = translate(parsed);

  return [...directives, ...lines.slice(blockEnd + 1)].join("\n");
}

// ---- minimal indentation-based key:value parser (subset of YAML) ----

function parseBlock(lines: string[]): YamlMap {
  return parseMapping(lines, { i: 0 }, 0);
}

function parseMapping(lines: string[], pos: { i: number }, minIndent: number): YamlMap {
  const map: YamlMap = {};
  let levelIndent: number | null = null;
  while (pos.i < lines.length) {
    const raw = lines[pos.i]!;
    const stripped = stripComment(raw);
    if (stripped.trim() === "") {
      pos.i++;
      continue;
    }
    const lineIndent = leadingSpaces(stripped);
    if (lineIndent < minIndent) break;
    if (levelIndent === null) levelIndent = lineIndent;
    if (lineIndent < levelIndent) break; // dedent -- end of this mapping
    if (lineIndent > levelIndent) {
      pos.i++;
      continue; // over-indented stray line -- skip defensively
    }
    const content = stripped.trim();
    const colon = findTopLevelColon(content);
    if (colon < 0) {
      pos.i++;
      continue;
    }
    const key = content.slice(0, colon).trim();
    const rest = content.slice(colon + 1).trim();
    pos.i++;
    if (rest === "") {
      // Nested mapping on following, deeper-indented lines.
      map[key] = parseMapping(lines, pos, levelIndent + 1);
    } else if (rest.startsWith("{")) {
      map[key] = parseFlowMapping(rest);
    } else {
      map[key] = unquote(rest);
    }
  }
  return map;
}

function parseFlowMapping(s: string): YamlMap {
  const map: YamlMap = {};
  let inner = s.trim();
  if (inner.startsWith("{")) inner = inner.slice(1);
  if (inner.endsWith("}")) inner = inner.slice(0, -1);
  for (const part of splitTopLevelCommas(inner)) {
    const p = part.trim();
    if (p === "") continue;
    const c = p.indexOf(":");
    if (c < 0) continue;
    map[p.slice(0, c).trim()] = unquote(p.slice(c + 1).trim());
  }
  return map;
}

function splitTopLevelCommas(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") depth--;
    else if (c === "," && depth === 0) {
      parts.push(s.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(s.slice(start));
  return parts;
}

function findTopLevelColon(s: string): number {
  let inQuotes = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === '"') inQuotes = !inQuotes;
    else if (c === ":" && !inQuotes) return i;
  }
  return -1;
}

function leadingSpaces(s: string): number {
  let n = 0;
  while (n < s.length && s[n] === " ") n++;
  return n;
}

function stripComment(s: string): string {
  let inQuotes = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === '"') inQuotes = !inQuotes;
    else if (c === "#" && !inQuotes) return s.slice(0, i);
  }
  return s;
}

function unquote(s: string): string {
  s = s.trim();
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  return s;
}

function isMap(v: YamlValue | undefined): v is YamlMap {
  return typeof v === "object" && v !== null;
}

/** Returns the value as a string, or null if absent/a nested map. */
function str(v: YamlValue | undefined): string | null {
  if (v === undefined) return null;
  return typeof v === "string" ? v : null;
}

function firstNonNull(...vals: (string | null)[]): string | null {
  for (const v of vals) if (v !== null) return v;
  return null;
}

function lowerKeys(m: YamlMap): YamlMap {
  const out: YamlMap = {};
  for (const [k, v] of Object.entries(m)) out[k.toLowerCase()] = v;
  return out;
}

function esc(s: string): string {
  return s.replace(/"/g, "'");
}

function isTrue(v: string | null): boolean {
  return v !== null && v.toLowerCase() === "true";
}

// ---- translation: parsed map -> classic directive lines ----

const HEADING_STYLE_KEYS = new Set(["text", "bold", "italic", "align", "size", "font", "color"]);

/**
 * Builds a Heading: directive from a title/composer value that's either a
 * plain string (uses the given defaults, e.g. composer defaults to italic)
 * or a block with explicit style overrides, e.g.:
 * ```
 * composer:
 *   text: "Tyagaraja"
 *   italic: false
 *   font: Georgia
 * ```
 */
function buildHeadingDirective(
  value: YamlValue | undefined,
  defaultBold: boolean,
  defaultItalic: boolean,
  defaultAlign: string,
  defaultSize: number,
  tight: boolean,
  langTag: string,
  fieldName: string,
): string | null {
  if (value === undefined) return null;
  let text: string | null;
  let bold = defaultBold;
  let italic = defaultItalic;
  let align = defaultAlign;
  let font: string | null = null;
  let color: string | null = null;
  let size = defaultSize;
  if (isMap(value)) {
    const hm = lowerKeys(value);
    const unknown = Object.keys(hm).filter((k) => !HEADING_STYLE_KEYS.has(k));
    if (unknown.length > 0) {
      throw new YamlFrontMatterError(
        `unrecognized key${unknown.length > 1 ? "s" : ""} under "${fieldName}:": ${unknown.join(", ")} ` +
          "(expected: text, bold, italic, align, size, font, color)",
      );
    }
    text = str(hm.text);
    if (text === null) {
      throw new YamlFrontMatterError(`"${fieldName}:" written as a block needs a "text:" value`);
    }
    if (hm.bold !== undefined) bold = isTrue(str(hm.bold));
    if (hm.italic !== undefined) italic = isTrue(str(hm.italic));
    if (hm.align !== undefined) align = str(hm.align)!;
    if (hm.size !== undefined) size = parseInt(str(hm.size)!, 10);
    if (hm.font !== undefined) font = str(hm.font);
    if (hm.color !== undefined) color = str(hm.color);
  } else {
    text = str(value);
  }
  if (text === null) return null;
  const parts: string[] = [];
  if (bold) parts.push("bold");
  if (italic) parts.push("italic");
  parts.push(align);
  parts.push(String(size));
  if (color !== null) parts.push(color);
  if (font !== null) parts.push(font);
  if (tight) parts.push("tight");
  if (langTag !== "") parts.push(langTag.slice(1));
  return `Heading: "${esc(text)}"` + parts.map((p) => `,${p}`).join("");
}

const TOP_KEYS = new Set([
  "title",
  "composer",
  "raga",
  "ragam",
  "raagam",
  "melakarta",
  "tala",
  "talam",
  "speed",
  "defaultspeed",
  "language",
  "speedmarks",
  "phraseends",
  "cyclesperrow",
  "rowspacing",
  "cellspacing",
  "layout",
  "style",
]);
const LAYOUT_KEYS = new Set(["type", "width", "orientation", "cyclesperrow", "rowspacing", "cellspacing"]);
const STYLE_KEYS = new Set(["swara", "lyric", "heading", "gamaka"]);
const PREF_KEYS = new Set(["color", "size", "font", "bold"]);

function translate(raw: YamlMap): string[] {
  const m = lowerKeys(raw);
  const unknown = Object.keys(m).filter((k) => !TOP_KEYS.has(k));
  if (unknown.length > 0) {
    throw new YamlFrontMatterError(
      `unrecognized key${unknown.length > 1 ? "s" : ""} in the --- header block: ${unknown.join(", ")} -- ` +
        'check spelling and case (keys are lowercase, e.g. "raga:" not "Raagam:", "tala:" not "Talam:")',
    );
  }

  const out: string[] = [];

  // language is resolved first so title/composer headings can be explicitly
  // tagged with it directly, rather than relying on directive order.
  const language = str(m.language);
  const langTag = language !== null ? "," + language.split(":")[0]!.toLowerCase() : "";

  const title = buildHeadingDirective(m.title, true, false, "center", 20, false, langTag, "title");
  if (title !== null) out.push(title);
  const composer = buildHeadingDirective(m.composer, false, true, "center", 16, true, langTag, "composer");
  if (composer !== null) out.push(composer);

  const layoutObj = m.layout;
  let cpr = str(m.cyclesperrow); // also accepted at top level, not just nested
  let rs = str(m.rowspacing);
  let cellSp = str(m.cellspacing);
  if (isMap(layoutObj)) {
    const lo = lowerKeys(layoutObj);
    const unknownLayout = Object.keys(lo).filter((k) => !LAYOUT_KEYS.has(k));
    if (unknownLayout.length > 0) {
      throw new YamlFrontMatterError(
        `unrecognized key${unknownLayout.length > 1 ? "s" : ""} under "layout:": ${unknownLayout.join(", ")} ` +
          "(expected: type, width, orientation, cyclesPerRow, rowSpacing, cellSpacing)",
      );
    }
    const layoutType = str(lo.type);
    const layoutWidth = str(lo.width);
    const layoutOrientation = str(lo.orientation);
    if (cpr === null) cpr = str(lo.cyclesperrow);
    if (rs === null) rs = str(lo.rowspacing);
    if (cellSp === null) cellSp = str(lo.cellspacing);
    if (layoutType !== null || layoutWidth !== null) {
      let lb = `Layout: ${layoutType !== null ? layoutType : "Krithi"}`;
      if (layoutWidth?.toLowerCase() === "full") lb += ",FullWidth";
      else if (layoutWidth?.toLowerCase() === "compact") lb += ",Compact";
      out.push(lb);
    }
    if (layoutOrientation !== null) out.push(`Orientation: ${layoutOrientation}`);
  } else if (layoutObj !== undefined) {
    out.push(`Layout: ${str(layoutObj)}`);
  }
  if (cpr !== null) out.push(`CyclesPerRow: ${cpr}`);
  if (rs !== null) out.push(`RowSpacing: ${rs}`);
  if (cellSp !== null) out.push(`CellSpacing: ${cellSp}`);

  // Emit Language before Raagam/Tala so the combined ragam/talam heading is
  // tagged with the score language at creation time (not stuck on english
  // until a later Language: retag).
  if (language !== null) out.push(`Language: ${language}`);

  const raga = firstNonNull(str(m.raga), str(m.ragam), str(m.raagam));
  const melakarta = str(m.melakarta);
  if (melakarta !== null) out.push(`Melakarta: ${melakarta}`);
  if (raga !== null) out.push(`Raagam: ${raga}`);

  const tala = firstNonNull(str(m.tala), str(m.talam));
  if (tala !== null) out.push(`Tala: ${tala}`);
  const speed = firstNonNull(str(m.speed), str(m.defaultspeed));
  if (speed !== null) out.push(`DefaultSpeed: ${speed}`);
  const speedMarks = str(m.speedmarks);
  if (speedMarks !== null) out.push(`SpeedMarks: ${speedMarks}`);
  const phraseEnds = str(m.phraseends);
  if (phraseEnds !== null) out.push(`PhraseEnds: ${phraseEnds}`);

  const styleObj = m.style;
  if (isMap(styleObj)) {
    const st = lowerKeys(styleObj);
    const unknownStyle = Object.keys(st).filter((k) => !STYLE_KEYS.has(k));
    if (unknownStyle.length > 0) {
      throw new YamlFrontMatterError(
        `unrecognized key${unknownStyle.length > 1 ? "s" : ""} under "style:": ${unknownStyle.join(", ")} ` +
          "(expected: swara, lyric, heading, gamaka)",
      );
    }
    addPrefs(out, "SwaraPrefs", st.swara);
    addPrefs(out, "LyricPrefs", st.lyric);
    addPrefs(out, "HeadingPrefs", st.heading);
    addPrefs(out, "GamakaPrefs", st.gamaka);
  }

  return out;
}

function addPrefs(out: string[], directiveName: string, val: YamlValue | undefined): void {
  if (!isMap(val)) return;
  const pm = lowerKeys(val);
  const unknown = Object.keys(pm).filter((k) => !PREF_KEYS.has(k));
  if (unknown.length > 0) {
    throw new YamlFrontMatterError(
      `unrecognized key${unknown.length > 1 ? "s" : ""} under "${directiveName.toLowerCase()}" style (in "style:"): ` +
        `${unknown.join(", ")} (expected: color, size, font, bold)`,
    );
  }
  const color = str(pm.color);
  const size = str(pm.size);
  const font = str(pm.font);
  const bold = isTrue(str(pm.bold));
  const parts: string[] = [];
  if (color !== null) parts.push(color);
  if (size !== null) parts.push(size);
  if (bold) parts.push("bold");
  if (font !== null) parts.push(font);
  if (parts.length > 0) out.push(`${directiveName}: ${parts.join(",")}`);
}
