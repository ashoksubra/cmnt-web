import { describe, expect, it } from "vitest";
import { parse } from "@cmnt/core/CmntParser";
import { layoutSong, VisualRow } from "@cmnt/core/Layout";
import {
  fromPredefinedName,
  isChapuTala,
  notationSpeedShift,
} from "@cmnt/core/Talas";

function cycleSegs(name: string): number[] {
  const t = fromPredefinedName(name, null)!;
  const segs = t.layoutRows[0]!.segments.map((s) => s.nAksharas);
  const ak = t.aksharaCount;
  const one: number[] = [];
  let sum = 0;
  for (const n of segs) {
    one.push(n);
    sum += n;
    if (sum >= ak) break;
  }
  return one;
}

function markerIndexes(name: string): number[] {
  return fromPredefinedName(name, null)!.parts.map((p) => p.index);
}

describe("Chapu talas (cApu anga = 3)", () => {
  it("accepts misrachApu / Misra Chapu aliases", () => {
    for (const name of ["misrachApu", "misracApu", "MisraCapu", "Misra Chapu", "misra_chapu"]) {
      const t = fromPredefinedName(name, null);
      expect(t, name).not.toBeNull();
      expect(t!.aksharaCount).toBe(7);
      expect(t!.predefName).toBe("MisraChapu");
      expect(isChapuTala(t)).toBe(true);
    }
  });

  it("uses beat-as-akshara speeds (no krithi +2 shift)", () => {
    expect(notationSpeedShift("krithi", fromPredefinedName("MisraCapu", null))).toBe(0);
    expect(notationSpeedShift("krithi", fromPredefinedName("Adi", null))).toBe(2);
    expect(notationSpeedShift("gitam", fromPredefinedName("Adi", null))).toBe(0);
  });

  it("Khanda Chapu is 3|2 (cApu + 2); viloma is 2|3", () => {
    expect(cycleSegs("KhandaCapu")).toEqual([3, 2]);
    expect(markerIndexes("KhandaCapu")).toEqual([0, 3]);
    expect(cycleSegs("VilomaKhandaCapu")).toEqual([2, 3]);
    expect(markerIndexes("VilomaKhandaCapu")).toEqual([0, 2]);
  });

  it("Misra Chapu is 3|4 (cApu + drutam); viloma is 4|3", () => {
    expect(cycleSegs("MisraCapu")).toEqual([3, 4]);
    expect(markerIndexes("MisraCapu")).toEqual([0, 3]);
    expect(cycleSegs("VilomaMisraCapu")).toEqual([4, 3]);
    expect(markerIndexes("VilomaMisraCapu")).toEqual([0, 4]);
  });

  it("Sankirna Chapu is 3|2|4; viloma is 2|4|3", () => {
    expect(cycleSegs("SankirnaCapu")).toEqual([3, 2, 4]);
    expect(markerIndexes("SankirnaCapu")).toEqual([0, 3, 5]);
    expect(fromPredefinedName("SankirnaCapu", null)!.aksharaCount).toBe(9);
    expect(cycleSegs("VilomaSankirnaCapu")).toEqual([2, 4, 3]);
    expect(markerIndexes("VilomaSankirnaCapu")).toEqual([0, 2, 6]);
    expect(fromPredefinedName("sankeernaCapu", null)?.predefName).toBe("SankirnaChapu");
  });

  it("fills one Misra avartanam with 7 first-speed notes and a bar after cApu", () => {
    const song = parse(
      [
        "Tala: misrachApu",
        "DefaultSpeed: 0",
        "Language: English",
        "S: s r g m p d n",
        "L: ta ki ta ta ka di mi",
        "",
      ].join("\n"),
    );
    expect(song.effectiveDefaultSpeed).toBe(0);
    expect(song.tala.aksharaCount).toBe(7);

    const rows = layoutSong(song).filter((it): it is VisualRow => it instanceof VisualRow);
    expect(rows.length).toBeGreaterThan(0);
    const texts = rows[0]!.cells.map((c) =>
      c.kind === "swara" || c.kind === "marker" ? c.text : c.kind,
    );
    const markerAt = texts.findIndex((t) => t === "|");
    expect(markerAt).toBeGreaterThan(0);
    const beforeBar = texts.slice(0, markerAt).filter((t) => /^[srgmpdn]$/.test(t));
    const afterBar = texts.slice(markerAt + 1).filter((t) => /^[srgmpdn]$/.test(t));
    expect(beforeBar).toEqual(["s", "r", "g"]);
    expect(afterBar).toEqual(["m", "p", "d", "n"]);
  });
});
