import { describe, expect, it } from "vitest";
import { parse } from "@cmnt/core/CmntParser";
import {
  planNotes,
  parseDynMark,
  extractRagaMapping,
  clampPlaybackSpeed,
  phraseSeparatorGapSec,
  clampBpm,
  clampTonicMidi,
  DEFAULT_BPM,
  DEFAULT_TONIC_MIDI,
  INSTRUMENTS,
  instrumentById,
} from "@cmnt/core/Playback";

describe("parseDynMark", () => {
  it("pulls volume tags out of gamaka text", () => {
    expect(parseDynMark("v3")).toEqual({ volumeLevel: 3, gamaka: null });
    expect(parseDynMark("~~v2")).toEqual({ volumeLevel: 2, gamaka: "~~" });
    expect(parseDynMark("~")).toEqual({ volumeLevel: null, gamaka: "~" });
  });
});

describe("planNotes", () => {
  it("plans pitched notes for a short Adi line", () => {
    const song = parse(
      ["Tala: Adi", "DefaultSpeed: 0", "Language: English", "S: s r g m", "L: sa ri ga ma", ""].join("\n"),
    );
    const notes = planNotes(song);
    expect(notes.length).toBeGreaterThanOrEqual(4);
    expect(notes[0]!.midi).toBe(DEFAULT_TONIC_MIDI); // Sa = middle C
    expect(notes.every((n) => n.endSec > n.startSec)).toBe(true);
  });

  it("shifts Sa when tonicMidi is set", () => {
    const song = parse(
      ["Tala: Adi", "DefaultSpeed: 0", "Language: English", "S: s r g m", "L: sa ri ga ma", ""].join("\n"),
    );
    const atC = planNotes(song, undefined, 1);
    const atD = planNotes(song, undefined, 1, 62);
    expect(atC[0]!.midi).toBe(60);
    expect(atD[0]!.midi).toBe(62);
    expect(atD[1]!.midi - atC[1]!.midi).toBe(2);
    expect(clampTonicMidi(12)).toBe(36);
    expect(clampTonicMidi(90)).toBe(84);
    expect(clampTonicMidi(Number.NaN)).toBe(DEFAULT_TONIC_MIDI);
  });

  it("uses melakarta variants when Melakarta is set", () => {
    const song = parse(
      [
        "Melakarta: 15",
        "Tala: Adi",
        "DefaultSpeed: 0",
        "S: s r g m",
        "L: . . . .",
        "",
      ].join("\n"),
    );
    expect(song.melakarta).toBe(15);
    const notes = planNotes(song);
    // Mayamalavagowla: R1=1, G3=4, M1=5 → midi 61, 64, 65
    expect(notes.map((n) => n.midi)).toEqual([60, 61, 64, 65]);
  });

  it("holds each pitched note until the next note starts (no gap)", () => {
    const song = parse(
      [
        "Layout: Gitam",
        "Tala: Adi",
        "DefaultSpeed: 0",
        "Language: English",
        "S: s r g m",
        "L: sa ri ga ma",
        "",
      ].join("\n"),
    );
    const notes = planNotes(song, undefined, 1);
    expect(notes).toHaveLength(4);
    for (let i = 0; i < notes.length - 1; i++) {
      expect(notes[i]!.endSec).toBeCloseTo(notes[i + 1]!.startSec, 8);
    }
  });

  it("extends a note through karvai , and ; until the next pitch", () => {
    const song = parse(
      [
        "Layout: Gitam",
        "Tala: Adi",
        "DefaultSpeed: 0",
        "Language: English",
        "S: s , r ; g",
        "L: sa - ri - ga",
        "",
      ].join("\n"),
    );
    const notes = planNotes(song, undefined, 1);
    expect(notes).toHaveLength(3);
    expect(notes[0]!.endSec - notes[0]!.startSec).toBeCloseTo(2, 5);
    expect(notes[1]!.endSec - notes[1]!.startSec).toBeCloseTo(3, 5);
    expect(notes[0]!.endSec).toBeCloseTo(notes[1]!.startSec, 8);
    expect(notes[1]!.endSec).toBeCloseTo(notes[2]!.startSec, 8);
  });

  it("leaves a micro-pause after a phrase-end hyphen without shifting tala", () => {
    const song = parse(
      [
        "Layout: Gitam",
        "Tala: Adi",
        "DefaultSpeed: 0",
        "Language: English",
        "S: s r- g m",
        "L: sa ri ga ma",
        "",
      ].join("\n"),
    );
    const beat = 1;
    const notes = planNotes(song, undefined, beat);
    expect(notes).toHaveLength(4);
    expect(notes[0]!.endSec).toBeCloseTo(notes[1]!.startSec, 8);
    const gap = notes[2]!.startSec - notes[1]!.endSec;
    expect(gap).toBeCloseTo(phraseSeparatorGapSec(beat, notes[1]!.endSec - notes[1]!.startSec), 8);
    expect(gap).toBeGreaterThan(0.03);
    expect(notes[2]!.startSec).toBeCloseTo(2, 5);
    expect(notes[3]!.startSec).toBeCloseTo(3, 5);
  });
});

describe("extractRagaMapping", () => {
  it("reads R2/G3 style tokens from an Aro heading", () => {
    const song = parse(
      [
        'Heading: "Aro: S R2 G3 M1 P D2 N3 S\' - Ava: S\' N3 D2 P M1 G3 R2 S",center,12',
        "Tala: Adi",
        "DefaultSpeed: 0",
        "S: s r",
        "L: . .",
        "",
      ].join("\n"),
    );
    const map = extractRagaMapping(song);
    expect(map.get("r")).toBe(2);
    expect(map.get("g")).toBe(4);
  });
});

describe("instruments and speed", () => {
  it("lists the JAR-style instrument set", () => {
    expect(INSTRUMENTS.map((i) => i.id)).toEqual(["shehnai", "flute", "violin", "sitar", "piano"]);
    expect(instrumentById("violin").label).toBe("Violin");
    expect(instrumentById("unknown").id).toBe("shehnai");
  });

  it("clamps playback speed to a safe slider range", () => {
    expect(clampPlaybackSpeed(1)).toBe(1);
    expect(clampPlaybackSpeed(0.1)).toBe(0.4);
    expect(clampPlaybackSpeed(9)).toBe(2.5);
  });

  it("scales note timing from BPM (1 akshara = 1 beat)", () => {
    // Layout: Gitam keeps DefaultSpeed 0 as 1 note/akshara (no krithi +2 shift).
    const song = parse(
      [
        "Layout: Gitam",
        "Tala: Adi",
        "DefaultSpeed: 0",
        "Language: English",
        "S: s r",
        "L: sa ri",
        "",
      ].join("\n"),
    );
    const at60 = planNotes(song, undefined, 60 / DEFAULT_BPM);
    const at120 = planNotes(song, undefined, 60 / 120);
    expect(at60[0]!.endSec - at60[0]!.startSec).toBeCloseTo(1, 5);
    expect(at120[0]!.endSec - at120[0]!.startSec).toBeCloseTo(0.5, 5);
    expect(clampBpm(12)).toBe(20);
    expect(clampBpm(300)).toBe(240);
    expect(clampBpm(72.4)).toBe(72);
  });
});
