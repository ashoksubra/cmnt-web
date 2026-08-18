import { describe, expect, it } from "vitest";
import { parse, ParseException } from "@cmnt/core/CmntParser";
import { SongBlock } from "@cmnt/model/SongBlock";
import { Fraction } from "@cmnt/model/Fraction";

const gitamHeader = ["Layout: Gitam", "Tala: Adi", "DefaultSpeed: 0", "Language: English"];

describe("live S:/L: typing", () => {
  it("does not throw on a short lyric line while the caret is still on that pair", () => {
    const text = [...gitamHeader, "S: s r g m p", "L: sa ri", ""].join("\n");
    const song = parse(text, { live: true, caretLine: 6 });
    expect(song.parseWarnings.length).toBeGreaterThan(0);
    expect(song.parseWarnings[0]!.severity).toBe("hint");
    expect(song.parseWarnings[0]!.message).toMatch(/add lyrics for: g m p/i);
  });

  it("flags a mismatch as an error once the caret has moved to the next pair", () => {
    const text = [...gitamHeader, "S: s r g m", "L: sa ri", "S: p d n s", "L: pa da ni sa", ""].join("\n");
    const song = parse(text, { live: true, caretLine: 7 });
    const hard = song.parseWarnings.filter((w) => w.severity === "error");
    expect(hard.length).toBeGreaterThan(0);
    expect(hard[0]!.message).toMatch(/add lyrics for: g m/i);
  });

  it("ignores tala bars on the lyric line", () => {
    const text = [...gitamHeader, "S: s r g m | p d n s", "L: sa ri ga ma | pa da ni sa", ""].join("\n");
    const song = parse(text);
    expect(song.parseWarnings).toEqual([]);
    const block = song.parts.find((p) => p instanceof SongBlock) as SongBlock;
    expect(block.notations.filter((n) => !n.swara.pause).length).toBeGreaterThanOrEqual(8);
  });

  it("still throws in strict parse when lyrics do not match", () => {
    const text = [...gitamHeader, "S: s r g m", "L: sa ri", ""].join("\n");
    expect(() => parse(text)).toThrow(ParseException);
  });
});

describe("gamaka cluster duration", () => {
  it("counts a cluster as one lyric slot and fills one parent beat", () => {
    const text = [
      ...gitamHeader,
      "S: s { sA r s r s r s }(~)",
      "L: sa ri",
      "",
    ].join("\n");
    const song = parse(text);
    const block = song.parts.find((p) => p instanceof SongBlock) as SongBlock;
    const notes = block.notations.map((n) => n.swara);
    expect(notes[0]!.label.toLowerCase()).toBe("s");
    expect(notes[1]!.clusterStart).toBe(true);
    expect(notes[notes.length - 1]!.clusterEnd).toBe(true);

    const gati = 4;
    const parent = notes[0]!.duration(gati);
    let cluster = Fraction.ZERO;
    for (const sw of notes.slice(1)) cluster = cluster.add(sw.duration(gati));
    expect(cluster.equals(parent)).toBe(true);

    const sa = notes[1]!;
    const short = notes[2]!;
    expect(sa.label.toLowerCase()).toBe("sa");
    expect(sa.length).toBe(2);
    expect(sa.duration(gati).doubleValue()).toBeCloseTo(parent.doubleValue() / 4, 8);
    expect(short.duration(gati).doubleValue()).toBeCloseTo(parent.doubleValue() / 8, 8);
  });
});
