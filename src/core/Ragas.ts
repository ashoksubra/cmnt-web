/**
 * The 72 melakarta ragas (standard katapayadi-numbered reference list), plus janya raga
 * tables loaded from bundled data derived from Dr. M. N. Dhandapani and
 * Smt. D. Pattammal's Raga Pravaham (including S. Kalyanaraman's dwi-madhyama ragas),
 * with formatting helpers to auto-generate a displayable Aro/Avarohanam heading from
 * just a raga name.
 *
 * Ported from CMNT-Notation-Studio-source/src/cmnt/core/Ragas.java
 */
import { melakartaVariantNumbers } from "./Melakarta.js";
import { janyasDwijaTsv, janyasTsv, sriRagamTsv } from "./ragasTables.js";

/** Index 0 is unused so melakarta numbers (1-72) index directly. */
export const MELAKARTA_NAMES: readonly (string | null)[] = [
  null,
  "Kanakangi",
  "Ratnangi",
  "Ganamurti",
  "Vanaspati",
  "Manavati",
  "Tanarupi",
  "Senavati",
  "Hanumatodi",
  "Dhenuka",
  "Natakapriya",
  "Kokilapriya",
  "Rupavati",
  "Gayakapriya",
  "Vakulabharanam",
  "Mayamalavagowla",
  "Chakravakam",
  "Suryakantam",
  "Hatakambari",
  "Jhankaradhwani",
  "Natabhairavi",
  "Keeravani",
  "Kharaharapriya",
  "Gourimanohari",
  "Varunapriya",
  "Mararanjani",
  "Charukesi",
  "Sarasangi",
  "Harikambhoji",
  "Dheerashankarabharanam",
  "Naganandini",
  "Yagapriya",
  "Ragavardhini",
  "Gangeyabhushani",
  "Vagadheeswari",
  "Sulini",
  "Chalanattai",
  "Salagam",
  "Jalarnavam",
  "Jhalavarali",
  "Navaneetam",
  "Pavani",
  "Raghupriya",
  "Gavambodhi",
  "Bhavapriya",
  "Shubhapantuvarali",
  "Shadvidhamargini",
  "Suvarnangi",
  "Divyamani",
  "Dhavalambari",
  "Namanarayani",
  "Kamavardhini",
  "Ramapriya",
  "Gamanasrama",
  "Vishwambhari",
  "Syamalangi",
  "Shanmukhapriya",
  "Simhendramadhyamam",
  "Hemavati",
  "Dharmavati",
  "Nitimati",
  "Kantamani",
  "Rishabhapriya",
  "Latangi",
  "Vachaspati",
  "Mechakalyani",
  "Chitrambari",
  "Sucharitra",
  "Jyotiswarupini",
  "Dhatuvardhini",
  "Nasikabhushani",
  "Kosalam",
  "Rasikapriya",
];

const NAME_TO_NUMBER = new Map<string, number>();
for (let i = 1; i <= 72; i++) {
  const name = MELAKARTA_NAMES[i];
  if (name !== null) NAME_TO_NUMBER.set(normalize(name), i);
}
const ALIASES: readonly (readonly [string, number])[] = [
  ["Dheera Shankarabharanam", 29],
  ["Shankarabharanam", 29],
  ["Sankarabharanam", 29],
  ["Dheerasankarabharanam", 29],
  ["Kalyani", 65],
  ["Mecha Kalyani", 65],
  ["Todi", 8],
  ["Hanumatodi", 8],
  ["Pantuvarali", 51],
  ["Kamavardani", 51],
  ["Thanarupi", 6],
  ["Mayamalavagaula", 15],
  ["Jhankaradhvani", 19],
  ["Kiravani", 21],
  ["Vagadheesvari", 34],
  ["Chalanata", 36],
  ["Gavambhodi", 43],
  ["Subhapantuvarali", 45],
  ["Visvambhari", 54],
  ["Neetimati", 60],
  ["Jyotisvarupini", 68],
  ["Dhatuvardhani", 69],
];
for (const [alias, number] of ALIASES) NAME_TO_NUMBER.set(normalize(alias), number);

export type JanyaRaga = { name: string; melakarta: number; aro: string; ava: string };

const JANYA_BY_NAME = new Map<string, JanyaRaga>();
const DWIJA_BY_NAME = new Map<string, JanyaRaga>();

loadTable(janyasTsv, JANYA_BY_NAME);
loadTable(janyasDwijaTsv, DWIJA_BY_NAME);
loadTable(sriRagamTsv, DWIJA_BY_NAME);

function loadTable(text: string, into: Map<string, JanyaRaga>): void {
  for (const line of text.split(/\r?\n/)) {
    if (line.length === 0) continue;
    const parts = line.split("\t");
    if (parts.length !== 4) continue;
    try {
      const mel = Number.parseInt(parts[0]!, 10);
      if (Number.isNaN(mel)) continue;
      const key = normalize(parts[1]!);
      if (!into.has(key)) {
        into.set(key, { name: parts[1]!, melakarta: mel, aro: parts[2]!, ava: parts[3]! });
      }
    } catch {
      /* skip malformed line */
    }
  }
}

function normalize(s: string | null | undefined): string {
  return s == null ? "" : s.toLowerCase().replace(/[^a-z]/g, "");
}

