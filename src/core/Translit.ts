/**
 * Syllable-level transliteration from the CMNT roman lyric convention into
 * Tamil, Telugu, Kannada, or Devanagari (Sanskrit) script.
 *
 * Ported from `CMNT-Notation-Studio-source/src/cmnt/core/Translit.java`.
 *
 * <p>CMNT lyrics are already split one syllable per note (e.g. "ma", "hA",
 * "ga", "Na", "tim"), which makes a full sandhi-aware transliterator
 * unnecessary -- this engine only needs to convert one consonant-vowel(-
 * consonant) unit at a time. Because Devanagari/Tamil/Telugu/Kannada are all
 * parallel Brahmic abugidas, a single phonetic parser is used, with a
 * per-script lookup table for the actual glyphs.
 *
 * <p>Romanization convention (case matters):
 * <ul>
 *   <li>Long vowels: A, I, U, E, O (vs short a, i, u, e, o); ai, au as-is.</li>
 *   <li>Retroflex consonants written capitalized: T, Th, D, Dh, N, L, R.</li>
 *   <li>Aspirates: kh, gh, ch, jh, th, dh, Th, Dh, ph, bh.</li>
 *   <li>sh = palatal sibilant, S = retroflex sibilant, s = dental s.</li>
 *   <li>zh = Tamil "azhagu" zha.</li>
 *   <li>ksh = conjunct "k + retroflex sh".</li>
 * </ul>
 */

export type ScriptKey = "tamil" | "telugu" | "kannada" | "sanskrit";
export type Script = ScriptKey | null;

export function scriptFor(languageBase: string | null | undefined): Script {
  if (languageBase == null) return null;
  switch (languageBase.toLowerCase()) {
    case "tamil":
      return "tamil";
    case "telugu":
      return "telugu";
    case "kannada":
      return "kannada";
    case "sanskrit":
      return "sanskrit";
    default:
      return null; // english / unknown -> no transliteration
  }
}

// ---- canonical phoneme keys -------------------------------------------------
const VOWEL_KEYS = ["ai", "au", "aa", "ii", "uu", "ee", "oo", "a", "i", "u", "e", "o"] as const;

// consonant surface forms, longest-first so the scanner is greedy
const CONS_TOKENS: ReadonlyArray<readonly [string, string]> = [
  ["kh", "kh"],
  ["gh", "gh"],
  ["ch", "ch"],
  ["jh", "jh"],
  ["ng", "ng"],
  ["Th", "tth"],
  ["Dh", "ddh"],
  ["th", "th"],
  ["dh", "dh"],
  ["ph", "ph"],
  ["bh", "bh"],
  ["sh", "ssh"],
  ["jn", "ny"],
  ["nj", "ny"],
  ["zh", "zh"],
  ["k", "k"],
  ["g", "g"],
  ["c", "c"],
  ["j", "j"],
  ["T", "tt"],
  ["D", "dd"],
  ["N", "nn"],
  ["t", "t"],
  ["d", "d"],
  ["n", "n"],
  ["p", "p"],
  ["b", "b"],
  ["m", "m"],
  ["y", "y"],
  ["r", "r"],
  ["l", "l"],
  ["v", "v"],
  ["w", "v"],
  ["S", "sh"],
  ["s", "s"],
  ["h", "h"],
  ["L", "ll"],
  ["R", "rr"],
];

function surfaceOfVowel(key: string): string {
  switch (key) {
    case "ai":
      return "ai";
    case "au":
      return "au";
    case "aa":
      return "A";
    case "ii":
      return "I";
    case "uu":
      return "U";
    case "ee":
      return "E";
    case "oo":
      return "O";
    case "a":
      return "a";
    case "i":
      return "i";
    case "u":
      return "u";
    case "e":
      return "e";
    case "o":
      return "o";
    default:
      return key;
  }
}

function matchVowel(s: string, i: number): string | null {
  for (const v of VOWEL_KEYS) {
    const surface = surfaceOfVowel(v);
    if (s.startsWith(surface, i)) return v;
  }
  return null;
}

function matchConsonant(s: string, i: number): string | null {
  // "ksh" is a special conjunct: k + retroflex-sh, not k + palatal "sh"
  if (s.startsWith("ksh", i)) return "k+ssh";
  for (const [surface, key] of CONS_TOKENS) {
    if (s.startsWith(surface, i)) return key;
  }
  return null;
}

