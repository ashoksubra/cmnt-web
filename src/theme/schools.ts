/**
 * "School" presets -- the primary theming control for Path A (see
 * `docs/ROADMAP.md` Iteration 3). Each preset bundles a CSS class (applied to
 * `#score-page`, which owns the `.cmnt-score` custom-property cascade in
 * `web/styles.css`), a suggested UI language override, and a density hint
 * consumed by `renderScoreSvg` (`SvgScoreOptions.unitWidthScale` /
 * `rowSpacingScale`) so different notation traditions can be denser or more
 * spread out without touching the layout algorithm itself.
 */

export type SchoolId = "classic-print" | "tanjore-dense" | "roman-teaching" | "screen-night";

export type SchoolPreset = {
  id: SchoolId;
  label: string;
  description: string;
  /** CSS class applied to #score-page. */
  cssClass: string;
  /** Suggested language override for the UI. */
  preferredLang: "auto" | "english" | "tamil";
  /** Density hint used by SvgScore. */
  density: { unitWidthScale: number; rowSpacingScale: number };
};

export const SCHOOL_PRESETS: readonly SchoolPreset[] = [
  {
    id: "classic-print",
    label: "Classic Print",
    description: "Blue swaras on white, generous spacing -- the traditional printed-book look.",
    cssClass: "school-classic-print",
    preferredLang: "auto",
    density: { unitWidthScale: 1.0, rowSpacingScale: 1.0 },
  },
  {
    id: "tanjore-dense",
    label: "Tanjore Dense",
    description: "Tamil-first, tighter columns and darker ink for high-density Tanjore-style notation.",
    cssClass: "school-tanjore-dense",
    preferredLang: "tamil",
    density: { unitWidthScale: 0.78, rowSpacingScale: 0.82 },
  },
  {
    id: "roman-teaching",
    label: "Roman Teaching",
    description: "Forces English/Roman script with larger, high-contrast black swaras for the classroom.",
    cssClass: "school-roman-teaching",
    preferredLang: "english",
    density: { unitWidthScale: 1.2, rowSpacingScale: 1.2 },
  },
  {
    id: "screen-night",
    label: "Screen Night",
    description: "Night-mode colors tuned for on-screen reading and low-light rehearsal.",
    cssClass: "school-screen-night",
    preferredLang: "auto",
    density: { unitWidthScale: 1.0, rowSpacingScale: 1.0 },
  },
];

export const DEFAULT_SCHOOL_ID: SchoolId = "classic-print";

export function schoolById(id: SchoolId): SchoolPreset {
  const found = SCHOOL_PRESETS.find((s) => s.id === id);
  if (found == null) throw new Error(`unknown school: ${id}`);
  return found;
}
