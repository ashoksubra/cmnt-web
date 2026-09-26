/**
 * Pitch model for the gamakas Subbarama Dikshitar lays out in
 * Sangita Sampradaya Pradarsini.
 *
 * The fifteen names are kampita (with lina, andolita, and plavita as
 * deflection-length varieties), sphurita and its avarohana twin pratyaghata,
 * nokku, ahata split into ravai and khandippu, vali, ullasita split into
 * etra and irakka jaru, humpita, kurula split into odukkal and orikkai,
 * tribhinna, mudrita, namita, and misrita.
 *
 * A gamaka is either one swara, a janta on that swara, or a short phrase.
 * Phrase notes are taken from the melakarta scale, not from a chromatic fill.
 * Duration is the whole gesture in aksharakalas.
 */

import { melakartaVariantNumbers, melakartaVariants } from "./Melakarta.js";
import { clampBpm, clampTonicMidi, DEFAULT_BPM, DEFAULT_TONIC_MIDI } from "./Playback.js";

export const SWARA_LETTERS = ["s", "r", "g", "m", "p", "d", "n"] as const;
export type SwaraLetter = (typeof SWARA_LETTERS)[number];
export type GamakaDirection = "arohana" | "avarohana";

/** A gamaka phrase is at most this many swaras. */
export const MAX_PHRASE_NOTES = 8;

export type PhraseNote = { letter: SwaraLetter; octave: number };

export const SSP_GAMAKA_IDS = [
  "kampita",
  "lina",
  "andolita",
  "plavita",
  "sphurita",
  "pratyaghata",
  "nokku",
  "ravai",
  "khandippu",
  "vali",
  "etraJaru",
  "irakkaJaru",
  "humpita",
  "odukkal",
  "orikkai",
  "tribhinna",
  "mudrita",
  "namita",
  "misrita",
] as const;
export type SspGamakaId = (typeof SSP_GAMAKA_IDS)[number];

export type GamakaScope = "note" | "janta" | "phrase";

export type SspGamaka = {
  id: SspGamakaId;
  name: string;
  /** SSP notation mark when the text assigns one. */
  symbol: string;
  group: string;
  scope: GamakaScope;
  minSpan: number;
  maxSpan: number;
  defaultSpan: number;
  /** Arohana / avarohana changes which way the phrase or meld travels. */
  usesDirection: boolean;
  /** What the span control counts. */
  spanLabel: string;
  summary: string;
};