function consLen(s: string, i: number, key: string): number {
  for (const [surface, k] of CONS_TOKENS) {
    if (k === key && s.startsWith(surface, i)) return surface.length;
  }
  return 1;
}

type Unit =
  | { kind: "indepVowel"; v: string }
  | { kind: "consVowel"; c: string; v: string }
  | { kind: "bareCons"; c: string }
  | { kind: "raw"; text: string }
  | { kind: "visarga" };

function parseSyllable(s: string): Unit[] {
  const units: Unit[] = [];
  let i = 0;
  const n = s.length;
  while (i < n) {
    // Explicit escape hatches for consonant-cluster nasals that plain romanization
    // can't disambiguate (e.g. "sangam" has only one visible "g" for both the
    // velar nasal and the following "ga" syllable). "~n" always means a bare,
    // stand-alone palatal nasal and "#n" a bare velar nasal, regardless of what
    // follows -- they never absorb a following vowel.
    if (s.startsWith("~n", i)) {
      units.push({ kind: "bareCons", c: "ny" });
      i += 2;
      continue;
    }
    if (s.startsWith("#n", i)) {
      units.push({ kind: "bareCons", c: "ng" });
      i += 2;
      continue;
    }
    // In-token Tamil n overrides. "@n"/"!n" force dental ந; "%n" forces alveolar ன.
    // Unlike ~n/#n these may take a vowel ("%nA" → னா, "ka@n" → கந்).
    if (s.startsWith("%n", i) || s.startsWith("@n", i) || s.startsWith("!n", i)) {
      const key = s.startsWith("%n", i) ? "n-alv" : "n-dent";
      i += 2;
      const vForced = matchVowel(s, i);
      if (vForced != null) {
        units.push({ kind: "consVowel", c: key, v: vForced });
        i += surfaceOfVowel(vForced).length;
      } else {
        units.push({ kind: "bareCons", c: key });
      }
      continue;
    }
    const cons = matchConsonant(s, i);
    if (cons != null) {
      if (cons === "k+ssh") {
        // k (bare, forms conjunct) then ssh takes the following vowel
        units.push({ kind: "bareCons", c: "k" });
        i += 3;
        const v2 = matchVowel(s, i);
        if (v2 != null) {
          units.push({ kind: "consVowel", c: "ssh", v: v2 });
          i += surfaceOfVowel(v2).length;
        } else {
          units.push({ kind: "bareCons", c: "ssh" });
        }
        continue;
      }
      const len = consLen(s, i, cons);
      i += len;
      if (cons === "ng" || cons === "ny") {
        // Velar/palatal nasals essentially never start their own syllable in Tamil
        // -- they occur only as the nasal component of a consonant cluster
        // (sangam, thanjai). Always treat them as bare (virama) and let whatever
        // follows parse as its own unit, rather than absorbing the next vowel
        // into one syllable.
        units.push({ kind: "bareCons", c: cons });
        continue;
      }
      const v = matchVowel(s, i);
      if (v != null) {
        units.push({ kind: "consVowel", c: cons, v });
        i += surfaceOfVowel(v).length;
      } else {
        units.push({ kind: "bareCons", c: cons });
      }
      continue;
    }
    const v = matchVowel(s, i);
    if (v != null) {
      units.push({ kind: "indepVowel", v });
      i += surfaceOfVowel(v).length;
      continue;
    }
    if (s.charAt(i) === "H") {
      units.push({ kind: "visarga" });
      i++;
      continue;
    }
    // Unknown character (digit, punctuation, space) -- pass through untouched
    units.push({ kind: "raw", text: s.charAt(i) });
    i++;
  }
  return units;
}

/** The consonant key of the next ConsVowel/BareCons unit, if any (skips Raw/vowel units). */
function nextConsonantKey(units: Unit[], fromIndex: number): string | null {
  for (let i = fromIndex; i < units.length; i++) {
    const u = units[i]!;
    if (u.kind === "consVowel" || u.kind === "bareCons") return u.c;
    if (u.kind === "indepVowel") return null; // a vowel breaks the cluster
  }
  return null;
}

