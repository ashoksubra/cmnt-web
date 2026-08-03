import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse, ParseException } from "@cmnt/core/CmntParser";
import { angaBreakdown, fromPredefinedName } from "@cmnt/core/Talas";
import { Heading } from "@cmnt/model/Heading";
import { SongBlock } from "@cmnt/model/SongBlock";

const fixtures = resolve(import.meta.dirname, "../fixtures");

describe("Talas", () => {
  it("resolves Adi / Eka / Rupaka", () => {
    const adi = fromPredefinedName("Adi", "krithi")!;
    expect(adi.aksharaCount).toBe(8);
    expect(angaBreakdown(adi)).toBe("L+D+D");

    const eka = fromPredefinedName("eka", "krithi")!;
    expect(eka.aksharaCount).toBe(4);
    expect(eka.name).toBe("Eka");

    const rupaka = fromPredefinedName("Rupaka", "krithi")!;
    expect(rupaka.aksharaCount).toBe(3);
    expect(angaBreakdown(rupaka)).toBe("A+D");
  });
});

describe("CmntParser", () => {
  it("parses smoke_adi fixture", () => {
    const text = readFileSync(resolve(fixtures, "smoke_adi.txt"), "utf8");
    const song = parse(text);
    expect(song.tala.name).toBe("Adi");
    expect(song.defaultSpeed).toBe(0);
    expect(song.effectiveDefaultSpeed).toBe(2); // krithi: +2
    expect(song.blockCount()).toBe(1);
    expect(song.swaraCount()).toBe(8);
    const block = song.parts.find((p) => p instanceof SongBlock) as SongBlock;
    expect(block.heading).toBe("1)");
    expect(block.notations[0]!.swara.label.toLowerCase()).toBe("s");
    expect(block.notations[0]!.lyrics[0]).toBe("sa");
    expect(block.notations[7]!.swara.octave).toBe(1);
  });

  it("parses maha_ganapatim sample", () => {
    const text = readFileSync(resolve(fixtures, "maha_ganapatim.txt"), "utf8");
    const song = parse(text);
    expect(song.tala.name).toBe("Eka");
    expect(song.tala.aksharaCount).toBe(4);
    expect(song.blockCount()).toBeGreaterThan(5);
    expect(song.swaraCount()).toBeGreaterThan(100);
    // Title is first non-empty Heading; Tala: often inserts "Talam : …" first
    // (same as JAR). Assert the real title heading is present in the song.
    const headings = song.parts
      .filter((p): p is Heading => p instanceof Heading)
      .map((h) => h.text.toLowerCase());
    expect(headings.some((t) => t.includes("ganapatim"))).toBe(true);
    expect(song.phraseEndsStyle).toBe("hide");
  });

  it("reports line numbers on invalid swara", () => {
    const bad = "Tala: Adi\nS: s r xyz m\n";
    try {
      parse(bad);
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ParseException);
      expect((e as ParseException).line).toBe(2);
    }
  });
});