export const SSP_GAMAKAS: readonly SspGamaka[] = [
  {
    id: "kampita",
    name: "Kampita",
    symbol: "∼",
    group: "Kampita",
    scope: "note",
    minSpan: 1,
    maxSpan: 1,
    defaultSpan: 1,
    usesDirection: false,
    spanLabel: "Notes",
    summary:
      "Shake on one svara sthana. The finger stays on the fret, so the pitch rocks above the note and does not pronounce the next scale degree.",
  },
  {
    id: "lina",
    name: "Lina",
    symbol: "∼",
    group: "Kampita",
    scope: "note",
    minSpan: 1,
    maxSpan: 1,
    defaultSpan: 1,
    usesDirection: true,
    spanLabel: "Notes",
    summary: "A kampita variety that melts this note into the next scale note over the whole duration.",
  },
  {
    id: "andolita",
    name: "Andolita",
    symbol: "∼",
    group: "Kampita",
    scope: "note",
    minSpan: 1,
    maxSpan: 1,
    defaultSpan: 1,
    usesDirection: true,
    spanLabel: "Notes",
    summary: "A slower kampita variety: the note swings all the way to the neighbouring scale note and back.",
  },
  {
    id: "plavita",
    name: "Plavita",
    symbol: "∼",
    group: "Kampita",
    scope: "note",
    minSpan: 1,
    maxSpan: 1,
    defaultSpan: 1,
    usesDirection: false,
    spanLabel: "Notes",
    summary: "A prolonged kampita. The shake starts narrow and widens, and each deflection lasts longer than in kampita.",
  },
  {
    id: "sphurita",
    name: "Sphurita",
    symbol: "∴",
    group: "Strike",
    scope: "janta",
    minSpan: 1,
    maxSpan: 1,
    defaultSpan: 1,
    usesDirection: false,
    spanLabel: "Notes",
    summary:
      "Arohana janta. The same swara is struck twice; between the strikes the next-lower scale note is heard.",
  },
  {
    id: "pratyaghata",
    name: "Pratyaghata",
    symbol: "∵",
    group: "Strike",
    scope: "janta",
    minSpan: 1,
    maxSpan: 1,
    defaultSpan: 1,
    usesDirection: false,
    spanLabel: "Notes",
    summary:
      "Avarohana janta. The second strike is the one that is hit, and the next-higher scale note speaks quietly between the two.",
  },
  {
    id: "nokku",
    name: "Nokku",
    symbol: "w",
    group: "Strike",
    scope: "phrase",
    minSpan: 1,
    maxSpan: 8,
    defaultSpan: 3,
    usesDirection: true,
    spanLabel: "Notes in the phrase",
    summary:
      "A press on this swara inside a phrase. The note is approached from the neighbour on the other side, then the phrase continues along the melakarta.",
  },
  {
    id: "ravai",
    name: "Ravai",
    symbol: "∧",
    group: "Ahata",
    scope: "note",
    minSpan: 1,
    maxSpan: 1,
    defaultSpan: 1,
    usesDirection: false,
    spanLabel: "Notes",
    summary: "Ahata toward the previous note: touch the lower scale note and return to this swara.",
  },
  {
    id: "khandippu",
    name: "Khandippu",
    symbol: "X",
    group: "Ahata",
    scope: "phrase",
    minSpan: 2,
    maxSpan: 8,
    defaultSpan: 3,
    usesDirection: false,
    spanLabel: "Notes in the descent",
    summary:
      "A cut downward through two, three, or four scale notes. Earlier notes are plucked; the last step is joined without a fresh pluck.",
  },
  {
    id: "vali",
    name: "Vali",
    symbol: "⌒",
    group: "Deflection",
    scope: "phrase",
    minSpan: 1,
    maxSpan: 8,
    defaultSpan: 1,
    usesDirection: false,
    spanLabel: "Higher shades",
    summary:
      "From this fret, the string is deflected in a curve so that one, two, or three higher scale notes shade the pitch, then it returns.",
  },
  {
    id: "etraJaru",
    name: "Etra jaru",
    symbol: "/",
    group: "Ullasita",
    scope: "phrase",
    minSpan: 1,
    maxSpan: 7,
    defaultSpan: 2,
    usesDirection: false,
    spanLabel: "Scale steps up",
    summary: "One pluck glides up the melakarta by one or more scale steps, passing each swara on the way.",
  },
  {
    id: "irakkaJaru",
    name: "Irakka jaru",
    symbol: "\\",
    group: "Ullasita",
    scope: "phrase",
    minSpan: 1,
    maxSpan: 7,
    defaultSpan: 2,
    usesDirection: false,
    spanLabel: "Scale steps down",
    summary: "One pluck glides down the melakarta by one or more scale steps, passing each swara on the way.",
  },
  {
    id: "humpita",
    name: "Humpita",
    symbol: "—",
    group: "Ullasita",
    scope: "phrase",
    minSpan: 4,
    maxSpan: 7,
    defaultSpan: 5,
    usesDirection: true,
    spanLabel: "Scale steps",
    summary:
      "A jaru of four, five, or seven steps with a hum-like swell: volume grows while rising and falls while descending.",
  },
  {
    id: "odukkal",
    name: "Odukkal",
    symbol: "×",
    group: "Kurula",
    scope: "phrase",
    minSpan: 1,
    maxSpan: 8,
    defaultSpan: 1,
    usesDirection: false,
    spanLabel: "Higher notes pulled",
    summary:
      "From this sthana the string is pulled so that one, two, or three higher scale notes sound, then it returns to the same note.",
  },
  {
    id: "orikkai",
    name: "Orikkai",
    symbol: "⤵",
    group: "Kurula",
    scope: "phrase",
    minSpan: 1,
    maxSpan: 8,
    defaultSpan: 1,
    usesDirection: false,
    spanLabel: "Notes pushed down",
    summary: "A push through one, two, or three higher sthanas that descends onto this swara.",
  },
  {
    id: "tribhinna",
    name: "Tribhinna",
    symbol: "—",
    group: "Veena",
    scope: "note",
    minSpan: 1,
    maxSpan: 1,
    defaultSpan: 1,
    usesDirection: false,
    spanLabel: "Notes",
    summary:
      "Three strings stopped at this fret and plucked together: the note, a fifth above it, and an octave below.",
  },
  {
    id: "mudrita",
    name: "Mudrita",
    symbol: "—",
    group: "Vocal",
    scope: "note",
    minSpan: 1,
    maxSpan: 1,
    defaultSpan: 1,
    usesDirection: false,
    spanLabel: "Notes",
    summary: "The closed-mouth grace: a quiet, narrow kampita on this note.",
  },
  {
    id: "namita",
    name: "Namita",
    symbol: "—",
    group: "Vocal",
    scope: "note",
    minSpan: 1,
    maxSpan: 1,
    defaultSpan: 1,
    usesDirection: false,
    spanLabel: "Notes",
    summary: "A slender tone. The note is soft and bends only slightly above the fret.",
  },
  {
    id: "misrita",
    name: "Misrita",
    symbol: "+",
    group: "Mixed",
    scope: "phrase",
    minSpan: 1,
    maxSpan: 7,
    defaultSpan: 2,
    usesDirection: true,
    spanLabel: "Scale steps",
    summary: "Two of the gamakas above, one after the other, sharing this duration. The second begins where the first arrives.",
  },
];