/** First consonant key of a lyric token (e.g. "dan" → "d", "thai" → "th"). */
export function firstConsonantKey(roman: string | null | undefined): string | null {
  if (roman == null) return null;
  let s = roman.trim();
  if (s === "") return null;
  if (s.startsWith("@") || s.startsWith("!")) s = s.substring(1);
  if (s === "n") s = "ni";
  return nextConsonantKey(parseSyllable(s), 0);
}

// ---- per-script letter tables ------------------------------------------------
const INDEP_VOWEL: Record<ScriptKey, Record<string, string>> = {
  sanskrit: {
    a: "\u0905",
    aa: "\u0906",
    i: "\u0907",
    ii: "\u0908",
    u: "\u0909",
    uu: "\u090A",
    e: "\u090F",
    ee: "\u090F",
    ai: "\u0910",
    o: "\u0913",
    oo: "\u0913",
    au: "\u0914",
  },
  telugu: {
    a: "\u0C05",
    aa: "\u0C06",
    i: "\u0C07",
    ii: "\u0C08",
    u: "\u0C09",
    uu: "\u0C0A",
    e: "\u0C0E",
    ee: "\u0C0F",
    ai: "\u0C10",
    o: "\u0C12",
    oo: "\u0C13",
    au: "\u0C14",
  },
  kannada: {
    a: "\u0C85",
    aa: "\u0C86",
    i: "\u0C87",
    ii: "\u0C88",
    u: "\u0C89",
    uu: "\u0C8A",
    e: "\u0C8E",
    ee: "\u0C8F",
    ai: "\u0C90",
    o: "\u0C92",
    oo: "\u0C93",
    au: "\u0C94",
  },
  tamil: {
    a: "\u0B85",
    aa: "\u0B86",
    i: "\u0B87",
    ii: "\u0B88",
    u: "\u0B89",
    uu: "\u0B8A",
    e: "\u0B8E",
    ee: "\u0B8F",
    ai: "\u0B90",
    o: "\u0B92",
    oo: "\u0B93",
    au: "\u0B94",
  },
};

const VOWEL_SIGN: Record<ScriptKey, Record<string, string>> = {
  sanskrit: {
    aa: "\u093E",
    i: "\u093F",
    ii: "\u0940",
    u: "\u0941",
    uu: "\u0942",
    e: "\u0947",
    ee: "\u0947",
    ai: "\u0948",
    o: "\u094B",
    oo: "\u094B",
    au: "\u094C",
  },
  telugu: {
    aa: "\u0C3E",
    i: "\u0C3F",
    ii: "\u0C40",
    u: "\u0C41",
    uu: "\u0C42",
    e: "\u0C46",
    ee: "\u0C47",
    ai: "\u0C48",
    o: "\u0C4A",
    oo: "\u0C4B",
    au: "\u0C4C",
  },
  kannada: {
    aa: "\u0CBE",
    i: "\u0CBF",
    ii: "\u0CC0",
    u: "\u0CC1",
    uu: "\u0CC2",
    e: "\u0CC6",
    ee: "\u0CC7",
    ai: "\u0CC8",
    o: "\u0CCA",
    oo: "\u0CCB",
    au: "\u0CCC",
  },
  tamil: {
    aa: "\u0BBE",
    i: "\u0BBF",
    ii: "\u0BC0",
    u: "\u0BC1",
    uu: "\u0BC2",
    e: "\u0BC6",
    ee: "\u0BC7",
    ai: "\u0BC8",
    o: "\u0BCA",
    oo: "\u0BCB",
    au: "\u0BCC",
  },
};

const VIRAMA: Record<ScriptKey, string> = {
  sanskrit: "\u094D",
  telugu: "\u0C4D",
  kannada: "\u0CCD",
  tamil: "\u0BCD",
};

const VISARGA: Record<ScriptKey, string> = {
  sanskrit: "\u0903",
  telugu: "\u0C03",
  kannada: "\u0C83",
  tamil: "\u0B83", // aytham -- closest Tamil equivalent to visarga
};

