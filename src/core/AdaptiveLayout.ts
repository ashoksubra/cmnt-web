/**
 * Ported (as exactly as TypeScript allows) from
 * CMNT-Notation-Studio-source/src/cmnt/core/AdaptiveLayout.java.
 *
 * Adaptive "how many tala cycles fit on one printed row" layout. By default (no
 * explicit CyclesPerRow: directive), the number of cycles packed into one row is
 * estimated from the tala's akshara count, DefaultSpeed, and gati, against a fixed
 * reference page width -- so a short/fast tala (more room per cycle) automatically
 * packs more avartanams per line than a long/slow one, instead of every tala using
 * the same fixed row width regardless of how much actually fits.
 */
import { Fraction } from "../model/Fraction.js";
import { Song } from "../model/Song.js";
import { SongBlock } from "../model/SongBlock.js";
import { Tala, TalaRow, TalaSegment } from "../model/Tala.js";

const DEFAULT_SWARA_PT = 15;
// Letter content width after side margins, in points (8.5in - 1in ~= 7.5in portrait;
// landscape uses the long side minus margins). Kept conservative so packing prefers
// fewer cycles when lyrics are wide -- NotationCanvas still measure-and-reduces further.
const PORTRAIT_WIDTH_PT = 540.0;
const LANDSCAPE_WIDTH_PT = 720.0;
const MAX_CYCLES_PER_ROW = 4; // cap for readability

/** How many avartanams the tala's current single layout row packs. */
export function packedCycles(tala: Tala | null): number {
  if (tala == null || tala.aksharaCount <= 0 || tala.layoutRows.length === 0) return 1;
  const ratio = tala.layoutRows[0]!.duration.doubleValue() / tala.aksharaCount;
  return Math.max(1, Math.round(ratio));
}

/** One cycle's anga spans (span=1, nAksharas, gati) derived from a tala's marker parts. */
function angaSegments(tala: Tala): TalaSegment[] {
  const segs: TalaSegment[] = [];
  if (tala.parts.length === 0) {
    segs.push(new TalaSegment(1, Math.max(tala.aksharaCount, 1), tala.primaryGati()));
    return segs;
  }
  const parts = [...tala.parts].sort((a, b) => a.index - b.index);
  for (let i = 0; i < parts.length; i++) {
    const start = parts[i]!.index;
    const end = i + 1 < parts.length ? parts[i + 1]!.index : tala.aksharaCount;
    const n = Math.max(1, end - start);
    segs.push(new TalaSegment(1, n, parts[i]!.gati));
  }
  let covered = 0;
  for (const s of segs) covered += s.nAksharas;
  if (covered < tala.aksharaCount && segs.length > 0) {
    const last = segs[segs.length - 1]!;
    segs[segs.length - 1] = new TalaSegment(last.span, last.nAksharas + (tala.aksharaCount - covered), last.gati);
  }
  return segs;
}

/**
 * Returns a copy of tala whose single row packs nCycles avartanams instead of
 * whatever it currently packs. Multi-row talas (e.g. Dhruva2's 6+8 split) and
 * varnam/gitam layouts are left unchanged, since packing more cycles doesn't make
 * sense for those structures.
 */
export function setCyclesPerRow(tala: Tala, nCycles: number): Tala {
  if (nCycles < 1) nCycles = 1;
  if (tala.layoutName === "varnam" || tala.layoutName === "gitam") return tala;
  if (tala.layoutRows.length !== 1) return tala;
  const oneCycle = angaSegments(tala);
  if (oneCycle.length === 0) return tala;
  const packed: TalaSegment[] = [];
  for (let i = 0; i < nCycles; i++) packed.push(...oneCycle);
  const duration = Fraction.of(tala.aksharaCount * nCycles);
  const newRow = new TalaRow(packed, duration);
  return tala.copyWithRows([newRow]);
}

/**
 * How many tala cycles fit on one notation row at the given font size, using a
 * conservative cell-width model so rows don't overflow a Letter/A4-ish page.
 */
export function estimateCyclesPerRow(song: Song, pageWidthPt: number, fontPt: number): number {
  const tala = song.tala;
  const cycle = Math.max(tala.aksharaCount, 1);
  const speed = Math.max(0, song.effectiveDefaultSpeed);
  const gati = Math.max(1, tala.primaryGati());
  const swarasPerAkshara = speed <= 0 ? 1.0 : Math.pow(2, speed - 1) * gati;
  // Mixed long/short swaras + lyric syllables run wider than bare swara letters;
  // keep this estimate on the roomy side so anga columns stay printable.
  const cellsPerCycle = cycle * swarasPerAkshara * 0.9 + 3.0;
  const cellW = Math.max(10.0, fontPt * 1.4);
  const cycleW = cellsPerCycle * cellW;
  if (cycleW <= 0) return 1;
  const byWidth = Math.max(1, Math.floor(pageWidthPt / cycleW));
  // Prefer the tala's own built-in packing (e.g. Khanda Chapu -> 4) if it still fits.
  let defaultN = 1;
  if (tala.layoutRows.length > 0) {
    const ratio = tala.layoutRows[0]!.duration.doubleValue() / cycle;
    defaultN = Math.max(1, Math.round(ratio));
  }
  if (defaultN <= byWidth) return Math.min(defaultN, MAX_CYCLES_PER_ROW);
  return Math.max(1, Math.min(byWidth, MAX_CYCLES_PER_ROW));
}

/**
 * Returns the song's own swara font size (from its first notation block), or the
 * default if none is set.
 */
function firstBlockFontPt(song: Song): number {
  for (const p of song.parts) {
    if (p instanceof SongBlock) {
      const spec = p.swaraFontSize;
      if (spec == null) return DEFAULT_SWARA_PT;
      const digits = spec.replace(/[^0-9.]/g, "");
      if (digits === "") return DEFAULT_SWARA_PT;
      const v = Number.parseFloat(digits);
      return Number.isNaN(v) ? DEFAULT_SWARA_PT : v;
    }
  }
  return DEFAULT_SWARA_PT;
}

/**
 * Applies adaptive (or explicitly overridden) cycles-per-row to the song's tala in
 * place, replacing the leading Tala part in song.parts too.
 */
export function applyCyclesPerRow(song: Song): void {
  let n: number;
  if (song.cyclesPerRow != null) {
    n = Math.max(1, Math.min(song.cyclesPerRow, MAX_CYCLES_PER_ROW));
  } else {
    const pageWidthPt = song.portrait ? PORTRAIT_WIDTH_PT : LANDSCAPE_WIDTH_PT;
    n = estimateCyclesPerRow(song, pageWidthPt, firstBlockFontPt(song));
  }
  const newTala = setCyclesPerRow(song.tala, n);
  song.tala = newTala;
  for (let i = 0; i < song.parts.length; i++) {
    if (song.parts[i] instanceof Tala) {
      song.parts[i] = newTala;
      break;
    }
  }
}