const BY_ID = new Map<SspGamakaId, SspGamaka>(SSP_GAMAKAS.map((g) => [g.id, g]));

export function isSspGamakaId(value: string): value is SspGamakaId {
  return BY_ID.has(value as SspGamakaId);
}

export function sspGamaka(id: SspGamakaId): SspGamaka {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown SSP gamaka: ${id}`);
  return found;
}

export type ScaleStep = {
  letter: SwaraLetter;
  octave: number;
  /** Semitone above Sa in this octave, 0–11. */
  semitone: number;
};

export type ContourPoint = {
  sec: number;
  /** First pitch is the melodic line. Further pitches sound with it (tribhinna). */
  pitches: readonly number[];
  gain: number;
  /** False jumps to this pitch. True slides in from the previous point. */
  slide: boolean;
};

export type GamakaModelRequest = {
  id: SspGamakaId;
  melakarta: number;
  swara: SwaraLetter;
  octave: number;
  direction: GamakaDirection;
  span: number;
  aksharas: number;
  bpm: number;
  tonicMidi: number;
  /**
   * Explicit swaras for this gamaka, at most {@link MAX_PHRASE_NOTES}.
   * Two or more notes replace the generated scale walk. Pitch still comes
   * from the melakarta. A jaru fills the scale notes between the ones named.
   */
  phrase?: readonly PhraseNote[];
  mixA?: SspGamakaId;
  mixB?: SspGamakaId;
};

export type GamakaContour = {
  id: SspGamakaId;
  durationSec: number;
  aksharas: number;
  bpm: number;
  tonicMidi: number;
  melakarta: number;
  span: number;
  direction: GamakaDirection;
  points: readonly ContourPoint[];
  path: readonly ScaleStep[];
  summary: string;
};

type Norm = {
  id: SspGamakaId;
  melakarta: number;
  swara: SwaraLetter;
  octave: number;
  direction: GamakaDirection;
  span: number;
  aksharas: number;
  bpm: number;
  tonicMidi: number;
  /** Two or more notes. A single named note is folded into swara/octave. */
  phrase: readonly PhraseNote[];
  mixA: SspGamakaId;
  mixB: SspGamakaId;
};

type Seg = { step: ScaleStep; gain: number; frac: number; slide: boolean };

function clampAksharas(n: number): number {
  if (!Number.isFinite(n)) return 2;
  return Math.min(16, Math.max(1, Math.round(n)));
}

function clampOctave(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(2, Math.max(-2, Math.round(n)));
}

function clampMelakarta(n: number): number {
  if (!Number.isFinite(n)) return 29;
  return Math.min(72, Math.max(1, Math.round(n)));
}

function clampSpan(gamaka: SspGamaka, span: number): number {
  if (!Number.isFinite(span)) return gamaka.defaultSpan;
  return Math.min(gamaka.maxSpan, Math.max(gamaka.minSpan, Math.round(span)));
}

function componentId(value: SspGamakaId | undefined, fallback: SspGamakaId): SspGamakaId {
  if (value == null || value === "misrita" || !BY_ID.has(value)) return fallback;
  return value;
}

export function scaleStep(
  melakarta: number,
  letter: SwaraLetter,
  octave: number,
  delta: number,
): ScaleStep {
  const semis = melakartaVariants(melakarta);
  const idx = SWARA_LETTERS.indexOf(letter);
  const abs = octave * 7 + idx + delta;
  const octaveOut = Math.floor(abs / 7);
  const i = ((abs % 7) + 7) % 7;
  const letterOut = SWARA_LETTERS[i]!;
  return { letter: letterOut, octave: octaveOut, semitone: semis[letterOut] };
}

export function stepMidi(step: ScaleStep, tonicMidi: number): number {
  return tonicMidi + step.semitone + 12 * step.octave;
}

export function formatScaleStep(step: ScaleStep, melakarta: number): string {
  const vn = melakartaVariantNumbers(melakarta);
  const variant = step.letter === "s" || step.letter === "p" ? "" : String(vn[step.letter] ?? "");
  const body = step.letter.toUpperCase() + variant;
  if (step.octave > 0) return body + "'".repeat(step.octave);
  if (step.octave < 0) return body + ".".repeat(-step.octave);
  return body;
}

export function formatGamakaPath(path: readonly ScaleStep[], melakarta: number): string {
  if (path.length === 0) return "";
  return path.map((s) => formatScaleStep(s, melakarta)).join(" – ");
}

const PHRASE_TOKEN = /([srgmpdn])(?:[123])?(\.+|'+)?/gi;

/**
 * Read a phrase of up to 8 swaras. Stayi marks attach to the letter
 * (`n.` mandra, `s'` tara). A letter with no mark uses `fallbackOctave`.
 * Variant digits are accepted and ignored: the melakarta chooses the pitch.
 */
export function parsePhrase(
  text: string,
  fallbackOctave = 0,
): { notes: PhraseNote[]; truncated: boolean } {
  const notes: PhraseNote[] = [];
  let truncated = false;
  PHRASE_TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PHRASE_TOKEN.exec(text)) !== null) {
    if (notes.length >= MAX_PHRASE_NOTES) {
      truncated = true;
      break;
    }
    const letter = match[1]!.toLowerCase() as SwaraLetter;
    const mark = match[2] ?? "";
    let octave = fallbackOctave;
    if (mark.startsWith(".")) octave = -Math.min(2, mark.length);
    else if (mark.startsWith("'")) octave = Math.min(2, mark.length);
    notes.push({ letter, octave });
  }
  return { notes, truncated };
}

