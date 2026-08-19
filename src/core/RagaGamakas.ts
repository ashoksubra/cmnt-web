/**
 * Per-melakarta inter-note gamaka library.
 *
 * Each scale degree has a default anuswara expansion for arohana and (when
 * filled) avarohana. Patterns use the same letters as CMNT (`sA` = two-count
 * Sa, `'` / `` ` `` = stayi, `,` / `;` = karvai). Adjacent shorts like `gr`
 * are two notes. The expansion is scaled to the parent note's duration.
 *
 * Phrase-specific overrides (when a turn or visesha sanchara needs a different
 * shape) live in `phrases` keyed `prev>note>next`, e.g. `s>r>g` vs `s>r>s`.
 *
 * Janyas inherit their parent melakarta until they have their own table.
 * Unmarked notes use this library; a written gamaka tag or `{…}(kh)` cluster
 * in the source wins. Very short notes stay plain (no time to speak anuswaras).
 */
import type { TransitionWaypoint } from "./PitchTransition.js";
import { MADHYA_SA_MIDI } from "./PitchTransition.js";

export type GamakaAtom = {
  kind: "pitch" | "sustain";
  letter?: string;
  octave: number;
  length: number;
};

export type RagaGamakaTable = {
  melakarta: number;
  name: string;
  /** Arohana defaults keyed by stayi-aware swara (`s`, `r`, `s'`). Empty string = plain. */
  aroha: Readonly<Record<string, string>>;
  avaroha: Readonly<Record<string, string>>;
  /** Optional visesha: `s>r>g` → pattern. Checked before direction defaults. */
  phrases?: Readonly<Record<string, string>>;
};

export function swaraStayiKey(letter: string, octave: number): string {
  const L = letter.toLowerCase();
  if (octave > 0) return L + "'".repeat(octave);
  if (octave < 0) return L + "`".repeat(-octave);
  return L;
}

const LONG_SWARAS = new Set(["sa", "ri", "ga", "ma", "pa", "da", "ni"]);

