import { describe, expect, it } from "vitest";
import { parse } from "@cmnt/core/CmntParser";
import { planNotes } from "@cmnt/core/Playback";
import {
  parseGamakaPattern,
  ragaGamakaTable,
  lookupGamakaPattern,
  swaraStayiKey,
  SANKARABHARANAM_GAMAKAS,
} from "@cmnt/core/RagaGamakas";

describe("parseGamakaPattern", () => {
  it("reads sA gr as long sa then ga ri", () => {
    const atoms = parseGamakaPattern("sA gr");
    expect(atoms).toEqual([
      { kind: "pitch", letter: "s", octave: 0, length: 2 },
      { kind: "pitch", letter: "g", octave: 0, length: 1 },
      { kind: "pitch", letter: "r", octave: 0, length: 1 },
    ]);
  });

  it("reads n oscillation and tara sa with karvai", () => {
    expect(parseGamakaPattern("s' n s' n").map((a) => `${a.letter ?? ","}${a.octave}`)).toEqual([
      "s1",
      "n0",
      "s1",
      "n0",
    ]);
    const land = parseGamakaPattern("p sA' ,");
    expect(land[0]).toMatchObject({ letter: "p", length: 1, octave: 0 });
    expect(land[1]).toMatchObject({ letter: "s", length: 2, octave: 1 });
    expect(land[2]).toMatchObject({ kind: "sustain", length: 1 });
  });
});

describe("Sankarabharanam table", () => {
  it("is registered as melakarta 29", () => {
    expect(ragaGamakaTable(29)).toBe(SANKARABHARANAM_GAMAKAS);
    expect(SANKARABHARANAM_GAMAKAS.aroha.r).toBe("sA gr");
    expect(SANKARABHARANAM_GAMAKAS.aroha.g).toBe("g r gA");
    expect(SANKARABHARANAM_GAMAKAS.aroha["s'"]).toBe("p sA' ,");
    expect(SANKARABHARANAM_GAMAKAS.avaroha).toEqual({});
  });

  it("uses aroha r when approaching from below", () => {
    const pat = lookupGamakaPattern(SANKARABHARANAM_GAMAKAS, {
      letter: "r",
      octave: 0,
      prevLetter: "s",
      prevOctave: 0,
      nextLetter: "g",
      nextOctave: 0,
      fromMidi: 60,
      midi: 62,
    });
    expect(pat).toBe("sA gr");
    expect(swaraStayiKey("s", 1)).toBe("s'");
  });
});

describe("planNotes raga library", () => {
  it("expands Sankarabharanam aroha ri as sA gr inside the parent beat", () => {
    const song = parse(
      [
        "Layout: Gitam",
        "Raagam: Sankarabharanam",
        "Tala: Adi",
        "DefaultSpeed: 0",
        "Language: English",
        "S: s r g",
        "L: sa ri ga",
        "",
      ].join("\n"),
    );
    expect(song.melakarta).toBe(29);
    const notes = planNotes(song, undefined, 1);
    expect(notes).toHaveLength(3);
    const ri = notes[1]!;
    expect(ri.letter).toBe("r");
    const midis = [...new Set(ri.waypoints.map((w) => w.midi))];
    expect(midis).toContain(60);
    expect(midis).toContain(64);
    expect(midis).toContain(62);
    expect(ri.endSec - ri.startSec).toBeCloseTo(1, 5);
  });

  it("leaves avaroha unmarked notes on the ¼/¾ leap until that set is filled", () => {
    const song = parse(
      [
        "Layout: Gitam",
        "Melakarta: 29",
        "Tala: Adi",
        "DefaultSpeed: 0",
        "S: s' n d",
        "L: sa ni da",
        "",
      ].join("\n"),
    );
    const notes = planNotes(song, undefined, 1);
    const ni = notes[1]!;
    expect(ni.fromMidi).toBe(72);
    expect(ni.midi).toBe(71);
    const dest = ni.waypoints.filter((w) => w.midi === 71);
    expect(dest[0]!.frac).toBeCloseTo(0.25);
  });

  it("does not override a written gamaka cluster", () => {
    const song = parse(
      [
        "Layout: Gitam",
        "Raagam: Sankarabharanam",
        "Tala: Adi",
        "DefaultSpeed: 0",
        "S: s { r g r }(kh) m",
        "L: sa ri ma",
        "",
      ].join("\n"),
    );
    const notes = planNotes(song, undefined, 1);
    const cluster = notes.filter((n) => n.skipLibrary);
    expect(cluster.length).toBeGreaterThanOrEqual(2);
  });
});