function clampPhrase(notes: readonly PhraseNote[] | undefined): PhraseNote[] {
  if (!notes) return [];
  const out: PhraseNote[] = [];
  for (const note of notes) {
    if (out.length >= MAX_PHRASE_NOTES) break;
    if (!(SWARA_LETTERS as readonly string[]).includes(note.letter)) continue;
    out.push({ letter: note.letter, octave: clampOctave(note.octave) });
  }
  return out;
}

function semitoneOf(step: ScaleStep): number {
  return step.semitone + 12 * step.octave;
}

function walk(melakarta: number, from: ScaleStep, delta: number): ScaleStep {
  return scaleStep(melakarta, from.letter, from.octave, delta);
}

/** `count` scale notes beginning at `from`, including `from`. */
function run(melakarta: number, from: ScaleStep, count: number, dir: 1 | -1): ScaleStep[] {
  const out: ScaleStep[] = [];
  for (let i = 0; i < count; i++) out.push(walk(melakarta, from, i * dir));
  return out;
}

/** `steps` scale intervals from `from`, including both ends. */
function climb(melakarta: number, from: ScaleStep, steps: number, dir: 1 | -1): ScaleStep[] {
  return run(melakarta, from, steps + 1, dir);
}

function scaleIndex(step: ScaleStep): number {
  return step.octave * 7 + SWARA_LETTERS.indexOf(step.letter);
}

/** Glide along named notes, inserting the melakarta swaras that lie between them. */
function bridge(melakarta: number, notes: readonly ScaleStep[]): ScaleStep[] {
  const out: ScaleStep[] = [];
  for (const next of notes) {
    const prev = out[out.length - 1];
    if (!prev) {
      out.push(next);
      continue;
    }
    const delta = scaleIndex(next) - scaleIndex(prev);
    if (delta === 0) continue;
    const dir: 1 | -1 = delta > 0 ? 1 : -1;
    for (let s = 1; s <= Math.abs(delta); s++) out.push(walk(melakarta, prev, s * dir));
  }
  return out;
}

function stepsOf(melakarta: number, notes: readonly PhraseNote[]): ScaleStep[] {
  return notes.map((note) => scaleStep(melakarta, note.letter, note.octave, 0));
}

