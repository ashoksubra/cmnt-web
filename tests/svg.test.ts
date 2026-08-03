import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "@cmnt/core/CmntParser";
import { layoutSong } from "@cmnt/core/Layout";
import { renderScoreSvg } from "@cmnt/render/SvgScore";

const fixtures = resolve(import.meta.dirname, "../fixtures");

function renderFixture(name: string): string {
  const text = readFileSync(resolve(fixtures, name), "utf8");
  const song = parse(text);
  return renderScoreSvg(layoutSong(song));
}

describe("renderScoreSvg", () => {
  it("renders well-formed SVG for smoke_adi with swara text", () => {
    const svg = renderFixture("smoke_adi.txt");

    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
    expect(svg).toContain('class="cmnt-score"');
    expect(svg).toContain('class="cmnt-swara"');
    expect(svg).toContain(">s<");
    expect(svg).toContain('class="cmnt-heading"');
  });

  it("renders marker cells for smoke_rupaka", () => {
    const svg = renderFixture("smoke_rupaka.txt");

    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
    expect(svg).toContain('class="cmnt-marker"');
    expect(svg).toMatch(/class="cmnt-marker"[^>]*>\|</);
  });

  it("renders octave markers, lyrics, and multiple rows for maha_ganapatim", () => {
    const svg = renderFixture("maha_ganapatim.txt");

    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
    expect(svg).toContain('class="cmnt-octave"');
    expect(svg).toContain('class="cmnt-lyric"');
    // Two "||" markers means at least two occurrences of the marker text.
    const markerCount = (svg.match(/class="cmnt-marker"/g) ?? []).length;
    expect(markerCount).toBeGreaterThan(1);
  });

  it("escapes special XML characters in text content", () => {
    const song = parse('Heading: "Tom & Jerry <live>"\nTala: Adi\nS: s r g m\n');
    const svg = renderScoreSvg(layoutSong(song));

    expect(svg).toContain("Tom &amp; Jerry &lt;live&gt;");
    expect(svg).not.toContain("<live>");
  });

  it("scales row width to fit a custom contentWidth", () => {
    const text = readFileSync(resolve(fixtures, "maha_ganapatim.txt"), "utf8");
    const song = parse(text);
    const items = layoutSong(song);

    const narrow = renderScoreSvg(items, { contentWidth: 400 });
    expect(narrow).toContain('width="496"');
  });
});
