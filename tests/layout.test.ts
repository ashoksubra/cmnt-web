import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "@cmnt/core/CmntParser";
import { layoutSong } from "@cmnt/core/Layout";
import { dumpLayoutItems } from "@cmnt/core/dumpLayout";

const fixtures = resolve(import.meta.dirname, "../fixtures");
const goldens = resolve(fixtures, "goldens");

describe("layoutSong / dumpLayoutItems", () => {
  it("lays out smoke_adi with swara labels and octave markers", () => {
    const text = readFileSync(resolve(fixtures, "smoke_adi.txt"), "utf8");
    const song = parse(text);
    const items = layoutSong(song);
    const dump = dumpLayoutItems(items);

    // Adi's 8 swaras at speed 2 span only 2 aksharas out of the 8-akshara cycle,
    // so no anga marker is crossed in this particular fixture -- but the swara
    // text, duration, and octave-marker rendering are exercised here.
    expect(dump).toContain("HEAD:");
    expect(dump).toContain("BLOCK: 1)");
    expect(dump).toContain("s(d=");
    expect(dump).toContain("g(d=");
    expect(dump).toContain("s@1(d=");
  });

  it("matches the smoke_adi golden dump", () => {
    const text = readFileSync(resolve(fixtures, "smoke_adi.txt"), "utf8");
    const song = parse(text);
    const dump = dumpLayoutItems(layoutSong(song));
    const golden = readFileSync(resolve(goldens, "smoke_adi.layout.txt"), "utf8");
    expect(dump).toBe(golden);
  });

  it("lays out maha_ganapatim into multiple rows with markers", () => {
    const text = readFileSync(resolve(fixtures, "maha_ganapatim.txt"), "utf8");
    const song = parse(text);
    const items = layoutSong(song);
    const dump = dumpLayoutItems(items);

    const rowLines = dump.split("\n").filter((l) => l.startsWith("row"));
    expect(rowLines.length).toBeGreaterThan(1);
    expect(dump).toContain("[||]");
    expect(dump).toContain("s@1(d=");
    expect(dump).toContain("m(d=");
  });

  it("matches the maha_ganapatim golden dump", () => {
    const text = readFileSync(resolve(fixtures, "maha_ganapatim.txt"), "utf8");
    const song = parse(text);
    const dump = dumpLayoutItems(layoutSong(song));
    const golden = readFileSync(resolve(goldens, "maha_ganapatim.layout.txt"), "utf8");
    expect(dump).toBe(golden);
  });

  it("splits straddling dheergam across Rupaka | as note + ,", () => {
    const text = readFileSync(resolve(fixtures, "smoke_rupaka.txt"), "utf8");
    const dump = dumpLayoutItems(layoutSong(parse(text)));
    expect(dump).toContain("[|]");
    expect(dump).toContain("[||]");
    // s rI rI … → s rI r | , …
    expect(dump).toMatch(/s\(d=1\/4\) rI\(d=1\/2\) r\(d=1\/4\) _ \[\|\] _ ,\(d=1\/4\)/);
  });

  it("matches the smoke_rupaka golden dump", () => {
    const text = readFileSync(resolve(fixtures, "smoke_rupaka.txt"), "utf8");
    const dump = dumpLayoutItems(layoutSong(parse(text)));
    const golden = readFileSync(resolve(goldens, "smoke_rupaka.layout.txt"), "utf8");
    expect(dump).toBe(golden);
  });
});