const NOTEWISE: ReadonlySet<SspGamakaId> = new Set([
  "kampita",
  "plavita",
  "mudrita",
  "namita",
  "andolita",
  "sphurita",
  "pratyaghata",
  "ravai",
  "tribhinna",
]);

function phraseDirection(notes: readonly ScaleStep[], fallback: GamakaDirection): 1 | -1 {
  if (notes.length < 2) return fallback === "avarohana" ? -1 : 1;
  const delta = scaleIndex(notes[1]!) - scaleIndex(notes[0]!);
  if (delta < 0) return -1;
  if (delta > 0) return 1;
  return fallback === "avarohana" ? -1 : 1;
}

function remember(path: ScaleStep[], step: ScaleStep): void {
  const prev = path[path.length - 1];
  if (prev && prev.letter === step.letter && prev.octave === step.octave) return;
  path.push(step);
}

function renderSegs(segs: readonly Seg[], dur: number, tonic: number): ContourPoint[] {
  const sum = segs.reduce((s, seg) => s + seg.frac, 0) || 1;
  let t = 0;
  const points: ContourPoint[] = [];
  for (const seg of segs) {
    points.push({
      sec: t,
      pitches: [stepMidi(seg.step, tonic)],
      gain: seg.gain,
      slide: points.length > 0 && seg.slide,
    });
    t += (seg.frac / sum) * dur;
  }
  const last = segs[segs.length - 1]!;
  points.push({
    sec: dur,
    pitches: [stepMidi(last.step, tonic)],
    gain: last.gain,
    slide: true,
  });
  return points;
}

function glide(
  steps: readonly ScaleStep[],
  dur: number,
  tonic: number,
  gain0: number,
  gain1: number,
): ContourPoint[] {
  const n = Math.max(1, steps.length - 1);
  return steps.map((step, i) => {
    const u = i / n;
    return {
      sec: dur * u,
      pitches: [stepMidi(step, tonic)],
      gain: gain0 + (gain1 - gain0) * u,
      slide: i > 0,
    };
  });
}

/** Veena deflection: pitch rises off the fret and falls back. It does not reach `ceiling`. */
function shake(
  center: number,
  amp: number,
  hz: number,
  dur: number,
  gain: number,
  grow: boolean,
): ContourPoint[] {
  const half = 1 / (2 * Math.max(0.5, hz));
  const points: ContourPoint[] = [{ sec: 0, pitches: [center], gain, slide: false }];
  let t = 0;
  let rising = true;
  while (t < dur - 1e-4) {
    const next = Math.min(dur, t + half);
    const width = grow ? amp * (0.22 + 0.78 * (next / dur)) : amp;
    const midi = rising ? center + width : center;
    points.push({ sec: next, pitches: [midi], gain, slide: true });
    rising = !rising;
    t = next;
  }
  const tail = points[points.length - 1]!;
  const back = points[points.length - 2];
  if (tail.sec >= dur - 1e-4 && Math.abs(tail.pitches[0]! - center) > 1e-3 && back) {
    points[points.length - 1] = { ...tail, sec: Math.max(back.sec + 1e-3, dur - Math.min(0.02, half * 0.5)) };
    points.push({ sec: dur, pitches: [center], gain, slide: true });
  } else if (tail.sec < dur - 1e-4) {
    points.push({ sec: dur, pitches: [center], gain, slide: true });
  } else {
    points[points.length - 1] = { ...tail, sec: dur };
  }
  return points;
}

function deflectionAmp(melakarta: number, anchor: ScaleStep): number {
  const upper = walk(melakarta, anchor, 1);
  const dist = Math.max(1, semitoneOf(upper) - semitoneOf(anchor));
  return Math.min(0.9, dist * 0.45);
}

type Built = { points: ContourPoint[]; path: ScaleStep[] };

function joinParts(parts: readonly (readonly ContourPoint[])[]): ContourPoint[] {
  const out: ContourPoint[] = [];
  for (const part of parts) {
    for (const point of part) {
      const last = out[out.length - 1];
      if (last && Math.abs(last.sec - point.sec) < 1e-4) {
        out[out.length - 1] = { ...point, slide: false };
      } else {
        out.push(point);
      }
    }
  }
  return out;
}

