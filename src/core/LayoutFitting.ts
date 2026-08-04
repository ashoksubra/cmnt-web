/**
 * Width-aware layout fitting — JAR NotationCanvas.layoutFittingLetter parity.
 *
 * Packs as many tala cycles as requested, then drops one cycle at a time until
 * the aligned column grid fits `targetWidth` (or only one cycle remains).
 *
 * Mid-row cell wrapping is intentionally NOT applied here: short continuation
 * rows get stretched to full width by anga alignment and look like orphaned /
 * scattered swara–sahithya pairs (see Test.pdf regression). Swara and sahithya
 * already share each {@link Cell}; cycle-boundary row breaks keep them paired.
 */
import { Song } from "../model/Song.js";
import { VisualRow, layoutSong, type LayoutItem } from "./Layout.js";
import {
  alignAllSections,
  defaultMeasureCellWidth,
  type CellWidthMeasurer,
} from "../render/SvgScore.js";

const MAX_CYCLES = 4;

export type LayoutFittingOptions = {
  /** Usable row width in px (content width minus row-label gutter). */
  targetWidth: number;
  unitWidthScale?: number;
  measureCellWidth?: CellWidthMeasurer;
  /**
   * Optional last-resort wrap at cell boundaries when even 1 cycle overflows.
   * Off by default — enabling it recreates the stretched-fragment PDF bug.
   */
  wrapOverflowRows?: boolean;
};

function copyRow(src: VisualRow, cells: VisualRow["cells"], keepHeading: boolean): VisualRow {
  const r = new VisualRow();
  r.cells = cells;
  r.blockHeading = keepHeading ? src.blockHeading : null;
  r.language = src.language;
  r.font = src.font;
  r.swaraFontSize = src.swaraFontSize;
  r.lyricFontSize = src.lyricFontSize;
  r.swaraColor = src.swaraColor;
  r.lyricColor = src.lyricColor;
  r.swaraFont = src.swaraFont;
  r.lyricFont = src.lyricFont;
  r.swaraBold = src.swaraBold;
  r.lyricBold = src.lyricBold;
  r.gamakaFontSize = src.gamakaFontSize;
  r.gamakaColor = src.gamakaColor;
  r.rowSpacing = src.rowSpacing;
  r.cellSpacing = src.cellSpacing;
  return r;
}

/**
 * Split one visual row into multiple rows that each fit `targetWidth`, breaking
 * only at cell boundaries (preferring after `|` / `||` markers). Each cell keeps
 * its swara text and lyric syllables together.
 *
 * Prefer {@link layoutSongFitting} without wrapping; this helper is for tests /
 * explicit opt-in only.
 */
export function wrapVisualRowToWidth(
  row: VisualRow,
  targetWidth: number,
  unitWidthScale = 1,
  measure: CellWidthMeasurer = defaultMeasureCellWidth,
): VisualRow[] {
  if (row.cells.length === 0) return [row];
  const widths = row.cells.map((c) => measure(c, unitWidthScale));
  const total = widths.reduce((a, b) => a + b, 0);
  if (total <= targetWidth + 0.5) return [row];

  const out: VisualRow[] = [];
  let i = 0;
  let first = true;
  while (i < row.cells.length) {
    if (!first) {
      while (i < row.cells.length && row.cells[i]!.kind === "gap") i++;
      if (i >= row.cells.length) break;
    }

    let used = 0;
    let end = i;
    let breakAfter = -1;
    while (end < row.cells.length) {
      const w = widths[end]!;
      if (end > i && used + w > targetWidth + 0.5) break;
      used += w;
      end++;
      if (row.cells[end - 1]!.kind === "marker") {
        let br = end;
        if (br < row.cells.length && row.cells[br]!.kind === "gap") br++;
        breakAfter = br;
      }
    }
    if (end === i) end = i + 1;
    else if (breakAfter > i && end < row.cells.length) end = breakAfter;

    out.push(copyRow(row, row.cells.slice(i, end), first));
    i = end;
    first = false;
  }
  return out.length > 0 ? out : [row];
}

/** Apply {@link wrapVisualRowToWidth} to every VisualRow in a layout list. */
export function wrapLayoutItemsToWidth(
  items: LayoutItem[],
  targetWidth: number,
  unitWidthScale = 1,
  measure: CellWidthMeasurer = defaultMeasureCellWidth,
): LayoutItem[] {
  const out: LayoutItem[] = [];
  for (const it of items) {
    if (it instanceof VisualRow) {
      out.push(...wrapVisualRowToWidth(it, targetWidth, unitWidthScale, measure));
    } else {
      out.push(it);
    }
  }
  return out;
}

/** Max sum of natural cell widths across VisualRows (pre-scale). */
export function maxNaturalRowWidth(
  items: LayoutItem[],
  unitWidthScale = 1,
  measure: CellWidthMeasurer = defaultMeasureCellWidth,
): number {
  let max = 0;
  for (const it of items) {
    if (!(it instanceof VisualRow)) continue;
    let sum = 0;
    for (const c of it.cells) sum += measure(c, unitWidthScale);
    max = Math.max(max, sum);
  }
  return max;
}

function alignedMaxWidth(
  items: LayoutItem[],
  targetWidth: number,
  unitWidthScale: number,
  measure: CellWidthMeasurer,
): number {
  const aligned = alignAllSections(items, targetWidth, unitWidthScale, measure);
  let maxW = 0;
  for (const cw of aligned.values()) {
    let sum = 0;
    for (const w of cw) sum += w;
    maxW = Math.max(maxW, sum);
  }
  return maxW;
}

/**
 * Lay out a song packing as many cycles as requested, then reduce cycles until
 * the aligned grid fits `targetWidth` (JAR layoutFittingLetter).
 */
export function layoutSongFitting(song: Song, options: LayoutFittingOptions): LayoutItem[] {
  const targetWidth = Math.max(50, options.targetWidth);
  const unitWidthScale = options.unitWidthScale ?? 1;
  const measure = options.measureCellWidth ?? defaultMeasureCellWidth;
  const userCycles = song.cyclesPerRow;
  const startN =
    userCycles != null ? Math.max(1, Math.min(userCycles, MAX_CYCLES)) : MAX_CYCLES;

  let best: LayoutItem[] | null = null;
  for (let n = startN; n >= 1; n--) {
    song.cyclesPerRow = n;
    let items = layoutSong(song);
    if (options.wrapOverflowRows) {
      items = wrapLayoutItemsToWidth(items, targetWidth, unitWidthScale, measure);
    }
    best = items;
    if (alignedMaxWidth(items, targetWidth, unitWidthScale, measure) <= targetWidth + 0.5) {
      break;
    }
  }

  song.cyclesPerRow = userCycles;
  return best ?? layoutSong(song);
}
