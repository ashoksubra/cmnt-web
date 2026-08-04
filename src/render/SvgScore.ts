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
import type { Script } from "../core/Translit.js";
import { scriptFor, transliterate, transliterateHeading, transliterateSwara } from "../core/Translit.js";
import {
  formatRagamTalamDisplay,
  looksLikeRagamTalamHeading,
  parseRagamTalamHeading,
  type RagamTalamDisplayOverrides,
} from "../core/RagamTalamDisplay.js";
import { Fraction } from "../model/Fraction.js";

export type SvgScoreOptions = {
  /** Usable content width (excluding side margins), in px. */
  contentWidth?: number;
  /** Left/right page margin, in px. */
  marginX?: number;
  /** Top page margin, in px. */
  marginTop?: number;
  /**
   * Override the auto-detected script (from each row/heading's `Language:`)
   * for every row/heading in the score -- e.g. for a live preview UI that
   * lets the user force Tamil/English regardless of the source's directives.
   */
  forceScript?: Script;
  /**
   * Multiplies the duration-based swara cell width (see `UNIT_WIDTH`). Lets
   * "school" presets (`src/theme/schools.ts`) request denser/looser column
   * spacing without changing the alignment algorithm. Default 1.
   */
  unitWidthScale?: number;
  /**
   * Multiplies each row's `rowSpacing` (vertical padding below the
   * lyric baseline) for the same density-preset purpose. Default 1.
   */
  rowSpacingScale?: number;
  /**
   * On-screen overrides for the combined Raagam/Taalam heading names.
   * When set, those name portions are used as-is (not re-transliterated) so
   * the user can correct imperfect automatic transliterations.
   */
  ragamTalamOverrides?: RagamTalamDisplayOverrides;
  /**
   * Optional cell-width function (e.g. browser canvas `measureText`) so columns
   * respect glyph width like the JAR's FontMetrics path. When omitted, widths
   * are duration-weighted estimates only.
   */
  measureCellWidth?: CellWidthMeasurer;
};

/** Measures one layout cell's natural width in px. */
export type CellWidthMeasurer = (cell: Cell, unitWidthScale: number) => number;