/** Same ornament on every named swara, sharing the duration equally. */
function onEachNote(id: SspGamakaId, norm: Norm, dur: number): Built {
  const notes = stepsOf(norm.melakarta, norm.phrase);
  const slice = dur / notes.length;
  const path: ScaleStep[] = [];
  const parts: ContourPoint[][] = [];
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i]!;
    const one = build(
      id,
      { ...norm, phrase: [], swara: note.letter, octave: note.octave, span: 1 },
      slice,
    );
    parts.push(shiftPoints(one.points, i * slice));
    for (const step of one.path) remember(path, step);
  }
  return { points: joinParts(parts), path };
}

/** Phrase gamakas follow the named notes instead of a generated scale walk. */
function buildWritten(id: SspGamakaId, notes: ScaleStep[], norm: Norm, dur: number): Built | null {
  const { melakarta, tonicMidi: tonic } = norm;
  const path: ScaleStep[] = [];
  const take = (segs: Seg[]): Built => {
    for (const seg of segs) remember(path, seg.step);
    return { points: renderSegs(segs, dur, tonic), path };
  };

  if (id === "nokku") {
    const dir = phraseDirection(notes, norm.direction);
    const away = walk(melakarta, notes[0]!, -dir);
    const slot = 1 / notes.length;
    const segs: Seg[] = [
      { step: away, gain: 0.42, frac: slot * 0.22, slide: false },
      { step: notes[0]!, gain: 1, frac: slot * 0.78, slide: true },
    ];
    for (let i = 1; i < notes.length; i++) segs.push({ step: notes[i]!, gain: 0.92, frac: slot, slide: false });
    return take(segs);
  }

  if (id === "khandippu") {
    const rest = Math.max(1, notes.length - 1);
    return take(
      notes.map((step, i) => ({
        step,
        gain: i === notes.length - 1 && notes.length > 2 ? 0.6 : 1,
        frac: i === 0 ? 0.42 : 0.58 / rest,
        slide: i === notes.length - 1 && i > 0,
      })),
    );
  }

  if (id === "vali") {
    const anchor = notes[0]!;
    const shades = notes.slice(1);
    const frac = 1 / (shades.length * 2 + 1);
    const segs: Seg[] = [{ step: anchor, gain: 1, frac, slide: false }];
    for (const shade of shades) {
      segs.push({ step: shade, gain: 0.74, frac, slide: true });
      segs.push({ step: anchor, gain: 1, frac, slide: true });
    }
    return take(segs);
  }

  if (
    id === "etraJaru" ||
    id === "irakkaJaru" ||
    id === "humpita" ||
    id === "odukkal" ||
    id === "orikkai" ||
    id === "lina"
  ) {
    const steps = bridge(melakarta, notes);
    for (const step of steps) remember(path, step);
    const rising = scaleIndex(steps[steps.length - 1]!) >= scaleIndex(steps[0]!);
    if (id === "humpita") {
      return { path, points: glide(steps, dur, tonic, rising ? 0.22 : 1, rising ? 1 : 0.24) };
    }
    if (id === "irakkaJaru") return { path, points: glide(steps, dur, tonic, 1, 0.8) };
    if (id === "lina") return { path, points: glide(steps, dur, tonic, 0.9, 0.62) };
    return { path, points: glide(steps, dur, tonic, 0.85, 1) };
  }

  return null;
}

