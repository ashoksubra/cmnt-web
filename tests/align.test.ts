import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { Cell, VisualRow } from "@cmnt/core/Layout";
import { Fraction } from "@cmnt/model/Fraction";
import { alignSection, renderScoreSvg } from "@cmnt/render/SvgScore";
import { parse } from "@cmnt/core/CmntParser";
import { layoutSong } from "@cmnt/core/Layout";

const fixtures = resolve(import.meta.dirname, "../fixtures");

function marker(text: string): Cell {
  const c = new Cell();
  c.kind = "marker";
  c.text = text;
  return c;
}

function swara(text: string, duration: Fraction): Cell {
  const c = new Cell();
  c.kind = "swara";
  c.text = text;
  c.duration = duration;
  c.lyrics = [];
  c.lyricWordStart = [];
  return c;
}

function row(cells: Cell[]): VisualRow {
  const r = new VisualRow();
  r.cells = cells;
  return r;
}

describe("alignSection", () => {
  it("gives matching rows in a Rupaka-style (1+2 anga) section the same column widths", () => {
    // Row A: || s | s s   (drutam split as two 1-akshara swaras)
    const rowA = row([
      marker("||"),
      swara("s", Fraction.ONE),
      marker("|"),
      swara("r", Fraction.ONE),
      swara("g", Fraction.ONE),
    ]);
    // Row B: || s | s     (same durations, drutam as a single 2-akshara swara)
    const rowB = row([marker("||"), swara("s", Fraction.ONE), marker("|"), swara("r", new Fraction(2, 1))]);

    const targetWidth = 900;
    const aligned = alignSection([rowA, rowB], targetWidth);
    const wa = aligned.get(rowA)!;
    const wb = aligned.get(rowB)!;

    // anudrutam content span (index 1 in both rows): single 1-akshara swara.
    const anudrutamA = wa[1]!;
    const anudrutamB = wb[1]!;
    expect(anudrutamA).toBeCloseTo(anudrutamB, 6);

    // drutam content span (2 aksharas, split across 2 cells in row A, 1 in row B).
    const drutamA = wa[3]! + wa[4]!;
    const drutamB = wb[3]!;
    expect(drutamA).toBeCloseTo(drutamB, 6);

    // Duration-proportional: drutam (2 aksharas) is ~2x anudrutam (1 akshara).
    expect(drutamA / anudrutamA).toBeCloseTo(2, 1);

    // Each row's cells fill exactly the target width (markers + both content spans).
    expect(wa.reduce((a, b) => a + b, 0)).toBeCloseTo(targetWidth, 1);
    expect(wb.reduce((a, b) => a + b, 0)).toBeCloseTo(targetWidth, 1);
  });

  it("does not stretch a gap-only trailing span after the final ||", () => {
    const gap = new Cell();
    gap.kind = "gap";
    const withTrailingGap = row([marker("||"), swara("s", Fraction.ONE), marker("||"), gap]);
    const aligned = alignSection([withTrailingGap], 900);
    const widths = aligned.get(withTrailingGap)!;
    // Trailing gap span keeps its tiny natural width instead of claiming leftover budget.
    expect(widths[3]!).toBeLessThan(20);
  });
});

describe("section-aligned rendering doesn't throw on real fixtures", () => {
  it("renders maha_ganapatim with section alignment enabled by default", () => {
    const text = readFileSync(resolve(fixtures, "maha_ganapatim.txt"), "utf8");
    const song = parse(text);
    const items = layoutSong(song);
    expect(() => renderScoreSvg(items, { contentWidth: 1100 })).not.toThrow();
  });

  it("renders smoke_rupaka with markers surviving alignment", () => {
    const text = readFileSync(resolve(fixtures, "smoke_rupaka.txt"), "utf8");
    const song = parse(text);
    const items = layoutSong(song);
    const svg = renderScoreSvg(items, { contentWidth: 1100 });
    expect(svg).toContain('class="cmnt-marker"');
  });
});
