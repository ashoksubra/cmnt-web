/**
 * Browser canvas FontMetrics-style cell widths for SvgScore (JAR NotationCanvas
 * measureCellWidths equivalent). Natural width is the max of duration-weighted
 * estimate and measured swara/lyric glyph width.
 *
 * Also exposes per-glyph advance + ink box so octave dots can sit on the
 * letter (the same micro-widths typewriters used for character cells).
 */
import type { Cell } from "@cmnt/core/Layout";
import type { Script } from "@cmnt/core/Translit";
import { transliterate, transliterateSwara } from "@cmnt/core/Translit";
import {
  defaultMeasureCellWidth,
  type CellWidthMeasurer,
  type GlyphMeasurer,
  type GlyphMetrics,
} from "@cmnt/render/SvgScore";

const BLANK = new Set(["", ".", "-", "_", " "]);

export function createCanvasMetrics(opts: {
  forceScript?: Script;
  swaraFont?: string;
  lyricFont?: string;
  swaraSize?: number;
  lyricSize?: number;
}): { measureCellWidth: CellWidthMeasurer; measureGlyph: GlyphMeasurer } {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const swaraFont =
    opts.swaraFont ??
    (opts.forceScript
      ? '"Noto Sans Tamil", "Noto Sans Telugu", "Noto Sans Kannada", Georgia, serif'
      : 'Georgia, "Times New Roman", serif');
  const lyricFont = opts.lyricFont ?? swaraFont;
  const swaraSize = opts.swaraSize ?? 16;
  const lyricSize = opts.lyricSize ?? 13;

  const glyphCache = new Map<string, GlyphMetrics>();
  const measureGlyph: GlyphMeasurer = (text, role) => {
    if (ctx == null || text === "") return null;
    if (role === "lyric") ctx.font = `400 ${lyricSize * 1.05}px ${lyricFont}`;
    else if (role === "gamaka") ctx.font = `400 ${Math.round(swaraSize * 0.7)}px ${swaraFont}`;
    else ctx.font = `600 ${swaraSize}px ${swaraFont}`;
    const key = `${ctx.font}\0${text}`;
    const hit = glyphCache.get(key);
    if (hit) return hit;
    const metrics = readGlyphMetrics(ctx, text);
    glyphCache.set(key, metrics);
    return metrics;
  };

  if (ctx == null) {
    return { measureCellWidth: defaultMeasureCellWidth, measureGlyph };
  }

  const measureCellWidth: CellWidthMeasurer = (c: Cell, unitWidthScale: number): number => {
    const durBased = defaultMeasureCellWidth(c, unitWidthScale);
    if (c.kind !== "swara" || c.text === "") return durBased;

    const script = opts.forceScript !== undefined ? opts.forceScript : null;
    const swaraDisplay = transliterateSwara(c.text, script);
    const swaraBox = measureGlyph(swaraDisplay, "swara");
    let w = (swaraBox?.advance ?? 0) + 6;

    for (let li = 0; li < c.lyrics.length; li++) {
      const lyric = c.lyrics[li]!;
      if (BLANK.has(lyric)) continue;
      const wordStart = li < c.lyricWordStart.length ? c.lyricWordStart[li]! : true;
      const display = script != null ? transliterate(lyric, script, wordStart) : lyric;
      const box = measureGlyph(display, "lyric");
      w = Math.max(w, (box?.advance ?? 0) + 8);
    }
    return Math.max(durBased, w);
  };

  return { measureCellWidth, measureGlyph };
}

export function createCanvasCellMeasurer(opts: {
  forceScript?: Script;
  swaraFont?: string;
  lyricFont?: string;
  swaraSize?: number;
  lyricSize?: number;
}): CellWidthMeasurer {
  return createCanvasMetrics(opts).measureCellWidth;
}

function readGlyphMetrics(ctx: CanvasRenderingContext2D, text: string): GlyphMetrics {
  const tm = ctx.measureText(text);
  const left = Number.isFinite(tm.actualBoundingBoxLeft) ? tm.actualBoundingBoxLeft : 0;
  const right = Number.isFinite(tm.actualBoundingBoxRight) ? tm.actualBoundingBoxRight : tm.width;
  return {
    advance: tm.width,
    inkMin: -left,
    inkMax: right,
  };
}