function build(id: SspGamakaId, norm: Norm, dur: number): Built {
  const { melakarta, tonicMidi: tonic } = norm;
  if (norm.phrase.length >= 2 && NOTEWISE.has(id)) {
    return onEachNote(id, norm, dur);
  }
  if (norm.phrase.length >= 2) {
    const written = buildWritten(id, stepsOf(melakarta, norm.phrase), norm, dur);
    if (written) return written;
  }
  const anchor = scaleStep(melakarta, norm.swara, norm.octave, 0);
  const dir: 1 | -1 = norm.direction === "avarohana" ? -1 : 1;
  const span = norm.span;
  const path: ScaleStep[] = [];

  const take = (segs: Seg[]): Built => {
    for (const seg of segs) remember(path, seg.step);
    return { points: renderSegs(segs, dur, tonic), path };
  };

  switch (id) {
    case "kampita":
      remember(path, anchor);
      return {
        path,
        points: shake(stepMidi(anchor, tonic), deflectionAmp(melakarta, anchor), 5.5, dur, 1, false),
      };
    case "plavita":
      remember(path, anchor);
      return {
        path,
        points: shake(stepMidi(anchor, tonic), Math.min(1.15, deflectionAmp(melakarta, anchor) * 1.25), 3, dur, 1, true),
      };
    case "mudrita":
      remember(path, anchor);
      return {
        path,
        points: shake(stepMidi(anchor, tonic), deflectionAmp(melakarta, anchor) * 0.55, 4, dur, 0.34, false),
      };
    case "namita": {
      remember(path, anchor);
      const center = stepMidi(anchor, tonic);
      return {
        path,
        points: [
          { sec: 0, pitches: [center], gain: 0.32, slide: false },
          { sec: dur * 0.42, pitches: [center + 0.35], gain: 0.38, slide: true },
          { sec: dur, pitches: [center], gain: 0.28, slide: true },
        ],
      };
    }
    case "lina": {
      const next = walk(melakarta, anchor, dir);
      const steps = [anchor, next];
      for (const step of steps) remember(path, step);
      return { path, points: glide(steps, dur, tonic, 0.9, 0.62) };
    }
    case "andolita": {
      const other = walk(melakarta, anchor, dir);
      remember(path, anchor);
      remember(path, other);
      const cycles = Math.max(1, Math.round(dur));
      const slices = cycles * 2;
      const center = stepMidi(anchor, tonic);
      const far = stepMidi(other, tonic);
      const points: ContourPoint[] = [];
      for (let i = 0; i <= slices; i++) {
        points.push({
          sec: dur * (i / slices),
          pitches: [i % 2 === 0 ? center : far],
          gain: i % 2 === 0 ? 1 : 0.82,
          slide: i > 0,
        });
      }
      return { path, points };
    }
    case "sphurita": {
      const lower = walk(melakarta, anchor, -1);
      return take([
        { step: anchor, gain: 0.9, frac: 0.4, slide: false },
        { step: lower, gain: 0.55, frac: 0.16, slide: false },
        { step: anchor, gain: 1, frac: 0.44, slide: false },
      ]);
    }
    case "pratyaghata": {
      const upper = walk(melakarta, anchor, 1);
      return take([
        { step: anchor, gain: 0.88, frac: 0.4, slide: false },
        { step: upper, gain: 0.32, frac: 0.14, slide: false },
        { step: anchor, gain: 1, frac: 0.46, slide: false },
      ]);
    }
    case "ravai": {
      const lower = walk(melakarta, anchor, -1);
      return take([
        { step: anchor, gain: 1, frac: 0.28, slide: false },
        { step: lower, gain: 0.7, frac: 0.18, slide: false },
        { step: anchor, gain: 1, frac: 0.54, slide: false },
      ]);
    }
    case "nokku": {
      const away = walk(melakarta, anchor, -dir);
      const notes = run(melakarta, anchor, span, dir);
      const slot = 1 / notes.length;
      const segs: Seg[] = [
        { step: away, gain: 0.42, frac: slot * 0.22, slide: false },
        { step: notes[0]!, gain: 1, frac: slot * 0.78, slide: true },
      ];
      for (let i = 1; i < notes.length; i++) {
        segs.push({ step: notes[i]!, gain: 0.92, frac: slot, slide: false });
      }
      return take(segs);
    }
    case "khandippu": {
      const notes = run(melakarta, anchor, span, -1);
      const rest = notes.length - 1;
      const segs: Seg[] = notes.map((step, i) => ({
        step,
        gain: i === notes.length - 1 && notes.length > 2 ? 0.6 : 1,
        frac: i === 0 ? 0.42 : 0.58 / rest,
        slide: i === notes.length - 1 && i > 0,
      }));
      return take(segs);
    }
    case "vali": {
      const segs: Seg[] = [{ step: anchor, gain: 1, frac: 1 / (span * 2 + 1), slide: false }];
      const frac = 1 / (span * 2 + 1);
      for (let i = 1; i <= span; i++) {
        segs.push({ step: walk(melakarta, anchor, i), gain: 0.74, frac, slide: true });
        segs.push({ step: anchor, gain: 1, frac, slide: true });
      }
      return take(segs);
    }
    case "etraJaru": {
      const steps = climb(melakarta, anchor, span, 1);
      for (const step of steps) remember(path, step);
      return { path, points: glide(steps, dur, tonic, 0.85, 1) };
    }
    case "irakkaJaru": {
      const steps = climb(melakarta, anchor, span, -1);
      for (const step of steps) remember(path, step);
      return { path, points: glide(steps, dur, tonic, 1, 0.8) };
    }
    case "humpita": {
      const steps = climb(melakarta, anchor, span, dir);
      for (const step of steps) remember(path, step);
      const rising = dir === 1;
      return { path, points: glide(steps, dur, tonic, rising ? 0.22 : 1, rising ? 1 : 0.24) };
    }
    case "odukkal": {
      const up = climb(melakarta, anchor, span, 1);
      const top = up[up.length - 1]!;
      const down = climb(melakarta, top, span, -1).slice(1);
      const steps = [...up, ...down];
      for (const step of steps) remember(path, step);
      return { path, points: glide(steps, dur, tonic, 1, 1) };
    }
    case "orikkai": {
      const top = walk(melakarta, anchor, span);
      const steps = climb(melakarta, top, span, -1);
      for (const step of steps) remember(path, step);
      return { path, points: glide(steps, dur, tonic, 0.95, 1) };
    }
    case "tribhinna": {
      remember(path, anchor);
      const midi = stepMidi(anchor, tonic);
      const chord = [midi, midi + 7, midi - 12] as const;
      return {
        path,
        points: [
          { sec: 0, pitches: chord, gain: 0.7, slide: false },
          { sec: dur, pitches: chord, gain: 0.7, slide: true },
        ],
      };
    }
    default:
      remember(path, anchor);
      return {
        path,
        points: shake(stepMidi(anchor, tonic), deflectionAmp(melakarta, anchor), 5.5, dur, 1, false),
      };
  }
}

