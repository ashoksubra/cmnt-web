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
- [x] Section-aligned anga columns across rows (JAR's `alignSection`/`alignAllSections`, ported to `src/render/SvgScore.ts`) — content columns at the same span index within a section (a run of consecutive rows uninterrupted by a heading/break) now share a duration-weighted target width instead of each row using independent natural widths; `tests/align.test.ts` covers the Rupaka 1+2 case and gap-only trailing spans
- [x] `src/core/YamlFrontMatter.ts` — real `---` front-matter → classic-directive translation, ported from the JAR's `YamlFrontMatter.java` (title/composer headings, Raagam/Tala/DefaultSpeed/CyclesPerRow/Language, nested `style:` → SwaraPrefs/LyricPrefs/HeadingPrefs/GamakaPrefs); files without a leading `---` are unaffected; `tests/yaml.test.ts` covers a minimal header plus the real-world `fixtures/sankachakra.txt`
- [x] `fixtures/sankachakra.txt` (Muthuswami Dikshitar's Sankachakra gadA pANim, Rupaka, YAML-fronted) wired into the web fixture picker and `scripts/write-previews.ts`

## Iteration 3 (current)

- [x] `src/theme/schools.ts` — "School" presets (Classic Print, Tanjore Dense, Roman Teaching, Screen Night) as the primary theming control: each bundles a `#score-page` CSS class (`web/styles.css`), a suggested `Language` override, and a `density` hint (`unitWidthScale`/`rowSpacingScale`) now threaded through `renderScoreSvg`'s `SvgScoreOptions`. The web UI's Theme dropdown was replaced with a School dropdown; the legacy `theme-*` CSS classes remain in the stylesheet but are unused.
- [x] Export SVG / Export PNG buttons in the web UI — SVG export inlines the live-resolved `.cmnt-score` CSS custom properties plus the full stylesheet so the file is self-contained; PNG export rasterizes that same standalone SVG via an offscreen `<canvas>` (`Image` → `drawImage` → `toBlob`) at 2x for crisper output.
- [ ] Playback → hosting → further UI chrome.
