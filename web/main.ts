import { parse } from "@cmnt/core/CmntParser";
import { layoutSong } from "@cmnt/core/Layout";
import { renderScoreSvg } from "@cmnt/render/SvgScore";

import smokeAdi from "../fixtures/smoke_adi.txt?raw";
import smokeRupaka from "../fixtures/smoke_rupaka.txt?raw";
import mahaGanapatim from "../fixtures/maha_ganapatim.txt?raw";

const FIXTURES: Record<string, string> = {
  smoke_adi: smokeAdi,
  smoke_rupaka: smokeRupaka,
  maha_ganapatim: mahaGanapatim,
};

const select = document.querySelector<HTMLSelectElement>("#fixture-select")!;
const renderBtn = document.querySelector<HTMLButtonElement>("#render-btn")!;
const page = document.querySelector<HTMLDivElement>("#score-page")!;

function render(): void {
  const key = select.value;
  const text = FIXTURES[key];
  if (text == null) return;

  try {
    const song = parse(text);
    const items = layoutSong(song);
    const svg = renderScoreSvg(items, { contentWidth: 1100 });
    page.innerHTML = svg;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    page.innerHTML = `<p class="app-error">Failed to render: ${escapeHtml(message)}</p>`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

renderBtn.addEventListener("click", render);
select.addEventListener("change", render);
render();
