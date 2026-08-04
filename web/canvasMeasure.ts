/**
 * Browser canvas FontMetrics-style cell widths for SvgScore (JAR NotationCanvas
 * measureCellWidths equivalent). Natural width is the max of duration-weighted
 * estimate and measured swara/lyric glyph width.
 */
import type { Cell } from "@cmnt/core/Layout";
import type { Script } from "@cmnt/core/Translit";
import { transliterate, transliterateSwara } from "@cmnt/core/Translit";
import { defaultMeasureCellWidth, type CellWidthMeasurer } from "@cmnt/render/SvgScore";

const BLANK = new Set(["", ".", "-", "_", " "]);

export function createCanvasCellMeasurer(opts: {
  forceScript?: Script;
  swaraFont?: string;
  lyricFont?: string;
  swaraSize?: number;
  lyricSize?: number;
}): CellWidthMeasurer {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (ctx == null) return defaultMeasureCellWidth;

  const swaraFont = opts.swaraFont ?? '"Noto Sans Tamil", "Noto Sans Telugu", Georgia, serif';
  const lyricFont = opts.lyricFont ?? swaraFont;
  const swaraSize = opts.swaraSize ?? 16;
  const lyricSize = opts.lyricSize ?? 13;

  return (c: Cell, unitWidthScale: number): number => {
    const durBased = defaultMeasureCellWidth(c, unitWidthScale);
    if (c.kind !== "swara" || c.text === "") return durBased;

    // UI forceScript covers the common case; Auto mode measures roman source
    // (slightly conservative for Indic glyphs until per-row script is threaded).
    const script = opts.forceScript !== undefined ? opts.forceScript : null;

    const swaraDisplay = transliterateSwara(c.text, script);
    ctx.font = `600 ${swaraSize}px ${swaraFont}`;
    let w = ctx.measureText(swaraDisplay).width + 6;

    ctx.font = `400 ${lyricSize * 1.05}px ${lyricFont}`;
    for (let li = 0; li < c.lyrics.length; li++) {
      const lyric = c.lyrics[li]!;
      if (BLANK.has(lyric)) continue;
      const wordStart = li < c.lyricWordStart.length ? c.lyricWordStart[li]! : true;
      const display = script != null ? transliterate(lyric, script, wordStart) : lyric;
      w = Math.max(w, ctx.measureText(display).width + 8);
    }
    return Math.max(durBased, w);
  };
}
