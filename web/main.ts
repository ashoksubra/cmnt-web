import { parse, ParseException } from "@cmnt/core/CmntParser";
import { layoutSong, VisualHeading, VisualRow } from "@cmnt/core/Layout";
import type { LayoutItem } from "@cmnt/core/Layout";
import { renderScoreSvg } from "@cmnt/render/SvgScore";
import { scriptFor } from "@cmnt/core/Translit";
import type { Script } from "@cmnt/core/Translit";

import smokeAdi from "../fixtures/smoke_adi.txt?raw";
import smokeAdiTamil from "../fixtures/smoke_adi_tamil.txt?raw";
import smokeRupaka from "../fixtures/smoke_rupaka.txt?raw";
import mahaGanapatim from "../fixtures/maha_ganapatim.txt?raw";

const FIXTURES: Record<string, string> = {
  smoke_adi: smokeAdi,
  smoke_adi_tamil: smokeAdiTamil,
  smoke_rupaka: smokeRupaka,
  maha_ganapatim: mahaGanapatim,
};

/** "auto" leaves script detection to each row/heading's own `Language:` directive. */
type LangOverride = "auto" | "english" | "tamil";

const THEME_CLASSES = ["theme-classic-blue", "theme-high-contrast", "theme-night-score"] as const;

const fixtureSelect = document.querySelector<HTMLSelectElement>("#fixture-select")!;
const langSelect = document.querySelector<HTMLSelectElement>("#lang-select")!;
const themeSelect = document.querySelector<HTMLSelectElement>("#theme-select")!;
const liveUpdateToggle = document.querySelector<HTMLInputElement>("#live-update-toggle")!;
const renderBtn = document.querySelector<HTMLButtonElement>("#render-btn")!;
const sourceInput = document.querySelector<HTMLTextAreaElement>("#source-input")!;
const statusLine = document.querySelector<HTMLDivElement>("#status-line")!;
const scorePage = document.querySelector<HTMLDivElement>("#score-page")!;

function forceScriptFor(lang: LangOverride): Script | undefined {
  if (lang === "auto") return undefined;
  if (lang === "english") return null;
  return "tamil";
}

function setStatusOk(): void {
  statusLine.textContent = "Ready";
  statusLine.className = "status status-ok";
}

function setStatusError(message: string): void {
  statusLine.textContent = message;
  statusLine.className = "status status-error";
}

/** Selects the given 1-indexed source line in the textarea and scrolls it into view. */
function selectSourceLine(lineNo: number): void {
  const lines = sourceInput.value.split("\n");
  if (lineNo < 1 || lineNo > lines.length) return;
  let start = 0;
  for (let i = 0; i < lineNo - 1; i++) start += lines[i]!.length + 1;
  const end = start + lines[lineNo - 1]!.length;
  sourceInput.focus();
  sourceInput.setSelectionRange(start, end);
  const lineHeight = parseFloat(getComputedStyle(sourceInput).lineHeight) || 20;
  sourceInput.scrollTop = Math.max(0, (lineNo - 4) * lineHeight);
}

function applyTheme(theme: string): void {
  scorePage.classList.remove(...THEME_CLASSES);
  scorePage.classList.add(`theme-${theme}`);
}

/** Whether the rendered score uses Tamil anywhere, so the preview can switch to a
 *  Tamil-friendly font family regardless of which theme is selected. */
function usesTamilScript(items: LayoutItem[], forceScript: Script | undefined): boolean {
  if (forceScript === "tamil") return true;
  if (forceScript !== undefined) return false; // forced to English/roman
  for (const item of items) {
    if (item instanceof VisualRow) {
      if (scriptFor(item.language.split(":")[0]) === "tamil") return true;
    } else if (item instanceof VisualHeading) {
      if (scriptFor(item.heading.language?.split(":")[0] ?? null) === "tamil") return true;
    }
  }
  return false;
}

function render(): void {
  const text = sourceInput.value;
  const forceScript = forceScriptFor(langSelect.value as LangOverride);

  try {
    const song = parse(text);
    const items = layoutSong(song);
    const svg = renderScoreSvg(items, { contentWidth: 1100, forceScript });
    scorePage.innerHTML = svg;
    scorePage.classList.toggle("lang-tamil", usesTamilScript(items, forceScript));
    setStatusOk();
  } catch (err) {
    if (err instanceof ParseException) {
      setStatusError(`Parse error: line ${err.line} — ${err.message.replace(/^line \d+:\s*/, "")}`);
      selectSourceLine(err.line);
    } else {
      const message = err instanceof Error ? err.message : String(err);
      setStatusError(`Error: ${message}`);
    }
    scorePage.innerHTML = `<p class="app-error">${escapeHtml(
      err instanceof Error ? err.message : String(err),
    )}</p>`;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

let debounceTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleRender(): void {
  if (!liveUpdateToggle.checked) return;
  if (debounceTimer != null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(render, 300);
}

function loadFixture(key: string): void {
  const text = FIXTURES[key];
  if (text == null) return;
  sourceInput.value = text;
  render();
}

fixtureSelect.addEventListener("change", () => loadFixture(fixtureSelect.value));
langSelect.addEventListener("change", render);
themeSelect.addEventListener("change", () => applyTheme(themeSelect.value));
renderBtn.addEventListener("click", render);
sourceInput.addEventListener("input", scheduleRender);
sourceInput.addEventListener("keydown", (ev) => {
  if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") {
    ev.preventDefault();
    render();
  }
});

applyTheme(themeSelect.value);
loadFixture(fixtureSelect.value);