/** `Language: tamil:someFont` -> `"tamil"`; also handles null/undefined. */
function languageScript(language: string | null | undefined, forceScript: Script | undefined): Script {
  if (forceScript !== undefined) return forceScript;
  const base = language?.split(":")[0];
  return scriptFor(base);
}

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
  const unitWidthScale = options.unitWidthScale ?? 1;
  const rowSpacingScale = options.rowSpacingScale ?? 1;
  const measure = options.measureCellWidth ?? defaultMeasureCellWidth;
  const usableWidth = Math.max(50, contentWidth - ROW_LABEL_GUTTER);
  const width = contentWidth + marginX * 2;

  const alignedWidths = alignAllSections(items, usableWidth, unitWidthScale, measure);

  const body: string[] = [];
  let y = marginTop;

  for (const item of items) {
    if (item instanceof VisualHeading) {
      const res = renderHeading(
        item.heading,
        marginX,
        contentWidth,
        y,
        options.forceScript,
        options.ragamTalamOverrides,
      );
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
      const widths = alignedWidths.get(item) ?? item.cells.map((c) => measure(c, unitWidthScale));
      const res = renderRow(item, marginX, y, options.forceScript, widths, rowSpacingScale);
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
  forceScript: Script | undefined,
  ragamTalamOverrides?: RagamTalamDisplayOverrides,
): { svg: string; nextY: number } {
  const sizeNum = parseFloat(h.fontSize) || 13;
  const size = sizeNum + 2;
  let rawText = stripWiky(h.text).trim();
  if (rawText === "") {
    return { svg: "", nextY: y + size * 0.9 + 4 };
  }
  const script = languageScript(h.language, forceScript);
  const isRagamTalam =
    h.role === "ragamTalam" || (h.role == null && looksLikeRagamTalamHeading(rawText));
  if (isRagamTalam) {
    const parts = parseRagamTalamHeading(rawText);
    if (parts != null) {
      // Always run through the localized formatter (even for English) so label
      // wording stays consistent and name overrides apply.
      rawText = formatRagamTalamDisplay(parts, script, ragamTalamOverrides ?? {});
    } else if (script != null) {
      rawText = transliterateHeading(rawText, script);
    }
  } else if (script != null) {
    rawText = transliterateHeading(rawText, script);
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

export function defaultMeasureCellWidth(c: Cell, unitWidthScale = 1): number {
  if (c.kind === "marker") return MARKER_WIDTH;
  if (c.kind === "gap") return GAP_WIDTH;
  if (c.kind === "gati") return GATI_WIDTH;
  return Math.max(MIN_SWARA_WIDTH, c.duration.doubleValue() * UNIT_WIDTH * unitWidthScale);
}

/**
 * Section-aligned anga columns (ported from the JAR's
 * `NotationCanvas.alignSection`/`alignAllSections`). A "section" is a run of
 * consecutive `VisualRow`s uninterrupted by a heading/break/page-break.
 * Within a section, content columns at the same span index (between anga
 * markers) share a target width sized by total swara duration -- not forced
 * equal, so e.g. Rupaka's 1+2-akshara angas stay proportional instead of
 * bunching madhyamakalam into an equal-width column.
 */
type Span = { start: number; end: number; marker: boolean; width: number };

function splitSpans(row: VisualRow, cw: number[]): Span[] {
  const spans: Span[] = [];
  let i = 0;
  while (i < row.cells.length) {
    if (row.cells[i]!.kind === "marker") {
      spans.push({ start: i, end: i + 1, marker: true, width: cw[i]! });
      i++;
    } else {
      let j = i;
      let w = 0;
      while (j < row.cells.length && row.cells[j]!.kind !== "marker") {
        w += cw[j]!;
        j++;
      }
      spans.push({ start: i, end: j, marker: false, width: w });
      i = j;
    }
  }
  return spans;
}

/** Total akshara duration of swara cells inside a content span (0 if gap-only). */
function spanDuration(row: VisualRow, s: Span): number {
  let d = 0;
  for (let i = s.start; i < s.end; i++) {
    const c = row.cells[i]!;
    if (c.kind === "swara") d += Math.max(c.duration.doubleValue(), 0);
  }
  return d;
}

/**
 * Spread a content/marker span to `target` width. Swara cells are weighted by
 * akshara duration so equal-time notes (typical madhyamakalam) get even
 * spacing; gaps stay light so they don't create uneven "air" between notes.
 */
function distributeSpan(row: VisualRow, natural: number[], out: number[], start: number, end: number, target: number): void {
  let weightSum = 0;
  const weights: number[] = new Array(Math.max(0, end - start)).fill(0);
  for (let i = start; i < end; i++) {
    const c = row.cells[i]!;
    let w: number;
    if (c.kind === "gap") {
      w = 0.12;
    } else if (c.kind === "swara" && c.duration.gt(Fraction.ZERO)) {
      w = Math.max(c.duration.doubleValue(), 1 / 64);
    } else {
      w = Math.max(natural[i]!, 1.0);
    }
    weights[i - start] = w;
    weightSum += w;
  }
  if (weightSum <= 0) {
    const each = target / Math.max(1, end - start);
    for (let i = start; i < end; i++) out[i] = each;
    return;
  }
  for (let i = start; i < end; i++) {
    out[i] = weights[i - start]! * (target / weightSum);
  }
}

/** Aligns anga columns across a single section's rows; returns each row's per-cell widths. */
export function alignSection(
  rows: VisualRow[],
  targetWidth: number,
  unitWidthScale = 1,
  measure: CellWidthMeasurer = defaultMeasureCellWidth,
): Map<VisualRow, number[]> {
  const natural = new Map<VisualRow, number[]>();
  let maxSpans = 0;
  const allSpans: Span[][] = [];

  for (const row of rows) {
    const cw = row.cells.map((c) => measure(c, unitWidthScale));
    natural.set(row, cw);
    const spans = splitSpans(row, cw);
    allSpans.push(spans);
    maxSpans = Math.max(maxSpans, spans.length);
  }

  const spanTarget: number[] = new Array(maxSpans).fill(0);
  const isMarkerSpan: boolean[] = new Array(maxSpans).fill(false);
  const spanDur: number[] = new Array(maxSpans).fill(0);
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]!;
    const spans = allSpans[r]!;
    for (let i = 0; i < spans.length; i++) {
      const s = spans[i]!;
      spanTarget[i] = Math.max(spanTarget[i]!, s.width);
      if (s.marker) isMarkerSpan[i] = true;
      else spanDur[i] = Math.max(spanDur[i]!, spanDuration(row, s));
    }
  }

  // Size content columns by duration so a 2-akshara anga is ~2x a 1-akshara anga.
  // Floor each column at its natural max so glyphs never collide.
  let durSum = 0;
  let naturalContent = 0;
  let markerTotal = 0;
  let trailingNatural = 0; // gap-only tails after final || -- keep tiny
  for (let i = 0; i < maxSpans; i++) {
    if (isMarkerSpan[i]) markerTotal += spanTarget[i]!;
    else if (spanDur[i]! > 0) {
      durSum += spanDur[i]!;
      naturalContent += spanTarget[i]!;
    } else {
      trailingNatural += spanTarget[i]!;
    }
  }
  // Budget for timed content only; don't let empty trailing gaps claim an anga's width.
  const contentBudget = Math.max(naturalContent, targetWidth - markerTotal - trailingNatural);
  if (durSum > 0 && contentBudget > 0) {
    for (let i = 0; i < maxSpans; i++) {
      if (isMarkerSpan[i] || spanDur[i]! <= 0) continue;
      const proportional = contentBudget * (spanDur[i]! / durSum);
      spanTarget[i] = Math.max(spanTarget[i]!, proportional);
    }
  }

  let total = 0;
  for (const w of spanTarget) total += w;
  if (total > targetWidth && total > 0) {
    const scale = targetWidth / total;
    for (let i = 0; i < spanTarget.length; i++) spanTarget[i]! *= scale;
  }

  const out = new Map<VisualRow, number[]>();
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]!;
    const nat = natural.get(row)!;
    const aligned: number[] = new Array(nat.length).fill(0);
    const spans = allSpans[r]!;
    for (let si = 0; si < spans.length; si++) {
      const s = spans[si]!;
      const target = si < spanTarget.length ? spanTarget[si]! : s.width;
      distributeSpan(row, nat, aligned, s.start, s.end, target);
    }
    out.set(row, aligned);
  }
  return out;
}

