/**
 * Note-to-note traversal library (procedural first cut).
 *
 * The long-term store is a stayi matrix: every pitch in the working range to
 * every other pitch, with a path that fits the destination's duration.
 * 37×37 is mandra Sa through three chromatic octaves (12×3+1). 61×61 extends
 * anumandra Sa through five octaves (12×5+1). Cells can later be replaced by
 * recorded or hand-tuned contours; until then a cell is generated:
 *
 * - ¼ of the destination duration stays on the departure pitch, ¾ on the
 *   arrival (or equally among arrival-side pitches when the path has more
 *   than two notes).
 * - Gravity: a leap of a fourth or more arrives at half volume. Rising and
 *   falling both quiet the destination (the "thrown" note). Multi-note paths
 *   apply that drop in stages.
 *
 * This is not raga-gamaka selection (Subramanian / Srikumar). It is a physical
 * traversal between written pitches, which is what a veena left hand actually
 * does on a long jaru such as s → s'.
 */

/** Madhya-stayi Sa (MIDI). Same reference as playback. */
export const MADHYA_SA_MIDI = 60;

/** Inclusive chromatic pitches from mandra Sa to mandra Sa + 36. */
export const TRANSITION_MATRIX_SIZE = 37;
/** Inclusive chromatic pitches spanning five octaves (anumandra … ati-tara). */
export const EXTENDED_MATRIX_SIZE = 61;

/** Fraction of the destination note spent on the departure pitch. */
export const TRANSITION_SPLIT = 0.25;
/** Arrival gain when the leap is large enough to "throw" the voice/string. */
export const GRAVITY_GAIN = 0.5;
/** Semitone span that triggers gravity (a fourth). */
export const GRAVITY_SEMITONES = 5;

export type TransitionWaypoint = {
  /** 0–1 through the destination note's sounding duration. */
  frac: number;
  midi: number;
  gainMul: number;
};

/** Mandra Sa = madhya Sa − 12. Index 0 … 36 covers the 37×37 matrix. */
export function rangeIndexFromMadhyaSa(midi: number, madhyaSa = MADHYA_SA_MIDI): number {
  return midi - (madhyaSa - 12);
}

export function midiFromRangeIndex(index: number, madhyaSa = MADHYA_SA_MIDI): number {
  return madhyaSa - 12 + index;
}

function pitchClassFromSa(midi: number, madhyaSa = MADHYA_SA_MIDI): number {
  return ((midi - madhyaSa) % 12 + 12) % 12;
}

/** Raga swaras strictly between two MIDI pitches, in travel order. */
export function scalePitchesBetween(
  fromMidi: number,
  toMidi: number,
  scalePc: readonly number[],
  madhyaSa = MADHYA_SA_MIDI,
): number[] {
  const lo = Math.min(fromMidi, toMidi);
  const hi = Math.max(fromMidi, toMidi);
  const found: number[] = [];
  for (let m = lo + 1; m < hi; m++) {
    if (scalePc.includes(pitchClassFromSa(m, madhyaSa))) found.push(m);
  }
  return toMidi < fromMidi ? found.reverse() : found;
}

/**
 * Waypoints for one destination note, reached from the previous pitch.
 * Same pitch → hold. Otherwise ¼ on departure, ¾ on arrival.
 * Pass `via` when the matrix cell is a multi-note path (volume stages).
 */
export function planPitchTransition(
  fromMidi: number,
  toMidi: number,
  via: readonly number[] = [],
): TransitionWaypoint[] {
  if (fromMidi === toMidi) {
    return [
      { frac: 0, midi: toMidi, gainMul: 1 },
      { frac: 1, midi: toMidi, gainMul: 1 },
    ];
  }

  const rest = [...via, toMidi];
  const leap = Math.abs(toMidi - fromMidi) >= GRAVITY_SEMITONES;
  const destGain = leap ? GRAVITY_GAIN : 1;

  const points: TransitionWaypoint[] = [
    { frac: 0, midi: fromMidi, gainMul: 1 },
    { frac: TRANSITION_SPLIT, midi: fromMidi, gainMul: 1 },
  ];

  for (let i = 0; i < rest.length; i++) {
    const frac0 = TRANSITION_SPLIT + (i / rest.length) * (1 - TRANSITION_SPLIT);
    const frac1 = TRANSITION_SPLIT + ((i + 1) / rest.length) * (1 - TRANSITION_SPLIT);
    const gainMul = leap ? 1 - (1 - destGain) * ((i + 1) / rest.length) : 1;
    const midi = rest[i]!;
    points.push({ frac: frac0, midi, gainMul }, { frac: frac1, midi, gainMul });
  }
  return points;
}
