/**
 * Pure layout-items -> SVG string renderer (Path A, Iteration 2 MVP).
 *
 * Deliberately simplified vs. the desktop JAR's `NotationCanvas` (see
 * `CMNT-Notation-Studio-source/src/cmnt/ui/NotationCanvas.java`): no font-metric
 * measurement (Graphics2D isn't available outside a browser/canvas), so cell
 * widths are estimated from akshara duration plus fixed widths for markers/gaps.
 * Visual styling (colors, fonts, sizes) is left to CSS custom properties on the
 * root `.cmnt-score` element so themes can be swapped without re-rendering.
 */
import type { Cell, LayoutItem, VisualRow } from "../core/Layout.js";
import { VisualBreak, VisualHeading, VisualPageBreak } from "../core/Layout.js";
import type { Heading } from "../model/Heading.js";

export type SvgScoreOptions = {
  /** Usable content width (excluding side margins), in px. */
  contentWidth?: number;
  /** Left/right page margin, in px. */
  marginX?: number;
  /** Top page margin, in px. */
  marginTop?: number;
};

const DEFAULT_CONTENT_WIDTH = 1100;
const DEFAULT_MARGIN_X = 48;
const DEFAULT_MARGIN_TOP = 32;

/** Fixed gutter reserved for row labels like "1)" so columns start at the same x. */
const ROW_LABEL_GUTTER = 36;

/** Px-per-whole-akshara for swara cells (duration-weighted, no font metrics). */
const UNIT_WIDTH = 160;
const MIN_SWARA_WIDTH = 30;
const MARKER_WIDTH = 14;
const GAP_WIDTH = 10;
const GATI_WIDTH = 40;

const DEFAULT_SWARA_SIZE = 15;
const DEFAULT_LYRIC_SIZE = 12;
const DEFAULT_GAMAKA_SIZE = 10;