/** Tokenize a pedagogical gamaka string into pitched atoms and karvai. */
export function parseGamakaPattern(src: string): GamakaAtom[] {
  const out: GamakaAtom[] = [];
  const s = src.trim();
  let i = 0;
  while (i < s.length) {
    const ch = s[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === ",") {
      out.push({ kind: "sustain", octave: 0, length: 1 });
      i++;
      continue;
    }
    if (ch === ";") {
      out.push({ kind: "sustain", octave: 0, length: 2 });
      i++;
      continue;
    }
    const rest = s.slice(i);
    const two = /^([srgmpdn][ai])(['`]*)/i.exec(rest);
    const one = /^([srgmpdn])(['`]*)/i.exec(rest);
    let m = two;
    if (two != null && !LONG_SWARAS.has(two[1]!.toLowerCase())) m = one;
    else if (two == null) m = one;
    if (m == null) {
      i++;
      continue;
    }
    const body = m[1]!;
    const length = body.length === 2 ? 2 : 1;
    let octave = 0;
    for (const mark of m[2] ?? "") {
      if (mark === "'") octave++;
      else if (mark === "`") octave--;
    }
    out.push({ kind: "pitch", letter: body[0]!.toLowerCase(), octave, length });
    i += m[0].length;
  }
  return out;
}

function midiOf(
  letter: string,
  octave: number,
  semitones: ReadonlyMap<string, number>,
): number | null {
  const semi = semitones.get(letter);
  if (semi == null) return null;
  return MADHYA_SA_MIDI + semi + 12 * octave;
}

/**
 * Fit a parsed pattern into 0–1 of the parent note. The last atom whose letter
 * matches the parent (else the last pitch) is aligned to the parent MIDI so
 * the shape transposes with stayi.
 */
export function waypointsFromGamaka(
  atoms: GamakaAtom[],
  parentMidi: number,
  parentLetter: string,
  semitones: ReadonlyMap<string, number>,
): TransitionWaypoint[] | null {
  if (atoms.length === 0) return null;
  const pitched: { midi: number; length: number; letter: string }[] = [];
  let lastMidi: number | null = null;
  for (const a of atoms) {
    if (a.kind === "sustain") {
      if (lastMidi == null) continue;
      pitched.push({ midi: lastMidi, length: a.length, letter: "_" });
      continue;
    }
    const midi = midiOf(a.letter!, a.octave, semitones);
    if (midi == null) continue;
    lastMidi = midi;
    pitched.push({ midi, length: a.length, letter: a.letter! });
  }
  if (pitched.length === 0) return null;

  let anchor = -1;
  for (let i = pitched.length - 1; i >= 0; i--) {
    if (pitched[i]!.letter === parentLetter) {
      anchor = i;
      break;
    }
  }
  if (anchor < 0) anchor = pitched.length - 1;
  const shift = parentMidi - pitched[anchor]!.midi;
  const total = pitched.reduce((n, p) => n + p.length, 0);
  if (total <= 0) return null;

  const points: TransitionWaypoint[] = [];
  let acc = 0;
  for (const p of pitched) {
    const midi = p.midi + shift;
    const frac0 = acc / total;
    acc += p.length;
    const frac1 = acc / total;
    points.push({ frac: frac0, midi, gainMul: 1 }, { frac: frac1, midi, gainMul: 1 });
  }
  return points;
}

/**
 * Dhīra Śankarābharaṇam (29). Arohana anuswaras as given for this project.
 * Avarohana is a different set — left empty until written in. Phrase keys
 * override both when a turn needs another shape.
 */
export const SANKARABHARANAM_GAMAKAS: RagaGamakaTable = {
  melakarta: 29,
  name: "Sankarabharanam",
  aroha: {
    s: "",
    r: "sA gr",
    g: "g r gA",
    m: "gA m g",
    p: "p g pA",
    d: "pA s' d",
    n: "s' n s' n",
    "s'": "p sA' ,",
  },
  avaroha: {},
  phrases: {},
};

const BY_MELAKARTA = new Map<number, RagaGamakaTable>([[29, SANKARABHARANAM_GAMAKAS]]);

export function ragaGamakaTable(melakarta: number | null | undefined): RagaGamakaTable | null {
  if (melakarta == null || melakarta < 1) return null;
  return BY_MELAKARTA.get(melakarta) ?? null;
}

export type GamakaContext = {
  letter: string;
  octave: number;
  prevLetter: string | null;
  prevOctave: number | null;
  nextLetter: string | null;
  nextOctave: number | null;
  /** Approach: from below = aroha, from above = avaroha. */
  fromMidi: number | null;
  midi: number;
};

export function gamakaDirection(ctx: GamakaContext): "aroha" | "avaroha" | "plain" {
  if (ctx.fromMidi == null) return "plain";
  if (ctx.midi > ctx.fromMidi) return "aroha";
  if (ctx.midi < ctx.fromMidi) return "avaroha";
  return "plain";
}

export function lookupGamakaPattern(table: RagaGamakaTable, ctx: GamakaContext): string | null {
  const note = swaraStayiKey(ctx.letter, ctx.octave);
  const prev =
    ctx.prevLetter != null && ctx.prevOctave != null ? swaraStayiKey(ctx.prevLetter, ctx.prevOctave) : "";
  const next =
    ctx.nextLetter != null && ctx.nextOctave != null ? swaraStayiKey(ctx.nextLetter, ctx.nextOctave) : "";
  const phraseKey = `${prev}>${note}>${next}`;
  const phraseHit = table.phrases?.[phraseKey];
  if (phraseHit != null) return phraseHit;

  const dir = gamakaDirection(ctx);
  const bank = dir === "avaroha" ? table.avaroha : table.aroha;
  if (Object.prototype.hasOwnProperty.call(bank, note)) return bank[note]!;
  if (dir === "plain" && Object.prototype.hasOwnProperty.call(table.aroha, note)) {
    return table.aroha[note]!;
  }
  return null;
}

/** Seconds: below this, skip library anuswaras (4th-speed flashes). */
export const GAMAKA_MIN_DURATION_SEC = 0.22;

export function waypointsForRagaGamaka(
  table: RagaGamakaTable,
  ctx: GamakaContext,
  semitones: ReadonlyMap<string, number>,
): TransitionWaypoint[] | null {
  const pattern = lookupGamakaPattern(table, ctx);
  if (pattern == null || pattern.trim() === "" || /^plain$/i.test(pattern.trim())) return null;
  const atoms = parseGamakaPattern(pattern);
  return waypointsFromGamaka(atoms, ctx.midi, ctx.letter, semitones);
}
