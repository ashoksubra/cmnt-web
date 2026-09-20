/**
 * Browser canvas FontMetrics-style cell widths for SvgScore (JAR NotationCanvas
 * measureCellWidths equivalent). Natural width is the measured swara/lyric glyph
 * width at the YAML (or school) font size, so sahityam can claim space.
 *
 * Also exposes per-glyph advance + ink box so octave dots can sit on the
 * letter (the same micro-widths typewriters used for character cells).
 */
import type { Cell, VisualRow } from "@cmnt/core/Layout";
import { Song } from "@cmnt/model/Song";
import { SongBlock } from "@cmnt/model/SongBlock";
import type { Script } from "@cmnt/core/Translit";
import { transliterate, transliterateSwara } from "@cmnt/core/Translit";
import {
  defaultMeasureCellWidth,
  cssFontFamily,
  type CellWidthMeasurer,
  type GlyphMeasurer,
  type GlyphMetrics,
} from "@cmnt/render/SvgScore";

const BLANK = new Set(["", ".", "-", "_", " "]);

const SCRIPT_STACK =
  '"Noto Sans Tamil", "Noto Sans Telugu", "Noto Sans Kannada", "Noto Sans", Georgia, serif';
const LATIN_STACK = 'Georgia, "Times New Roman", serif';

export type CanvasMetricOpts = {
  forceScript?: Script;
  swaraFont?: string;
  lyricFont?: string;
  swaraSize?: number;
  lyricSize?: number;
  swaraBold?: boolean;
  lyricBold?: boolean;
};

function canvasFamily(name: string | null | undefined, fallback: string): string {
  if (name == null || name.trim() === "") return fallback;
  return cssFontFamily(name);
}

/** Pull YAML/classic SwaraPrefs + LyricPrefs from the first notation block. */
export function typePrefsFromSong(song: Song): CanvasMetricOpts {
  const out: CanvasMetricOpts = {};
  for (const p of song.parts) {
    if (!(p instanceof SongBlock)) continue;
    if (p.swaraFont) out.swaraFont = p.swaraFont;
    if (p.lyricFont) out.lyricFont = p.lyricFont;
    const ss = parseFloat(p.swaraFontSize ?? "");
    const ls = parseFloat(p.lyricFontSize ?? "");
    if (Number.isFinite(ss) && ss > 0) out.swaraSize = ss;
    if (Number.isFinite(ls) && ls > 0) out.lyricSize = ls;
    if (p.swaraBold) out.swaraBold = true;
    if (p.lyricBold) out.lyricBold = true;
    break;
  }
  return out;
}

export function createCanvasMetrics(opts: CanvasMetricOpts): {
  measureCellWidth: CellWidthMeasurer;
  measureGlyph: GlyphMeasurer;
} {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const defaultSwaraFont =
    opts.swaraFont != null
      ? canvasFamily(opts.swaraFont, LATIN_STACK)
      : opts.forceScript
        ? SCRIPT_STACK
        : LATIN_STACK;
  const defaultLyricFont =
    opts.lyricFont != null ? canvasFamily(opts.lyricFont, defaultSwaraFont) : defaultSwaraFont;
  const defaultSwaraSize = opts.swaraSize ?? 16;
  const defaultLyricSize = opts.lyricSize ?? 13;

  const glyphCache = new Map<string, GlyphMetrics>();
  const measureAt = (
    text: string,
    font: string,
    sizePx: number,
    weight: number,
  ): GlyphMetrics | null => {
    if (ctx == null || text === "") return null;
    ctx.font = `${weight} ${sizePx}px ${font}`;
    const key = `${ctx.font}\0${text}`;
    const hit = glyphCache.get(key);
    if (hit) return hit;
    const metrics = readGlyphMetrics(ctx, text);
    glyphCache.set(key, metrics);
    return metrics;
  };

  const measureGlyph: GlyphMeasurer = (text, role) => {
    if (role === "lyric") {
      return measureAt(text, defaultLyricFont, defaultLyricSize * 1.15, opts.lyricBold ? 700 : 400);
    }
    if (role === "gamaka") {
      return measureAt(text, defaultSwaraFont, Math.round(defaultSwaraSize * 0.7), 400);
    }
    return measureAt(text, defaultSwaraFont, defaultSwaraSize, opts.swaraBold ? 700 : 600);
  };

  if (ctx == null) {
    return { measureCellWidth: defaultMeasureCellWidth, measureGlyph };
  }

  const measureCellWidth: CellWidthMeasurer = (c: Cell, unitWidthScale: number, row?: VisualRow): number => {
    if (c.kind !== "swara" || c.text === "") return defaultMeasureCellWidth(c, unitWidthScale);

    const swaraSize = parseFloat(row?.swaraFontSize ?? "") || defaultSwaraSize;
    const lyricSize = parseFloat(row?.lyricFontSize ?? "") || defaultLyricSize;
    const swaraFont = canvasFamily(row?.swaraFont, defaultSwaraFont);
    const lyricFont = canvasFamily(row?.lyricFont, defaultLyricFont);
    const swaraWeight = row?.swaraBold || opts.swaraBold ? 700 : 600;
    const lyricWeight = row?.lyricBold || opts.lyricBold ? 700 : 400;

    const script = opts.forceScript !== undefined ? opts.forceScript : null;
    const swaraDisplay = transliterateSwara(c.text, script);
    const swaraBox = measureAt(swaraDisplay, swaraFont, swaraSize, swaraWeight);
    // Glyph-only (not duration*UNIT_WIDTH) so packing can honor sahityam width
    // without treating a 160px duration slot as a glyph that must be capped.
    let w = (swaraBox?.advance ?? 0) + 6;

    const lyricPad = Math.max(8, lyricSize * 0.55);
    for (let li = 0; li < c.lyrics.length; li++) {
      const lyric = c.lyrics[li]!;
      if (BLANK.has(lyric)) continue;
      const wordStart = li < c.lyricWordStart.length ? c.lyricWordStart[li]! : true;
      const display = script != null ? transliterate(lyric, script, wordStart) : lyric;
      const box = measureAt(display, lyricFont, lyricSize * 1.15, lyricWeight);
      w = Math.max(w, (box?.advance ?? 0) + lyricPad);
    }
    return Math.max(w, 1);
  };

  return { measureCellWidth, measureGlyph };
}

export function createCanvasCellMeasurer(opts: CanvasMetricOpts): CellWidthMeasurer {
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
