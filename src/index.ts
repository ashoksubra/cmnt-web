/**
 * CMNT Web core entry (Path A Iteration 1).
 * Layout / SVG rendering land in later iterations; the parser and its
 * supporting model types are the first ported pieces.
 */
export { Fraction } from "./model/Fraction.js";
export { Gati, gatiLabel } from "./model/Gati.js";
export type { GatiValue } from "./model/Gati.js";
export { Song } from "./model/Song.js";
export { parse, ParseException } from "./core/CmntParser.js";
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
export { dumpLayoutItems } from "./core/dumpLayout.js";
export { renderScoreSvg, alignSection, alignAllSections } from "./render/SvgScore.js";
export type { SvgScoreOptions } from "./render/SvgScore.js";
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
  autoRagamDisplayName,
  autoTalamDisplayName,
  looksLikeRagamTalamHeading,
} from "./core/RagamTalamDisplay.js";
export type { RagamTalamParts, RagamTalamDisplayOverrides } from "./core/RagamTalamDisplay.js";
export { SCHOOL_PRESETS, DEFAULT_SCHOOL_ID, schoolById } from "./theme/schools.js";
export type { SchoolId, SchoolPreset } from "./theme/schools.js";
