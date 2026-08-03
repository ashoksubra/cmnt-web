import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { preprocess } from "@cmnt/core/YamlFrontMatter";
import { parse, ParseException } from "@cmnt/core/CmntParser";
import { Heading } from "@cmnt/model/Heading";

const fixtures = resolve(import.meta.dirname, "../fixtures");

describe("YamlFrontMatter.preprocess", () => {
  it("leaves classic directive-style files (no leading ---) unchanged", () => {
    const text = "Tala: Adi\nS: s r g m\n";
    expect(preprocess(text)).toBe(text);
  });

  it("translates a small --- header into classic directives", () => {
    const text = [
      "---",
      "title: Endaro Mahanubhavulu",
      "composer: Tyagaraja",
      "raga: Sri",
      "tala: Adi",
      "speed: 2",
      "language: Tamil",
      "",
      "style:",
      "  swara: { color: blue, size: 13 }",
      "  lyric: { color: black, size: 13 }",
      "---",
      "",
      "S: s r g m",
      "L: sa ri ga ma",
      "",
    ].join("\n");

    const out = preprocess(text);
    const lines = out.split("\n");
    expect(lines).toContain('Heading: "Endaro Mahanubhavulu",bold,center,20,tamil');
    expect(lines).toContain('Heading: "Tyagaraja",italic,center,16,tight,tamil');
    expect(lines).toContain("Raagam: Sri");
    expect(lines).toContain("Tala: Adi");
    expect(lines).toContain("DefaultSpeed: 2");
    expect(lines).toContain("Language: Tamil");
    expect(lines).toContain("SwaraPrefs: blue,13");
    expect(lines).toContain("LyricPrefs: black,13");
    expect(out).toContain("S: s r g m");
  });

  it("parses the translated output end-to-end via CmntParser", () => {
    const text = ["---", "title: Test Song", "tala: Adi", "speed: 0", "---", "S: s r g m", "L: sa ri ga ma", ""].join(
      "\n",
    );
    const song = parse(text);
    expect(song.tala.name).toBe("Adi");
    expect(song.defaultSpeed).toBe(0);
    const headings = song.parts.filter((p): p is Heading => p instanceof Heading);
    expect(headings.some((h) => h.text === "Test Song")).toBe(true);
  });

  it("rejects an unrecognized top-level key with a clear error", () => {
    const text = ["---", "titel: Typo", "tala: Adi", "---", "S: s", ""].join("\n");
    expect(() => parse(text)).toThrow(ParseException);
  });

  it("parses the Sankachakra fixture (real-world --- + nested style/layout)", () => {
    const text = readFileSync(resolve(fixtures, "sankachakra.txt"), "utf8");
    const song = parse(text);
    expect(song.tala.name.toLowerCase()).toBe("rupaka");
    expect(song.language).toBe("tamil");
    expect(song.cyclesPerRow).toBe(2);
    expect(song.defaultSpeed).toBe(0);
    expect(song.title).toContain("Sangkha cakra gadA pANim");
    expect(song.blockCount()).toBeGreaterThan(5);
  });
});
