/**
 * CMNT Web core entry (Path A Iteration 1).
 * Layout / SVG rendering land in later iterations; the parser and its
 * supporting model types are the first ported pieces.
 */
export { Fraction } from "./model/Fraction.js";
export { Gati, gatiLabel } from "./model/Gati.js";
export type { GatiValue } from "./model/Gati.js";
export { Song } from "./model/Song.js";
export type { ParseWarning } from "./model/Song.js";
export { parse, ParseException } from "./core/CmntParser.js";
export type { ParseOptions } from "./core/CmntParser.js";
export * as Talas from "./core/Talas.js";
export {
  Cell,
  VisualRow,
  VisualHeading,
  VisualBreak,
  VisualPageBreak,
  gatiAt,
  layoutBlock,
  layoutSong,
  firstCrossingMarker,
  shortenSwaraDisplay,
} from "./core/Layout.js";
export type { CellKind, LayoutItem } from "./core/Layout.js";
export {
  layoutSongFitting,
  wrapVisualRowToWidth,
  wrapLayoutItemsToWidth,
  maxNaturalRowWidth,
} from "./core/LayoutFitting.js";
export type { LayoutFittingOptions } from "./core/LayoutFitting.js";
export { dumpLayoutItems } from "./core/dumpLayout.js";
export { renderScoreSvg, renderScoreSvgPages, alignSection, alignAllSections } from "./render/SvgScore.js";
export type { SvgScoreOptions } from "./render/SvgScore.js";
export {
  paginateLayoutItems,
  estimateItemHeight,
  estimateRowHeight,
  estimateHeadingHeight,
  LETTER_CONTENT_WIDTH,
  LETTER_CONTENT_HEIGHT,
  LETTER_PAGE_WIDTH_PX,
  LETTER_PAGE_HEIGHT_PX,
  LETTER_MARGIN_X,
  LETTER_MARGIN_Y,
} from "./render/ScorePagination.js";
export type { PaginationOptions } from "./render/ScorePagination.js";
export {
  scriptFor,
  transliterate,
  transliterateSwara,
  transliterateText,
  transliterateHeading,
} from "./core/Translit.js";
export type { Script } from "./core/Translit.js";
export {
  parseRagamTalamHeading,
  formatRagamTalamDisplay,
  formatAroAvaDisplay,
  autoRagamDisplayName,
  autoTalamDisplayName,
  looksLikeRagamTalamHeading,
  upsertDisplayDirectives,
} from "./core/RagamTalamDisplay.js";
export type { RagamTalamParts, RagamTalamDisplayOverrides } from "./core/RagamTalamDisplay.js";
export {
  melakartaNumberForName,
  melakartaName,
  melakartaAroAva,
  janyaForName,
  dwijaForName,
  janyaAroAva,
  dwijaAroAva,
  janyaCount,
  dwijaCount,
  lookupAny,
  encodeUserSequence,
  decodeForEditing,
  applyCorrection,
  correctionsLoadedCount,
  MELAKARTA_NAMES,
} from "./core/Ragas.js";
export type { JanyaRaga, RagaKind, RagaLookup } from "./core/Ragas.js";
export { melakartaVariantNumbers, melakartaVariants, VARIANT_SEMITONE } from "./core/Melakarta.js";
export {
  planNotes,
  playSong,
  stopPlayback,
  parseDynMark,
  extractRagaMapping,
  INSTRUMENTS,
  instrumentById,
  clampBpm,
  clampPlaybackSpeed,
  DEFAULT_BPM,
} from "./core/Playback.js";
export type { PlannedNote, DynMark, PlaybackHandle, Instrument, InstrumentId, PlaySongOptions } from "./core/Playback.js";
export { defaultMeasureCellWidth } from "./render/SvgScore.js";
export type { CellWidthMeasurer } from "./render/SvgScore.js";
export { SCHOOL_PRESETS, DEFAULT_SCHOOL_ID, schoolById } from "./theme/schools.js";
export type { SchoolId, SchoolPreset, UiLangOverride } from "./theme/schools.js";