/** Groups `items` into sections (runs of consecutive `VisualRow`s) and aligns each independently. */
export function alignAllSections(
  items: LayoutItem[],
  targetWidth: number,
  unitWidthScale = 1,
  measure: CellWidthMeasurer = defaultMeasureCellWidth,
): Map<VisualRow, number[]> {
  const out = new Map<VisualRow, number[]>();
  let section: VisualRow[] = [];
  const flush = (): void => {
    if (section.length === 0) return;
    const aligned = alignSection(section, targetWidth, unitWidthScale, measure);
    for (const [row, widths] of aligned) out.set(row, widths);
    section = [];
  };
  for (const it of items) {
    if (it instanceof VisualHeading || it instanceof VisualBreak || it instanceof VisualPageBreak) {
      flush();
    } else {
      section.push(it);
    }
  }
  flush();
  return out;
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
  y: number,
  forceScript: Script | undefined,
  widths: number[],
  rowSpacingScale = 1,
): { svg: string; nextY: number } {
  const script = languageScript(row.language, forceScript);
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
    Math.max(6, lyricSize * 0.35) * row.rowSpacing * rowSpacingScale,
    Math.max(swaraSize, lyricSize) * 1.5,
  );
  const rowHeight = topClearance + bottomClearance + rowBottomPad;
  const baselineY = y + topClearance;

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
    const w = widths[i]!;
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
      const swaraDisplay = transliterateSwara(c.text, script);
      parts.push(
        `<text class="cmnt-swara"${swaraStyle} x="${fmt(cx)}" y="${fmt(baselineY)}" text-anchor="middle">${escapeXml(swaraDisplay)}</text>`,
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
        const wordStart = li < c.lyricWordStart.length ? c.lyricWordStart[li]! : true;
        // Match JAR NotationCanvas: per-note lyrics go through transliterate(),
        // not transliterateText(), so @/!/~n/#n markers stay on the syllable.
        const lyricDisplay = transliterate(lyric, script, wordStart);
        const lineY = baselineY + swaraToLyric + li * lyricLineHeight;
        parts.push(
          `<text class="cmnt-lyric"${lyricStyle} x="${fmt(cx)}" y="${fmt(lineY)}" text-anchor="middle">${escapeXml(lyricDisplay)}</text>`,
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