function shiftPoints(points: readonly ContourPoint[], by: number): ContourPoint[] {
  return points.map((p) => ({ ...p, sec: p.sec + by }));
}

function planMix(norm: Norm, dur: number): Built {
  const firstNorm: Norm = { ...norm, span: clampSpan(sspGamaka(norm.mixA), norm.span) };
  const first = build(norm.mixA, firstNorm, dur / 2);
  const arrival = first.path[first.path.length - 1] ?? scaleStep(norm.melakarta, norm.swara, norm.octave, 0);
  const secondGamaka = sspGamaka(norm.mixB);
  const secondNorm: Norm = {
    ...norm,
    phrase: [],
    swara: arrival.letter,
    octave: arrival.octave,
    span: norm.phrase.length >= 2 ? secondGamaka.defaultSpan : clampSpan(secondGamaka, norm.span),
  };
  const second = build(norm.mixB, secondNorm, dur / 2);
  const shifted = shiftPoints(second.points, dur / 2);
  const points = [...first.points];
  for (const p of shifted) {
    const last = points[points.length - 1];
    if (last && Math.abs(last.sec - p.sec) < 1e-4) {
      points[points.length - 1] = { ...p, slide: false };
    } else {
      points.push(p);
    }
  }
  const path = [...first.path];
  for (const step of second.path) remember(path, step);
  return { points, path };
}

function normalize(req: GamakaModelRequest): Norm {
  const id = BY_ID.has(req.id) ? req.id : "kampita";
  const gamaka = sspGamaka(id);
  const fallbackSwara = (SWARA_LETTERS as readonly string[]).includes(req.swara) ? req.swara : "s";
  const named = clampPhrase(req.phrase);
  const grouped = named.length >= 2;
  return {
    id,
    melakarta: clampMelakarta(req.melakarta),
    swara: named[0]?.letter ?? fallbackSwara,
    octave: named.length > 0 ? named[0]!.octave : clampOctave(req.octave),
    direction: req.direction === "avarohana" ? "avarohana" : "arohana",
    span: clampSpan(gamaka, req.span),
    aksharas: clampAksharas(req.aksharas),
    bpm: clampBpm(req.bpm),
    tonicMidi: clampTonicMidi(req.tonicMidi),
    phrase: grouped ? named : [],
    mixA: componentId(req.mixA, "etraJaru"),
    mixB: componentId(req.mixB, "kampita"),
  };
}

export function planGamaka(req: GamakaModelRequest): GamakaContour {
  const norm = normalize(req);
  const dur = (norm.aksharas * 60) / norm.bpm;
  const built = norm.id === "misrita" ? planMix(norm, dur) : build(norm.id, norm, dur);
  const gamaka = sspGamaka(norm.id);
  return {
    id: norm.id,
    durationSec: dur,
    aksharas: norm.aksharas,
    bpm: norm.bpm,
    tonicMidi: norm.tonicMidi,
    melakarta: norm.melakarta,
    span: norm.span,
    direction: norm.direction,
    points: built.points,
    path: built.path,
    summary: gamaka.summary,
  };
}

export { DEFAULT_BPM, DEFAULT_TONIC_MIDI };
