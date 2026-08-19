import { describe, expect, it } from "vitest";
import { parse } from "@cmnt/core/CmntParser";
import { planNotes } from "@cmnt/core/Playback";
import {
  planPitchTransition,
  scalePitchesBetween,
  rangeIndexFromMadhyaSa,
  midiFromRangeIndex,
  TRANSITION_MATRIX_SIZE,
  EXTENDED_MATRIX_SIZE,
  TRANSITION_SPLIT,
  GRAVITY_GAIN,
} from "@cmnt/core/PitchTransition";

describe("stayi matrix range", () => {
  it("indexes mandra Sa as 0 and spans 37 chromatic pitches", () => {
    expect(TRANSITION_MATRIX_SIZE).toBe(37);
    expect(EXTENDED_MATRIX_SIZE).toBe(61);
    expect(rangeIndexFromMadhyaSa(48)).toBe(0);
    expect(rangeIndexFromMadhyaSa(60)).toBe(12);
    expect(rangeIndexFromMadhyaSa(84)).toBe(36);
    expect(midiFromRangeIndex(0)).toBe(48);
    expect(midiFromRangeIndex(36)).toBe(84);
  });
});

describe("planPitchTransition", () => {
  it("splits s → s' as ¼ departure and ¾ arrival at half volume", () => {
    const pts = planPitchTransition(60, 72);
    expect(pts[0]).toEqual({ frac: 0, midi: 60, gainMul: 1 });
    expect(pts[1]).toEqual({ frac: TRANSITION_SPLIT, midi: 60, gainMul: 1 });
    expect(pts[2]).toEqual({ frac: TRANSITION_SPLIT, midi: 72, gainMul: GRAVITY_GAIN });
    expect(pts[3]).toEqual({ frac: 1, midi: 72, gainMul: GRAVITY_GAIN });
  });

  it("quiets the destination on a descending leap as well", () => {
    const pts = planPitchTransition(72, 60);
    expect(pts[2]?.midi).toBe(60);
    expect(pts[2]?.gainMul).toBe(GRAVITY_GAIN);
  });

  it("stages volume across a multi-note via path", () => {
    const pts = planPitchTransition(60, 67, [64]);
    const dest = pts.filter((p) => p.midi === 67);
    expect(dest.length).toBeGreaterThan(0);
    expect(dest[dest.length - 1]!.gainMul).toBeCloseTo(GRAVITY_GAIN);
    const mid = pts.find((p) => p.midi === 64);
    expect(mid?.gainMul).toBeGreaterThan(GRAVITY_GAIN);
    expect(mid?.gainMul).toBeLessThan(1);
  });

  it("holds when from and to are the same pitch", () => {
    const pts = planPitchTransition(60, 60);
    expect(pts.every((p) => p.midi === 60 && p.gainMul === 1)).toBe(true);
  });
});

describe("scalePitchesBetween", () => {
  it("lists raga swaras between s and s' in ascent", () => {
    const pc = [0, 2, 4, 5, 7, 9, 11];
    expect(scalePitchesBetween(60, 72, pc)).toEqual([62, 64, 65, 67, 69, 71]);
  });
});

describe("planNotes traversal", () => {
  it("treats sA' after s as a leap from madhya Sa to tara Sa", () => {
    const song = parse(
      [
        "Layout: Gitam",
        "Tala: Adi",
        "DefaultSpeed: 0",
        "Language: English",
        "S: s sA'",
        "L: sa saa",
        "",
      ].join("\n"),
    );
    const notes = planNotes(song, undefined, 1);
    expect(notes).toHaveLength(2);
    expect(notes[0]!.midi).toBe(60);
    expect(notes[1]!.midi).toBe(72);
    expect(notes[1]!.fromMidi).toBe(60);
    expect(notes[1]!.endSec - notes[1]!.startSec).toBeCloseTo(2, 5);
    const dest = notes[1]!.waypoints.filter((w) => w.midi === 72);
    expect(dest[0]!.frac).toBeCloseTo(TRANSITION_SPLIT);
    expect(dest[0]!.gainMul).toBe(GRAVITY_GAIN);
  });
});
