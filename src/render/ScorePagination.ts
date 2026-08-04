/**
 * Letter-page pagination for PDF/print: keep VisualRows intact, and never leave a
 * section heading alone as the last line on a page (move it with the following row).
 */
import type { Heading } from "../model/Heading.js";
import {
  VisualBreak,
  VisualHeading,
  VisualPageBreak,
  VisualRow,
  type LayoutItem,
} from "../core/Layout.js";

/** Letter @ 96dpi. */
export const LETTER_PAGE_WIDTH_PX = Math.round(8.5 * 96); // 816
export const LETTER_PAGE_HEIGHT_PX = Math.round(11 * 96); // 1056
export const LETTER_MARGIN_X = 48;
export const LETTER_MARGIN_Y = 48;
/** Content width inside side margins (matches prior LETTER_CONTENT_WIDTH). */
export const LETTER_CONTENT_WIDTH = LETTER_PAGE_WIDTH_PX - 2 * LETTER_MARGIN_X; // 720
/** Usable vertical space for score items (inside top/bottom margins). */
export const LETTER_CONTENT_HEIGHT = LETTER_PAGE_HEIGHT_PX - 2 * LETTER_MARGIN_Y; // 960

export type PaginationOptions = {
  /** Max content height per page (default Letter content height). */
  pageContentHeight?: number;
  rowSpacingScale?: number;
};

function stripWiky(s: string): string {
  return s.replace(/\*/g, "").replace(/_/g, " ").replace(/\[br\]/g, "  ");
}

/** Height used by a heading block (mirrors SvgScore.renderHeading spacing). */
export function estimateHeadingHeight(h: Heading): number {
  const sizeNum = parseFloat(h.fontSize) || 13;
  const size = sizeNum + 2;
  const raw = stripWiky(h.text).trim();
  if (raw === "") return size * 0.9 + 4;
  // Ragam/talam + Aro/Ava is often two lines once formatted.
  const nLines = Math.max(1, raw.split(/\n/).length);
  const looksRagam = /^(Ragam|Talam)\s*:/i.test(raw) || h.role === "ragamTalam";
  const lines = looksRagam ? Math.max(nLines, raw.includes("\n") ? nLines : 2) : nLines;
  return lines * size * 1.25 + 10;
}

/** Height used by one VisualRow (mirrors SvgScore.renderRow). */
export function estimateRowHeight(row: VisualRow, rowSpacingScale = 1): number {
  const swaraSize = parseFloat(row.swaraFontSize ?? "") || 15;
  const lyricSize = parseFloat(row.lyricFontSize ?? "") || 12;
  const gamakaSize = parseFloat(row.gamakaFontSize ?? "") || 10;
  let maxLyricLines = 1;
  for (const c of row.cells) {
    if (c.kind === "swara") maxLyricLines = Math.max(maxLyricLines, Math.max(1, c.lyrics.length));
  }
  const octaveGap = Math.max(4, swaraSize * 0.22);
  const gamakaGap = Math.max(3, swaraSize * 0.12);
  const swaraToLyric = Math.max(swaraSize, lyricSize) * 2.0;
  const lyricLineHeight = lyricSize * 1.4;
  const topClearance = swaraSize + octaveGap + gamakaSize + gamakaGap * 2 + 8;
  const bottomClearance = swaraToLyric + lyricSize + (maxLyricLines - 1) * lyricLineHeight;
  const rowBottomPad = Math.min(
    Math.max(6, lyricSize * 0.35) * row.rowSpacing * rowSpacingScale,
    Math.max(swaraSize, lyricSize) * 1.5,
  );
  return topClearance + bottomClearance + rowBottomPad;
}

export function estimateItemHeight(item: LayoutItem, rowSpacingScale = 1): number {
  if (item instanceof VisualHeading) return estimateHeadingHeight(item.heading);
  if (item instanceof VisualBreak) return 22;
  if (item instanceof VisualPageBreak) return 0; // forces a page boundary
  return estimateRowHeight(item, rowSpacingScale);
}

function isSectionHeading(item: LayoutItem): boolean {
  if (!(item instanceof VisualHeading)) return false;
  const t = stripWiky(item.heading.text).trim();
  if (t === "") return false;
  // Title/composer/ragam lines can start a page alone; section labels like "pallavi:"
  // must stay with the following notation row.
  if (item.heading.role === "ragamTalam") return false;
  if (item.heading.alignment === "center" && !t.endsWith(":")) return false;
  return t.endsWith(":") || /^(pallavi|anupallavi|caraNam|charanam|madyama|madhyama|citta|swara)/i.test(t);
}

function nextKeepWith(items: LayoutItem[], from: number): LayoutItem | null {
  for (let j = from; j < items.length; j++) {
    const it = items[j]!;
    if (it instanceof VisualPageBreak) return null;
    if (it instanceof VisualBreak) continue;
    if (it instanceof VisualHeading) {
      const t = stripWiky(it.heading.text).trim();
      if (t === "") continue;
      // Another real heading — don't pull a later row across it.
      return null;
    }
    if (it instanceof VisualRow) return it;
  }
  return null;
}

/**
 * Split layout items into pages. Never splits a VisualRow. Section titles that
 * would land alone at the bottom of a page are moved to the next page with their
 * following notation row.
 */
export function paginateLayoutItems(items: LayoutItem[], options: PaginationOptions = {}): LayoutItem[][] {
  const pageH = options.pageContentHeight ?? LETTER_CONTENT_HEIGHT;
  const rowSpacingScale = options.rowSpacingScale ?? 1;
  const pages: LayoutItem[][] = [];
  let current: LayoutItem[] = [];
  let used = 0;

  const flush = (): void => {
    if (current.length === 0) return;
    pages.push(current);
    current = [];
    used = 0;
  };

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    if (item instanceof VisualPageBreak) {
      flush();
      continue;
    }

    const h = estimateItemHeight(item, rowSpacingScale);
    let need = h;
    if (isSectionHeading(item)) {
      const keep = nextKeepWith(items, i + 1);
      if (keep != null) need += estimateItemHeight(keep, rowSpacingScale);
    }

    if (current.length > 0 && used + need > pageH + 0.5) {
      flush();
    }

    // Single item taller than a page: still place it alone (no split).
    current.push(item);
    used += h;
  }
  flush();
  return pages.length > 0 ? pages : [[]];
}
