#!/usr/bin/env tsx
/**
 * Writes static, self-contained HTML previews of a handful of fixtures to
 * `preview-out/` for quick screenshotting / sharing without running `vite dev`.
 *
 * Usage: `npm run preview:static`
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parse,
  layoutSong,
  renderScoreSvg,
  scriptFor,
  VisualHeading,
  VisualRow,
} from "../src/index.js";
import type { LayoutItem } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const fixturesDir = resolve(root, "fixtures");
const outDir = resolve(root, "preview-out");
const stylesPath = resolve(root, "web/styles.css");

const FONT_LINK =
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;500;600;700&family=Noto+Serif+Tamil:wght@400;600;700&display=swap">';

const FIXTURES = ["smoke_adi", "smoke_adi_tamil", "smoke_rupaka", "maha_ganapatim"];

function usesTamilScript(items: LayoutItem[]): boolean {
  for (const item of items) {
    if (item instanceof VisualRow) {
      if (scriptFor(item.language.split(":")[0]) === "tamil") return true;
    } else if (item instanceof VisualHeading) {
      if (scriptFor(item.heading.language?.split(":")[0] ?? null) === "tamil") return true;
    }
  }
  return false;
}

function renderPreview(name: string, css: string): string {
  const text = readFileSync(resolve(fixturesDir, `${name}.txt`), "utf8");
  const song = parse(text);
  const items = layoutSong(song);
  const svg = renderScoreSvg(items, { contentWidth: 1100 });
  const pageClass = usesTamilScript(items) ? "score-page theme-classic-blue lang-tamil" : "score-page theme-classic-blue";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${name}</title>
${FONT_LINK}
<style>
${css}
body { padding: 24px; background: #eef1f6; }
.score-page { margin: 0 auto; }
</style>
</head>
<body>
<h1 style="font-family:system-ui">${name}</h1>
<div class="${pageClass}">
${svg}
</div>
</body>
</html>
`;
}

function main(): void {
  const css = readFileSync(stylesPath, "utf8");
  mkdirSync(outDir, { recursive: true });
  for (const name of FIXTURES) {
    const html = renderPreview(name, css);
    const outPath = resolve(outDir, `${name}.html`);
    writeFileSync(outPath, html, "utf8");
    console.log(`wrote ${outPath}`);
  }
}

main();