const CONSONANT: Record<ScriptKey, Record<string, string>> = {
  sanskrit: {
    k: "\u0915",
    kh: "\u0916",
    g: "\u0917",
    gh: "\u0918",
    ng: "\u0919",
    c: "\u091A",
    ch: "\u091B",
    j: "\u091C",
    jh: "\u091D",
    ny: "\u091E",
    tt: "\u091F",
    tth: "\u0920",
    dd: "\u0921",
    ddh: "\u0922",
    nn: "\u0923",
    t: "\u0924",
    th: "\u0925",
    d: "\u0926",
    dh: "\u0927",
    n: "\u0928",
    p: "\u092A",
    ph: "\u092B",
    b: "\u092C",
    bh: "\u092D",
    m: "\u092E",
    y: "\u092F",
    r: "\u0930",
    l: "\u0932",
    v: "\u0935",
    sh: "\u0936",
    ssh: "\u0937",
    s: "\u0938",
    h: "\u0939",
    ll: "\u0933",
    zh: "\u0933",
    rr: "\u0930",
  },
  telugu: {
    k: "\u0C15",
    kh: "\u0C16",
    g: "\u0C17",
    gh: "\u0C18",
    ng: "\u0C19",
    c: "\u0C1A",
    ch: "\u0C1B",
    j: "\u0C1C",
    jh: "\u0C1D",
    ny: "\u0C1E",
    tt: "\u0C1F",
    tth: "\u0C20",
    dd: "\u0C21",
    ddh: "\u0C22",
    nn: "\u0C23",
    t: "\u0C24",
    th: "\u0C25",
    d: "\u0C26",
    dh: "\u0C27",
    n: "\u0C28",
    p: "\u0C2A",
    ph: "\u0C2B",
    b: "\u0C2C",
    bh: "\u0C2D",
    m: "\u0C2E",
    y: "\u0C2F",
    r: "\u0C30",
    l: "\u0C32",
    v: "\u0C35",
    sh: "\u0C36",
    ssh: "\u0C37",
    s: "\u0C38",
    h: "\u0C39",
    ll: "\u0C33",
    zh: "\u0C33",
    rr: "\u0C31",
  },
  kannada: {
    k: "\u0C95",
    kh: "\u0C96",
    g: "\u0C97",
    gh: "\u0C98",
    ng: "\u0C99",
    c: "\u0C9A",
    ch: "\u0C9B",
    j: "\u0C9C",
    jh: "\u0C9D",
    ny: "\u0C9E",
    tt: "\u0C9F",
    tth: "\u0CA0",
    dd: "\u0CA1",
    ddh: "\u0CA2",
    nn: "\u0CA3",
    t: "\u0CA4",
    th: "\u0CA5",
    d: "\u0CA6",
    dh: "\u0CA7",
    n: "\u0CA8",
    p: "\u0CAA",
    ph: "\u0CAB",
    b: "\u0CAC",
    bh: "\u0CAD",
    m: "\u0CAE",
    y: "\u0CAF",
    r: "\u0CB0",
    l: "\u0CB2",
    v: "\u0CB5",
    sh: "\u0CB6",
    ssh: "\u0CB7",
    s: "\u0CB8",
    h: "\u0CB9",
    ll: "\u0CB3",
    zh: "\u0CB3",
    rr: "\u0CB1",
  },
  tamil: (() => {
    const KA = "\u0B95";
    const NGA = "\u0B99";
    const CA = "\u0B9A";
    const NYA = "\u0B9E";
    const TTA = "\u0B9F";
    const NNA = "\u0BA3";
    const TA = "\u0BA4";
    const NA = "\u0BA8";
    const PA = "\u0BAA";
    const MA = "\u0BAE";
    const YA = "\u0BAF";
    const RA = "\u0BB0";
    const LA = "\u0BB2";
    const VA = "\u0BB5";
    const ZHA = "\u0BB4";
    const LLA = "\u0BB3";
    const RRA = "\u0BB1";
    const JA = "\u0B9C";
    const SHA = "\u0BB7";
    const SA = "\u0BB8";
    const HA = "\u0BB9";
    const SHA_PAL = "\u0BB6";
    // stops/aspirates all collapse onto the single Tamil letter (no voicing distinction)
    return {
      k: KA,
      kh: KA,
      g: KA,
      gh: KA,
      ng: NGA,
      c: CA,
      ch: CA,
      j: JA,
      jh: JA,
      ny: NYA,
      tt: TTA,
      tth: TTA,
      dd: TTA,
      ddh: TTA,
      nn: NNA,
      t: TA,
      th: TA,
      d: TA,
      dh: TA,
      n: NA,
      p: PA,
      ph: PA,
      b: PA,
      bh: PA,
      m: MA,
      y: YA,
      r: RA,
      l: LA,
      v: VA,
      sh: SHA_PAL,
      ssh: SHA,
      s: SA,
      h: HA,
      ll: LLA,
      zh: ZHA,
      rr: RRA,
    };
  })(),
};

