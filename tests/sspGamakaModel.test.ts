import { describe, expect, it } from "vitest";
import {
  SSP_GAMAKAS,
  formatGamakaPath,
  parsePhrase,
  planGamaka,
  type GamakaModelRequest,
} from "@cmnt/core/SspGamakaModel";

const SANKARABHARANAM = 29;
const MAYAMALAVAGOWLA = 15;

function req(over: Partial<GamakaModelRequest> = {}): GamakaModelRequest {
  return {
    id: "kampita",
    melakarta: SANKARABHARANAM,
    swara: "s",
    octave: 0,
    direction: "arohana",
    span: 1,
    aksharas: 2,
    bpm: 60,
    tonicMidi: 60,
    ...over,
  };
}

function line(over: Partial<GamakaModelRequest> = {}): number[] {
  const c = planGamaka(req(over));
  return c.points.map((p) => p.pitches[0]! - c.tonicMidi);
}

describe("SSP gamaka catalogue", () => {
  it("lists the Pradarsini gamakas, including the splits Dikshitar notates", () => {
    expect(SSP_GAMAKAS.map((g) => g.name)).toEqual([
      "Kampita",
      "Lina",
      "Andolita",
      "Plavita",
      "Sphurita",
      "Pratyaghata",
      "Nokku",
      "Ravai",
      "Khandippu",
      "Vali",
      "Etra jaru",
      "Irakka jaru",
      "Humpita",
      "Odukkal",
      "Orikkai",
      "Tribhinna",
      "Mudrita",
      "Namita",
      "Misrita",
    ]);
  });

  it("plans every gamaka inside its span and keeps time moving forward", () => {
    for (const g of SSP_GAMAKAS) {
      const c = planGamaka(req({ id: g.id, span: 99, swara: "g", aksharas: 4 }));
      expect(c.span).toBeGreaterThanOrEqual(g.minSpan);
      expect(c.span).toBeLessThanOrEqual(g.maxSpan);
      expect(c.durationSec).toBeCloseTo(4);
      expect(c.points.length).toBeGreaterThan(1);
      expect(c.points[0]!.sec).toBeCloseTo(0);
      expect(c.points[c.points.length - 1]!.sec).toBeCloseTo(c.durationSec);
      for (let i = 1; i < c.points.length; i++) {
        expect(c.points[i]!.sec).toBeGreaterThanOrEqual(c.points[i - 1]!.sec - 1e-9);
      }
    }
  });
});

describe("scale and shruti", () => {
  it("climbs Sankarabharanam by scale steps, not chromatically", () => {
    const c = planGamaka(req({ id: "etraJaru", span: 4, aksharas: 4 }));
    expect(line({ id: "etraJaru", span: 4, aksharas: 4 })).toEqual([0, 2, 4, 5, 7]);
    expect(formatGamakaPath(c.path, SANKARABHARANAM)).toBe("S – R2 – G3 – M1 – P");
  });

  it("uses Mayamalavagowla's ri and ga", () => {
    const c = planGamaka(
      req({ id: "etraJaru", melakarta: MAYAMALAVAGOWLA, span: 2, aksharas: 2 }),
    );
    expect(c.points.map((p) => p.pitches[0]! - 60)).toEqual([0, 1, 4]);
    expect(formatGamakaPath(c.path, MAYAMALAVAGOWLA)).toBe("S – R1 – G3");
  });

  it("shifts the whole contour with the requested shruti", () => {
    const a = planGamaka(req({ id: "etraJaru", span: 2, tonicMidi: 60 }));
    const b = planGamaka(req({ id: "etraJaru", span: 2, tonicMidi: 62 }));
    expect(b.points.map((p) => p.pitches[0])).toEqual(a.points.map((p) => p.pitches[0]! + 2));
  });

  it("treats aksharakalas as the duration of the whole gesture", () => {
    expect(planGamaka(req({ aksharas: 2, bpm: 60 })).durationSec).toBeCloseTo(2);
    expect(planGamaka(req({ aksharas: 4, bpm: 120 })).durationSec).toBeCloseTo(2);
  });
});

