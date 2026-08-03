# Path A roadmap

See also the Cursor canvas timeline in the parent CMNT project conversation.

## Iteration 1 (current)

- [x] Clean repo under `Desktop/Development/cmnt-web`
- [x] TypeScript + Vitest toolchain
- [x] Port `Fraction`
- [x] Port model (`Swara`, `Tala`, `Song`, `SongBlock`, …)
- [x] Port `Talas` + `CmntParser` (classic directives)
- [x] Parse fixtures: `smoke_adi`, `maha_ganapatim`, `smoke_rupaka`
- [x] Port `Layout` + `AdaptiveLayout`
- [x] Golden layout dumps vs JAR (exact match)
- [ ] Port `Ragas` tables + YAML front-matter translation

## Iteration 2 (current)

- [x] `src/render/SvgScore.ts` — pure `LayoutItem[]` → SVG string renderer (duration-weighted cell widths, CSS-class based; no font-metric measurement)
- [x] Vite dev app (`web/`) — fixture picker + live preview, `npm run dev` / `npm run build:web`
- [x] `.cmnt-score` CSS custom properties ("classic blue" default theme) — Path A theming foundation
- [x] Vitest smoke tests for SVG output (`tests/svg.test.ts`)
- [ ] Font-metric-aware cell width measurement (browser canvas) to match JAR column alignment exactly
- [ ] Indic transliteration in the SVG renderer (Roman swaras only for now)
- [ ] Section-aligned anga columns across rows (JAR's `alignSection`) — currently per-row natural widths

## Iteration 3+

CSS school presets → playback/hosting → UI chrome.