export function renderScoreSvg(items: LayoutItem[], options: SvgScoreOptions = {}): string {
  const contentWidth = options.contentWidth ?? DEFAULT_CONTENT_WIDTH;
  const marginX = options.marginX ?? DEFAULT_MARGIN_X;
  const marginTop = options.marginTop ?? DEFAULT_MARGIN_TOP;
  const usableWidth = Math.max(50, contentWidth - ROW_LABEL_GUTTER);
  const width = contentWidth + marginX * 2;

  const body: string[] = [];
  let y = marginTop;

  for (const item of items) {
    if (item instanceof VisualHeading) {
      const res = renderHeading(item.heading, marginX, contentWidth, y);
      if (res.svg) body.push(res.svg);
      y = res.nextY;
    } else if (item instanceof VisualBreak) {
      y += 8;
      body.push(
        `<line class="cmnt-break" x1="${fmt(marginX)}" y1="${fmt(y)}" x2="${fmt(marginX + contentWidth)}" y2="${fmt(y)}" />`,
      );
      y += 14;
    } else if (item instanceof VisualPageBreak) {
      y += 10;
      body.push(
        `<line class="cmnt-pagebreak-rule" x1="${fmt(marginX)}" y1="${fmt(y)}" x2="${fmt(marginX + contentWidth)}" y2="${fmt(y)}" />`,
      );
      body.push(
        `<text class="cmnt-pagebreak-label" x="${fmt(marginX + contentWidth / 2)}" y="${fmt(y - 4)}" text-anchor="middle">PAGE BREAK</text>`,
      );
      y += 22;
    } else {
      const res = renderRow(item, marginX, usableWidth, y);
      if (res.svg) body.push(res.svg);
      y = res.nextY;
    }
  }

  const height = Math.round(y + 40);
  const background = `<rect class="cmnt-page-bg" x="0" y="0" width="${width}" height="${height}" />`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" class="cmnt-score" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">\n` +
    background +
    "\n" +
    body.join("\n") +
    `\n</svg>\n`
  );
}

function stripWiky(s: string): string {
  return s.replace(/\*/g, "").replace(/_/g, " ").replace(/\[br\]/g, "  ");
}

function renderHeading(
  h: Heading,
  marginX: number,
  contentWidth: number,
  y: number,
): { svg: string; nextY: number } {
  const sizeNum = parseFloat(h.fontSize) || 13;
  const size = sizeNum + 2;
  const rawText = stripWiky(h.text).trim();
  if (rawText === "") {
    return { svg: "", nextY: y + size * 0.9 + 4 };
  }

  const styles: string[] = [`font-size:${fmt(size)}px`];
  if (h.bold) styles.push("font-weight:bold");
  if (h.italic) styles.push("font-style:italic");
  if (h.color) styles.push(`fill:${escapeAttr(h.color)}`);

  const anchor = h.alignment === "center" ? "middle" : h.alignment === "right" ? "end" : "start";
  const x =
    h.alignment === "center"
      ? marginX + contentWidth / 2
      : h.alignment === "right"
        ? marginX + contentWidth
        : marginX;

  const lines = rawText.split(/ {2,}|\n/);
  let ly = y + (h.tightAbove ? size * 0.55 : size);
  const parts: string[] = [];
  for (const line of lines) {
    parts.push(
      `<text class="cmnt-heading" x="${fmt(x)}" y="${fmt(ly)}" text-anchor="${anchor}" style="${styles.join(";")}">${escapeXml(line)}</text>`,
    );
    ly += size * 1.25;
  }
  return { svg: parts.join("\n"), nextY: ly + 4 };
}

function measureCellWidth(c: Cell): number {
  if (c.kind === "marker") return MARKER_WIDTH;
  if (c.kind === "gap") return GAP_WIDTH;
  if (c.kind === "gati") return GATI_WIDTH;
  return Math.max(MIN_SWARA_WIDTH, c.duration.doubleValue() * UNIT_WIDTH);
}

function renderSpeedBeam(
  x1: number,
  x2: number,
  baselineY: number,
  swaraSize: number,
  octaveGap: number,
  gamakaGap: number,
  gamakaSize: number,
  levels: number,
): string {
  const topY = baselineY - swaraSize - octaveGap - gamakaGap - gamakaSize - gamakaGap;
  const lines: string[] = [];
  for (let i = 0; i < levels; i++) {
    const ly = topY - i * 3;
    lines.push(
      `<line class="cmnt-speed-beam" x1="${fmt(x1)}" y1="${fmt(ly)}" x2="${fmt(x2)}" y2="${fmt(ly)}" />`,
    );
  }
  return lines.join("\n");
}

function renderClusterBracket(
  x1: number,
  x2: number,
  baselineY: number,
  swaraSize: number,
  octaveGap: number,
  gamakaGap: number,
): string {
  const bracketY = baselineY - swaraSize - octaveGap - gamakaGap * 0.5;
  const tick = Math.max(3, swaraSize * 0.15);
  return [
    `<line class="cmnt-cluster-bracket" x1="${fmt(x1)}" y1="${fmt(bracketY)}" x2="${fmt(x2)}" y2="${fmt(bracketY)}" />`,
    `<line class="cmnt-cluster-bracket" x1="${fmt(x1)}" y1="${fmt(bracketY)}" x2="${fmt(x1)}" y2="${fmt(bracketY + tick)}" />`,
    `<line class="cmnt-cluster-bracket" x1="${fmt(x2)}" y1="${fmt(bracketY)}" x2="${fmt(x2)}" y2="${fmt(bracketY + tick)}" />`,
  ].join("\n");
}

const BLANK_LYRICS = new Set(["", ".", "-", "_", " "]);

function renderRow(
  row: VisualRow,
  marginX: number,
  usableWidth: number,
  y: number,
): { svg: string; nextY: number } {
  const swaraSize = parseFloat(row.swaraFontSize ?? "") || DEFAULT_SWARA_SIZE;
  const lyricSize = parseFloat(row.lyricFontSize ?? "") || DEFAULT_LYRIC_SIZE;
  const gamakaSize = parseFloat(row.gamakaFontSize ?? "") || DEFAULT_GAMAKA_SIZE;

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
    Math.max(6, lyricSize * 0.35) * row.rowSpacing,
    Math.max(swaraSize, lyricSize) * 1.5,
  );
  const rowHeight = topClearance + bottomClearance + rowBottomPad;
  const baselineY = y + topClearance;

  const naturalWidths = row.cells.map(measureCellWidth);
  const totalNatural = naturalWidths.reduce((a, b) => a + b, 0);
  const scale = totalNatural > usableWidth && totalNatural > 0 ? usableWidth / totalNatural : 1;

  const parts: string[] = [];
  if (row.blockHeading != null && row.blockHeading !== "") {
    parts.push(
      `<text class="cmnt-block-heading" x="${fmt(marginX)}" y="${fmt(baselineY)}">${escapeXml(row.blockHeading)}</text>`,
    );
  }

  const swaraStyle = row.swaraColor ? ` style="fill:${escapeAttr(row.swaraColor)}"` : "";
  const lyricStyle = row.lyricColor ? ` style="fill:${escapeAttr(row.lyricColor)}"` : "";
  const gamakaStyle = row.gamakaColor ? ` style="fill:${escapeAttr(row.gamakaColor)}"` : "";

  let x = marginX + ROW_LABEL_GUTTER;
  let speedGroupStart = -1;
  let speedGroupEnd = -1;
  let speedGroupLevel = 0;
  let clusterStartX = -1;

  for (let i = 0; i < row.cells.length; i++) {
    const c = row.cells[i]!;
    const w = naturalWidths[i]! * scale;
    const cx = x + w / 2;

    if (c.kind === "swara") {
      const lvl = c.speedLines();
      if (lvl !== speedGroupLevel) {
        if (speedGroupLevel > 0) {
          parts.push(
            renderSpeedBeam(speedGroupStart, speedGroupEnd, baselineY, swaraSize, octaveGap, gamakaGap, gamakaSize, speedGroupLevel),
          );
        }
        if (lvl > 0) speedGroupStart = x;
        speedGroupLevel = lvl;
      }
      if (speedGroupLevel > 0) speedGroupEnd = x + w;
    }

    if (c.clusterStart) clusterStartX = x;

    if (c.kind === "marker") {
      parts.push(
        `<text class="cmnt-marker" x="${fmt(cx)}" y="${fmt(baselineY)}" text-anchor="middle">${escapeXml(c.text)}</text>`,
      );
    } else if (c.kind === "gati") {
      parts.push(
        `<text class="cmnt-gati" x="${fmt(cx)}" y="${fmt(baselineY - swaraSize - octaveGap - gamakaGap)}" text-anchor="middle">${escapeXml(c.text)}</text>`,
      );
    } else if (c.kind === "swara" && c.text !== "") {
      parts.push(
        `<text class="cmnt-swara"${swaraStyle} x="${fmt(cx)}" y="${fmt(baselineY)}" text-anchor="middle">${escapeXml(c.text)}</text>`,
      );

      if (c.octave !== 0) {
        const dotSize = Math.max(3, swaraSize * 0.22);
        const dotTopY = c.octave > 0 ? baselineY - swaraSize - octaveGap : baselineY + octaveGap * 0.4;
        parts.push(
          `<circle class="cmnt-octave" cx="${fmt(cx)}" cy="${fmt(dotTopY + dotSize / 2)}" r="${fmt(dotSize / 2)}" />`,
        );
      }

      if (c.gamaka != null && c.gamaka !== "") {
        parts.push(
          `<text class="cmnt-gamaka"${gamakaStyle} x="${fmt(cx)}" y="${fmt(baselineY - swaraSize - octaveGap - gamakaGap)}" text-anchor="middle">${escapeXml(c.gamaka)}</text>`,
        );
      }

      if (c.phraseEnd) {
        const tickX = x + w - 4;
        parts.push(
          `<line class="cmnt-phrase-tick" x1="${fmt(tickX)}" y1="${fmt(baselineY - 4)}" x2="${fmt(tickX)}" y2="${fmt(baselineY + 4)}" />`,
        );
      }

      for (let li = 0; li < maxLyricLines; li++) {
        const lyric = li < c.lyrics.length ? c.lyrics[li]! : "";
        if (BLANK_LYRICS.has(lyric)) continue;
        const lineY = baselineY + swaraToLyric + li * lyricLineHeight;
        parts.push(
          `<text class="cmnt-lyric"${lyricStyle} x="${fmt(cx)}" y="${fmt(lineY)}" text-anchor="middle">${escapeXml(lyric)}</text>`,
        );
      }
    }

    if (c.clusterEnd && clusterStartX >= 0) {
      parts.push(renderClusterBracket(clusterStartX, x + w, baselineY, swaraSize, octaveGap, gamakaGap));
      clusterStartX = -1;
    }

    x += w;
  }

  if (speedGroupLevel > 0) {
    parts.push(
      renderSpeedBeam(speedGroupStart, speedGroupEnd, baselineY, swaraSize, octaveGap, gamakaGap, gamakaSize, speedGroupLevel),
    );
  }

  return { svg: parts.join("\n"), nextY: y + rowHeight };
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeAttr(s: string): string {
  return escapeXml(s);
}
