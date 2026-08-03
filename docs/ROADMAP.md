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
- [x] `src/core/Translit.ts` — ported from the JAR's `Translit.java`: Tamil/Telugu/Kannada/Sanskrit syllable transliteration (`scriptFor`, `transliterateSwara`, `transliterateText`, `transliterateHeading`), wired into `SvgScore` for swaras, lyrics, and headings (`SvgScoreOptions.forceScript` for preview overrides)
- [x] Composer-style web UI (`web/`) — editable source textarea, fixture/language/theme selectors, debounced live re-render, parse-error status line that selects the offending source line, Noto Sans Tamil web font
- [x] `fixtures/smoke_adi_tamil.txt` — `smoke_adi` with `Language: Tamil`
- [x] `scripts/write-previews.ts` (`npm run preview:static`) — writes self-contained `preview-out/*.html` snapshots for smoke_adi(_tamil), smoke_rupaka, maha_ganapatim
- [ ] Font-metric-aware cell width measurement (browser canvas) to match JAR column alignment exactly
- [ ] Section-aligned anga columns across rows (JAR's `alignSection`) — currently per-row natural widths

## Iteration 3+

CSS school presets → playback/hosting → UI chrome.