describe("gamaka shapes", () => {
  it("keeps kampita on the svara, short of the next scale note", () => {
    const c = planGamaka(req({ id: "kampita", swara: "g", aksharas: 2 }));
    const midis = c.points.map((p) => p.pitches[0]!);
    const center = 60 + 4;
    const next = 60 + 5;
    expect(Math.min(...midis)).toBeGreaterThanOrEqual(center - 0.05);
    expect(Math.max(...midis)).toBeLessThan(next - 0.05);
    expect(c.points.length).toBeGreaterThan(8);
  });

  it("swings andolita onto the neighbour", () => {
    const c = planGamaka(req({ id: "andolita", swara: "g", aksharas: 1, direction: "arohana" }));
    expect(Math.max(...c.points.map((p) => p.pitches[0]!))).toBeCloseTo(60 + 5);
    expect(c.points[0]!.pitches[0]).toBeCloseTo(60 + 4);
    expect(c.points[c.points.length - 1]!.pitches[0]).toBeCloseTo(60 + 4);
  });

  it("sounds the lower note between the two sphurita strikes", () => {
    const rel = line({ id: "sphurita", swara: "s" });
    expect(rel[0]).toBeCloseTo(0);
    expect(rel).toContain(-1);
    expect(rel[rel.length - 1]).toBeCloseTo(0);
    const c = planGamaka(req({ id: "sphurita" }));
    const lowerAt = c.points.find((p) => Math.abs(p.pitches[0]! - 59) < 0.01)!;
    expect(lowerAt.sec).toBeGreaterThan(0.7);
    expect(lowerAt.slide).toBe(false);
  });

  it("lets pratyaghata speak the upper note quietly", () => {
    const c = planGamaka(req({ id: "pratyaghata", swara: "s" }));
    const upper = c.points.find((p) => Math.abs(p.pitches[0]! - 62) < 0.01)!;
    expect(upper.gain).toBeLessThan(0.5);
    expect(c.points[c.points.length - 1]!.pitches[0]).toBeCloseTo(60);
  });

  it("descends khandippu through the scale and slides only into the last note", () => {
    const c = planGamaka(req({ id: "khandippu", swara: "p", span: 3 }));
    expect(formatGamakaPath(c.path, SANKARABHARANAM)).toBe("P – M1 – G3");
    const attacks = c.points.filter((p) => p.sec < c.durationSec - 0.01);
    expect(attacks.map((p) => p.slide)).toEqual([false, false, true]);
  });

  it("returns vali and odukkal to the note they start on", () => {
    const vali = planGamaka(req({ id: "vali", swara: "d", span: 1 }));
    expect(vali.points[0]!.pitches[0]).toBeCloseTo(60 + 9);
    expect(vali.points[vali.points.length - 1]!.pitches[0]).toBeCloseTo(60 + 9);
    expect(Math.max(...vali.points.map((p) => p.pitches[0]!))).toBeCloseTo(60 + 11);

    const odukkal = planGamaka(req({ id: "odukkal", swara: "r", span: 1 }));
    expect(formatGamakaPath(odukkal.path, SANKARABHARANAM)).toBe("R2 – G3 – R2");
  });

  it("pushes orikkai down onto the chosen swara", () => {
    const c = planGamaka(req({ id: "orikkai", swara: "s", span: 2 }));
    expect(formatGamakaPath(c.path, SANKARABHARANAM)).toBe("G3 – R2 – S");
  });

  it("sounds tribhinna as the note, a fifth, and the octave below", () => {
    const c = planGamaka(req({ id: "tribhinna", swara: "g" }));
    expect(c.points[0]!.pitches).toEqual([64, 71, 52]);
  });

  it("joins misrita at the arrival of the first gamaka", () => {
    const c = planGamaka(
      req({
        id: "misrita",
        mixA: "etraJaru",
        mixB: "kampita",
        span: 1,
        aksharas: 2,
        bpm: 60,
      }),
    );
    expect(c.durationSec).toBeCloseTo(2);
    expect(formatGamakaPath(c.path, SANKARABHARANAM)).toBe("S – R2");
    const atJoin = c.points.find((p) => Math.abs(p.sec - 1) < 1e-3)!;
    expect(atJoin.pitches[0]).toBeCloseTo(62);
    expect(c.points[c.points.length - 1]!.pitches[0]).toBeGreaterThan(61);
    expect(c.points[c.points.length - 1]!.pitches[0]).toBeLessThan(64);
  });
});

describe("note group", () => {
  it("reads at most eight swaras, with stayi marks", () => {
    const parsed = parsePhrase("s r g m p d n s' r'", 0);
    expect(parsed.truncated).toBe(true);
    expect(parsed.notes).toHaveLength(8);
    expect(parsed.notes[7]).toEqual({ letter: "s", octave: 1 });
    expect(parsePhrase("n. s", 0).notes).toEqual([
      { letter: "n", octave: -1 },
      { letter: "s", octave: 0 },
    ]);
  });

  it("glides a jaru through the named notes and the scale degrees between them", () => {
    const c = planGamaka(
      req({
        id: "etraJaru",
        phrase: [
          { letter: "s", octave: 0 },
          { letter: "p", octave: 0 },
        ],
      }),
    );
    expect(formatGamakaPath(c.path, SANKARABHARANAM)).toBe("S – R2 – G3 – M1 – P");
  });

  it("keeps eight named notes in order, including the upper Sa", () => {
    const notes = parsePhrase("s r g m p d n s'", 0).notes;
    const c = planGamaka(req({ id: "nokku", phrase: notes, direction: "arohana" }));
    expect(formatGamakaPath(c.path, SANKARABHARANAM)).toBe("N3. – S – R2 – G3 – M1 – P – D2 – N3 – S'");
  });

  it("puts kampita on each note of the group", () => {
    const c = planGamaka(
      req({
        id: "kampita",
        aksharas: 3,
        phrase: [
          { letter: "s", octave: 0 },
          { letter: "r", octave: 0 },
          { letter: "g", octave: 0 },
        ],
      }),
    );
    expect(formatGamakaPath(c.path, SANKARABHARANAM)).toBe("S – R2 – G3");
    expect(c.points[0]!.pitches[0]).toBeCloseTo(60);
    const atGa = c.points.find((p) => Math.abs(p.sec - 2) < 1e-3)!;
    expect(atGa.pitches[0]).toBeCloseTo(64);
  });

  it("uses Mayamalavagowla pitches for a named phrase", () => {
    const c = planGamaka(
      req({
        id: "khandippu",
        melakarta: MAYAMALAVAGOWLA,
        phrase: [
          { letter: "p", octave: 0 },
          { letter: "m", octave: 0 },
          { letter: "g", octave: 0 },
        ],
      }),
    );
    expect(formatGamakaPath(c.path, MAYAMALAVAGOWLA)).toBe("P – M1 – G3");
  });
});