/** Tamil alveolar na (ன) -- used mid/end-word; dental ந (the default "n" mapping) is word-initial. */
const TAMIL_ALVEOLAR_NA = "\u0BA9";

/** Dental stops that trigger homorganic dental "n" (santham, bandham, munthu, thanthi). */
function isDentalStop(key: string | null): boolean {
  return key === "t" || key === "th" || key === "d" || key === "dh";
}

/** The Tamil "medial" (idaiyinam) consonants -- ய ர ல வ ழ ள -- after which a
 *  following "n" is conventionally dental (purandhara, vandhitha). */
function isLiquidGlide(key: string | null): boolean {
  return key === "y" || key === "r" || key === "l" || key === "v" || key === "zh" || key === "ll";
}

function consonantGlyph(
  script: ScriptKey,
  cons: Record<string, string>,
  key: string,
  atWordStart: boolean,
  isBareCluster: boolean,
  followingKey: string | null,
  precedingKey: string | null,
): string {
  if (key === "n-dent") return cons["n"] ?? "";
  if (key === "n-alv") return script === "tamil" ? TAMIL_ALVEOLAR_NA : (cons["n"] ?? "");
  if (script === "tamil" && key === "n") {
    // An explicit word-start override (the @/! marker) forces dental regardless
    // of surrounding context -- that's the whole point of the override.
    if (atWordStart && isBareCluster) return cons[key] ?? "";
    // A bare "n" preceded by y/r/l/v/zh/L (purandhara, vandhitha -- "n" right
    // after ர/வ etc.) is dental regardless of what follows or word position.
    if (isLiquidGlide(precedingKey)) return cons[key] ?? "";
    if (isBareCluster) {
      // A bare "n" in a consonant cluster otherwise takes the place of
      // articulation of whatever follows: dental ந before a dental stop
      // (santham, bandham, munthu, thanthi), alveolar ன otherwise
      // (janyam, or word-final).
      return isDentalStop(followingKey) ? (cons[key] ?? "") : TAMIL_ALVEOLAR_NA;
    }
    // A full na/ni/nu syllable: dental at the start of a word, alveolar elsewhere.
    return atWordStart ? (cons[key] ?? "") : TAMIL_ALVEOLAR_NA;
  }
  return cons[key] ?? "";
}

/** Strips transliteration-control markers (@/! word-start override, ~n/#n bare
 *  nasal disambiguation) that only mean something when transliterating into an
 *  Indic script. For English/roman output there's no script to disambiguate for,
 *  so these should just disappear rather than showing up literally as stray
 *  punctuation, e.g. "@nE" -> "nE", "sa~ngam" -> "sangam". */
