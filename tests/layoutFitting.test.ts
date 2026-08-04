import { describe, expect, it } from "vitest";
import { Cell, VisualRow, layoutSong } from "@cmnt/core/Layout";
import {
  layoutSongFitting,
  maxNaturalRowWidth,
  wrapVisualRowToWidth,
} from "@cmnt/core/LayoutFitting";
import { Fraction } from "@cmnt/model/Fraction";
import { parse } from "@cmnt/core/CmntParser";
import { alignAllSections, defaultMeasureCellWidth } from "@cmnt/render/SvgScore";

function swara(text: string, lyric: string, duration = Fraction.ONE): Cell {
  const c = new Cell();
  c.kind = "swara";
  c.text = text;
  c.duration = duration;
  c.lyrics = [lyric];
  c.lyricWordStart = [true];
  return c;
}

function marker(text: string): Cell {
  const c = new Cell();
  c.kind = "marker";
  c.text = text;
  return c;
}

describe("wrapVisualRowToWidth", () => {
  it("moves swara and sahithya together when wrapping (no orphans)", () => {
    const measure = (c: Cell): number => (c.kind === "marker" ? 10 : 40);
    const row = new VisualRow();
    row.cells = [
      swara("s", "sa"),
      swara("r", "ri"),
      marker("|"),
      swara("g", "ga"),
      swara("m", "ma"),
      marker("||"),
    ];
    const parts = wrapVisualRowToWidth(row, 100, 1, measure);
    expect(parts.length).toBe(2);

    const firstLyrics = parts[0]!.cells.filter((c) => c.kind === "swara").map((c) => c.lyrics[0]);
    const firstSwara = parts[0]!.cells.filter((c) => c.kind === "swara").map((c) => c.text);
    expect(firstSwara).toEqual(["s", "r"]);
    expect(firstLyrics).toEqual(["sa", "ri"]);

    const secondLyrics = parts[1]!.cells.filter((c) => c.kind === "swara").map((c) => c.lyrics[0]);
    const secondSwara = parts[1]!.cells.filter((c) => c.kind === "swara").map((c) => c.text);
    expect(secondSwara).toEqual(["g", "m"]);
    expect(secondLyrics).toEqual(["ga", "ma"]);
  });
});

describe("layoutSongFitting", () => {
  it("reduces cyclesPerRow instead of mid-wrapping (avoids stretched fragments)", () => {
    const src = [
      "Raagam: Sri",
      "Tala: Adi",
      "Language: English",
      "DefaultSpeed: 0",
      "CyclesPerRow: 4",
      "S: s r g m p d n S s r g m p d n S",
      "L: sa ri ga ma pa da ni sa sa ri ga ma pa da ni sa",
      "",
    ].join("\n");
    const target = 700;
    const plain = layoutSong(parse(src));
    const fitted = layoutSongFitting(parse(src), {
      targetWidth: target,
      measureCellWidth: defaultMeasureCellWidth,
    });

    const plainRows = plain.filter((it) => it instanceof VisualRow).length;
    const fittedRows = fitted.filter((it) => it instanceof VisualRow).length;
    // Fewer cycles per row ⇒ more visual rows, without cell-level fragmentation.
    expect(fittedRows).toBeGreaterThanOrEqual(plainRows);
    expect(maxNaturalRowWidth(fitted)).toBeLessThanOrEqual(maxNaturalRowWidth(plain));

    const aligned = alignAllSections(fitted, target, 1, defaultMeasureCellWidth);
    for (const cw of aligned.values()) {
      const sum = cw.reduce((a, b) => a + b, 0);
      expect(sum).toBeLessThanOrEqual(target + 0.5);
    }

    // Every pitched swara cell still carries its lyric syllable.
    for (const it of fitted) {
      if (!(it instanceof VisualRow)) continue;
      for (const c of it.cells) {
        if (c.kind !== "swara" || c.text === "" || c.isSustain || c.isRest) continue;
        if (/^[srRgGmMpPdDnNsS]/.test(c.text)) {
          expect(c.lyrics.length).toBeGreaterThan(0);
          expect(c.lyrics[0]).not.toBe("");
        }
      }
    }
  });
});
