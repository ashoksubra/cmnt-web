# Path A roadmap

See also the Cursor canvas timeline in the parent CMNT project conversation.

## Iteration 1

- [x] Clean repo under `Desktop/Development/cmnt-web`
- [x] TypeScript + Vitest toolchain
- [x] Port `Fraction`
- [x] Port model (`Swara`, `Tala`, `Song`, `SongBlock`, …)
- [x] Port `Talas` + `CmntParser` (classic directives)
- [x] Parse fixtures: `smoke_adi`, `maha_ganapatim`, `smoke_rupaka`
- [x] Port `Layout` + `AdaptiveLayout`
- [x] Golden layout dumps vs JAR (exact match)
- [x] Port `Ragas` tables + YAML front-matter translation (bundled janya/dwija/sri_ragam TSVs; Aro/Ava headings)

## Iteration 2

- [x] `src/render/SvgScore.ts` — layout → SVG
- [x] Vite composer (`web/`)
- [x] CSS theming / school presets
- [x] `Translit.ts` (Tamil/Telugu/Kannada/Sanskrit) + nasal markers
- [x] Section-aligned anga columns
- [x] YAML front-matter + Sankachakra fixture
- [x] Font-metric-aware cell widths (optional browser canvas `measureCellWidth`)
- [ ] Malayalam script (deferred until other Indic UI languages settled)

## Iteration 3

- [x] School presets + Export SVG/PNG
- [x] File / Insert menus (Save .txt, Open, Export PDF via full-score print window)
- [x] Localized editable Raagam/Taalam headers
- [x] Telugu / Kannada / Sanskrit in Language UI
- [x] Playback (Web Audio Play/Stop from layout + melakarta/Aro mapping)
- [ ] Hosting / shareable links
- [ ] Further UI chrome (instrument picker, tempo, zoom, Edit undo stack)