function stripTransliterationMarkers(s: string): string {
  let out = s;
  if (out.startsWith("@") || out.startsWith("!")) out = out.substring(1);
  return out.replace(/~n/g, "n").replace(/#n/g, "n").replace(/%n/g, "n").replace(/@n/g, "n").replace(/!n/g, "n");
}

/**
 * Transliterate one already-syllabified phoneme unit (e.g. "sA", "hA", "ni",
 * "sangam") into the target script.
 *
 * @param wordStart whether the first phoneme of `roman` is at the start of a
 *   word. Only affects Tamil: plain "n" renders as dental ந at the start of a
 *   word and alveolar ன everywhere else (a distinction Tamil makes that the
 *   other supported scripts don't).
 * @param followingRoman the next lyric token of the *same word* when notation
 *   splits a word across notes (`kan` + `dan` for கந்தன்). A trailing bare "n"
 *   then sees the following dental stop and stays ந், not ன்.
 *   Overrides: `ka@n` / `@n` force ந்; `da%n` / `%n` force ன். Prefix `@` on the
 *   *next* token marks a new word so this syllable does not look across.
 */
export function transliterate(
  roman: string,
  script: Script,
  wordStart = true,
  followingRoman?: string | null,
): string {
  if (roman == null || roman === "") return roman;
  // No target script means English/roman output -- the @/!/~n/#n markers only mean
  // something when transliterating into an Indic script (word-start override, bare
  // palatal/velar nasal disambiguation), so strip them rather than showing up as
  // stray punctuation in the English lyric line.
  if (script == null) return stripTransliterationMarkers(roman);

  let s = roman;
  let ws = wordStart;
  // An explicit "@" or "!" prefix forces word-start treatment for this syllable
  // (dental na, etc.) regardless of the automatically-computed word-boundary.
  const explicitMarker = s.startsWith("@") || s.startsWith("!");
  if (explicitMarker) {
    s = s.substring(1);
    ws = true;
  }
  // A lone "n" as an entire syllable token is conventionally shorthand for "ni" in
  // sahityam (e.g. a note's lyric is just "n"), not a genuine bare/cluster consonant.
  if (!explicitMarker && s === "n") s = "ni";
  // Leave placeholders / punctuation-only tokens untouched
  if (!/[a-zA-Z]/.test(s)) return s;

  const indep = INDEP_VOWEL[script];
  const signs = VOWEL_SIGN[script];
  const cons = CONSONANT[script];
  const virama = VIRAMA[script];

  const units = parseSyllable(s);
  let out = "";
  let atStart = ws;
  let prevKey: string | null = null;
  for (let i = 0; i < units.length; i++) {
    const u = units[i]!;
    if (u.kind === "raw") {
      out += u.text;
    } else if (u.kind === "indepVowel") {
      out += indep[u.v] ?? "";
      atStart = false;
      prevKey = null;
    } else if (u.kind === "consVowel") {
      out += consonantGlyph(script, cons, u.c, atStart, false, null, prevKey);
      if (u.v !== "a") out += signs[u.v] ?? "";
      atStart = false;
      prevKey = u.c;
    } else if (u.kind === "bareCons") {
      let nextKey = nextConsonantKey(units, i + 1);
      if (nextKey == null && followingRoman) nextKey = firstConsonantKey(followingRoman);
      out += consonantGlyph(script, cons, u.c, atStart, true, nextKey, prevKey) + virama;
      atStart = false;
      prevKey = u.c;
    } else if (u.kind === "visarga") {
      out += VISARGA[script] ?? "";
    }
  }
  return out;
}

const SWARA_BASE: Record<string, string> = {
  s: "sa",
  r: "ri",
  g: "ga",
  m: "ma",
  p: "pa",
  d: "da",
  n: "ni",
};

function isSwaraName(base: string): boolean {
  const lc = base.toLowerCase();
  return (
    lc === "sa" || lc === "ri" || lc === "ga" || lc === "ma" || lc === "pa" || lc === "da" || lc === "ni"
  );
}

/**
 * Transliterate a swara-solfa letter (s/r/g/m/p/d/n, or two-letter sa/ri/ga/ma/pa/da/ni,
 * optionally with a trailing "*" bhinna marker) into the target script.
 *
 * <p>Unlike lyric transliteration, this never shows a variant-qualifier subscript --
 * which variant (ri1/2/3, ga1/2/3, etc.) a note represents is only ever indicated in
 * the Aro/Avarohanam heading spec, not on the notation itself, matching standard
 * Carnatic notation practice.
 */
export function transliterateSwara(label: string, script: Script): string {
  if (script == null || label == null || label === "") return label;
  let base = label;
  let suffix = "";
  if (base.endsWith("*")) {
    suffix = "*";
    base = base.slice(0, -1);
  }
  let canonical: string;
  if (base.length === 1) {
    // Single-letter (1-akshara) form: s uses inherent-a "sa" (ஸ), not bare "s" (ஸ்),
    // because the Tamil/Grantha virama pulli looks like a spurious tara-sthayi octave
    // dot. r/n need their vowel to stay recognizable; g/m/p/d keep inherent-a.
    const key = base.toLowerCase();
    const mapped = SWARA_BASE[key];
    if (mapped == null) return label; // pauses/markers/etc. -- leave untouched
    canonical = mapped;
  } else if (base.length === 2 && isSwaraName(base)) {
    // Two-letter (2-akshara) form: the notation's own convention already encodes
    // vowel length via the case of the 2nd letter (sA/dA/mA/gA/pA = long A, rI/nI =
    // long I; lowercase = short) -- pass that straight through instead of collapsing
    // it away, so a 2-count note (sA) visibly differs from a 1-count note (s).
    canonical = base[0]!.toLowerCase() + base.substring(1);
  } else {
    return label;
  }
  return transliterate(canonical, script) + suffix;
}

/**
 * Transliterate a full lyric/heading string that may contain multiple
 * words/spaces (a workable Tamil/Telugu/Kannada/Sanskrit lyric
 * transliteration for common CMNT syllables like "ma", "hA", "ga", "Na",
 * "pa", "tim").
 *
 * @param wordStart whether the first letter run in `roman` starts a word
 *   (only affects Tamil dental/alveolar "n"; runs found after an internal
 *   space are always treated as word-starts). CMNT lyrics are already split
 *   one syllable per note, so the caller (SvgScore) typically passes the
 *   per-cell word-start flag computed by the layout engine.
 */
export function transliterateText(roman: string, script: Script, wordStart = true): string {
  if (script == null || roman == null || roman === "") return roman;
  let out = "";
  let word = "";
  let firstWord = true;
  const flush = (): void => {
    if (word.length === 0) return;
    out += transliterate(word, script, firstWord ? wordStart : true);
    firstWord = false;
    word = "";
  };
  for (let i = 0; i <= roman.length; i++) {
    const c = i < roman.length ? roman[i]! : " ";
    if (/[a-zA-Z]/.test(c)) {
      word += c;
    } else if (c === "-" && word.length > 0 && i + 1 < roman.length && /[a-zA-Z]/.test(roman[i + 1]!)) {
      // An internal hyphen (letters on both sides) is a syllable-break marker
      // within one word for transliteration purposes (e.g. "jan-yam"), not a
      // real word boundary -- dropped from the phonetic stream rather than
      // splitting into two separately-transliterated words, which would garble
      // the sandhi at the join and leave a stray hyphen in the script output.
      continue;
    } else if (
      (c === "@" || c === "!") &&
      i + 1 < roman.length &&
      (/[a-zA-Z]/.test(roman[i + 1]!) ||
        ((roman[i + 1] === "~" || roman[i + 1] === "#") &&
          i + 2 < roman.length &&
          /[nN]/.test(roman[i + 2]!)))
    ) {
      // Word-start override markers must stay attached to the following syllable
      // ("@nA", "!n") so transliterate() can force dental ந. Emitting them as
      // separators left a literal "@"/"!" in the output (JAR transliterateText
      // has the same gap; lyrics go through transliterate() instead).
      word += c;
    } else if (
      (c === "~" || c === "#" || c === "%") &&
      i + 1 < roman.length &&
      /[nN]/.test(roman[i + 1]!)
    ) {
      // Bare nasal escapes ("#n" → ங், "~n" → ஞ், "%n" → ன்) must stay in the
      // phonetic stream; otherwise the scanner splits "sa#ngam" into "sa" + "#" + "ngam".
      word += c;
    } else {
      flush();
      if (i < roman.length) out += c;
    }
  }
  return out;
}

const BARE_SWARA_TOKEN = /^([SRGMPDNsrgmpdn])([0-9~*]*)(['`]?)$/;

/**
 * Transliterate a heading line (title, composer credit, Aro/Avarohanam spec,
 * etc). Whitespace-separated tokens that are a single swara letter optionally
 * followed by a variant digit/subscript/tilde (e.g. "R2", "G3~", as found in
 * an Aro/Ava spec) are transliterated via the swara-letter mapping, with the
 * digit/tilde/subscript kept as-is; every other token is transliterated as
 * ordinary text.
 */
export function transliterateHeading(text: string, script: Script): string {
  if (text == null || text === "") return text;
  if (script == null) return stripTransliterationMarkers(text);
  let out = "";
  const re = /(\s+)|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const tok = m[0];
    if (m[1] != null) {
      out += tok;
      continue;
    }
    const sm = BARE_SWARA_TOKEN.exec(tok);
    if (sm != null) {
      out += transliterateSwara(sm[1]!, script) + sm[2]! + (sm[3] ?? "");
    } else {
      out += transliterateText(tok, script);
    }
  }
  return out;
}