export function melakartaNumberForName(name: string): number | null {
  return NAME_TO_NUMBER.get(normalize(name)) ?? null;
}

export function melakartaName(number: number): string | null {
  return number < 1 || number > 72 ? null : (MELAKARTA_NAMES[number] ?? null);
}

export function janyaForName(name: string): JanyaRaga | null {
  const direct = JANYA_BY_NAME.get(normalize(name));
  if (direct !== undefined) return direct;
  const n = normalize(name);
  if (n === "hamsadhwani" || n === "hamsadhvani") {
    return JANYA_BY_NAME.get(normalize("Hamsadwani")) ?? null;
  }
  return null;
}

export function dwijaForName(name: string): JanyaRaga | null {
  return DWIJA_BY_NAME.get(normalize(name)) ?? null;
}

export function janyaCount(): number {
  return JANYA_BY_NAME.size;
}

export function dwijaCount(): number {
  return DWIJA_BY_NAME.size;
}

export type RagaKind = "MELAKARTA" | "JANYA" | "DWIJA" | "UNKNOWN";

export type RagaLookup = {
  kind: RagaKind;
  melakarta: number;
  aro: string;
  ava: string;
};

export function lookupAny(name: string): RagaLookup {
  const mel = melakartaNumberForName(name);
  if (mel !== null) return { kind: "MELAKARTA", melakarta: mel, aro: "", ava: "" };
  const j = janyaForName(name);
  if (j !== null) return { kind: "JANYA", melakarta: j.melakarta, aro: j.aro, ava: j.ava };
  const d = dwijaForName(name);
  if (d !== null) return { kind: "DWIJA", melakarta: d.melakarta, aro: d.aro, ava: d.ava };
  return { kind: "UNKNOWN", melakarta: 0, aro: "", ava: "" };
}

const SUBSCRIPT = "₀₁₂₃₄₅₆₇₈₉";

function withVariant(upperLetter: string, variant: number | undefined): string {
  if (variant === undefined) return upperLetter;
  return upperLetter + SUBSCRIPT.charAt(variant);
}

export function melakartaAroAva(number: number): string | null {
  if (number < 1 || number > 72) return null;
  const v = melakartaVariantNumbers(number);
  const r = withVariant("R", v.r);
  const g = withVariant("G", v.g);
  const m = withVariant("M", v.m);
  const d = withVariant("D", v.d);
  const n = withVariant("N", v.n);
  // ArO / avarO are CMNT-roman forms that Tamil-transliterate cleanly (ஆரோ / அவரோ);
  // legacy "Aro"/"Ava" garbled under syllable translit.
  return `ArO: S ${r} ${g} ${m} P ${d} ${n} S' - avarO: S' ${n} ${d} P ${m} ${g} ${r} S`;
}

export function janyaAroAva(j: JanyaRaga): string | null {
  const v = melakartaVariantNumbers(j.melakarta);
  return `ArO: ${formatSequence(j.aro, v, true)} - avarO: ${formatSequence(j.ava, v, false)}`;
}

export function dwijaAroAva(j: JanyaRaga): string | null {
  const v = melakartaVariantNumbers(j.melakarta);
  return `ArO: ${formatSequence(j.aro, v, true)} - avarO: ${formatSequence(j.ava, v, false)}`;
}

function formatSequence(
  seq: string,
  variants: Readonly<Partial<Record<"r" | "g" | "m" | "d" | "n", number>>>,
  isArohana: boolean,
): string {
  const sb: string[] = [];
  for (let i = 0; i < seq.length; i++) {
    const c = seq.charAt(i);
    let token: string;
    switch (c) {
      case "S":
        token = "S";
        break;
      case "P":
        token = "P";
        break;
      case "R":
        token = withVariant("R", variants.r);
        break;
      case "G":
        token = withVariant("G", variants.g);
        break;
      case "M":
        token = withVariant("M", variants.m);
        break;
      case "D":
        token = withVariant("D", variants.d);
        break;
      case "N":
        token = withVariant("N", variants.n);
        break;
      case "Y":
        token = "M₁";
        break;
      case "X":
        token = "M₂";
        break;
      default:
        token = c;
        break;
    }
    const edgeSa =
      c === "S" &&
      seq.length > 1 &&
      ((isArohana && i === seq.length - 1) || (!isArohana && i === 0));
    if (edgeSa) token += "'";
    sb.push(token);
  }
  return sb.join(" ");
}

/** Cleans user-typed Aro/Ava into compact internal encoding (S R G M P D N, plus X/Y for dwi-madhyama). */
export function encodeUserSequence(input: string | null | undefined): string {
  if (input == null) return "";
  const s = input.toUpperCase().replace(/M1/g, "Y").replace(/M2/g, "X");
  let out = "";
  for (const c of s) {
    if ("SRGMPDNXY".includes(c)) out += c;
  }
  return out;
}

/** Reverse of encodeUserSequence for editable fields (spaced out, M1/M2 spelled out). */
export function decodeForEditing(encoded: string | null | undefined): string {
  if (encoded == null) return "";
  const parts: string[] = [];
  for (const c of encoded) {
    switch (c) {
      case "Y":
        parts.push("M1");
        break;
      case "X":
        parts.push("M2");
        break;
      default:
        parts.push(c);
        break;
    }
  }
  return parts.join(" ");
}
