import { parse, ParseException } from "@cmnt/core/CmntParser";
import { layoutSong, VisualHeading, VisualRow } from "@cmnt/core/Layout";
import type { LayoutItem } from "@cmnt/core/Layout";
import { renderScoreSvg } from "@cmnt/render/SvgScore";
import { scriptFor } from "@cmnt/core/Translit";
import type { Script } from "@cmnt/core/Translit";
import {
  autoRagamDisplayName,
  autoTalamDisplayName,
  parseRagamTalamHeading,
} from "@cmnt/core/RagamTalamDisplay";
import { SCHOOL_PRESETS, DEFAULT_SCHOOL_ID, schoolById } from "@cmnt/theme/schools";
import type { SchoolId, SchoolPreset } from "@cmnt/theme/schools";
import stylesCssRaw from "./styles.css?raw";

import smokeAdi from "../fixtures/smoke_adi.txt?raw";
import smokeAdiTamil from "../fixtures/smoke_adi_tamil.txt?raw";
import smokeRupaka from "../fixtures/smoke_rupaka.txt?raw";
import mahaGanapatim from "../fixtures/maha_ganapatim.txt?raw";
import sankachakra from "../fixtures/sankachakra.txt?raw";

const FIXTURES: Record<string, string> = {
  smoke_adi: smokeAdi,
  smoke_adi_tamil: smokeAdiTamil,
  smoke_rupaka: smokeRupaka,
  maha_ganapatim: mahaGanapatim,
  sankachakra: sankachakra,
};

/** "auto" leaves script detection to each row/heading's own `Language:` directive. */
type LangOverride = "auto" | "english" | "tamil";

const SCHOOL_CLASSES = SCHOOL_PRESETS.map((s) => s.cssClass);

const fixtureSelect = document.querySelector<HTMLSelectElement>("#fixture-select")!;
const langSelect = document.querySelector<HTMLSelectElement>("#lang-select")!;
const schoolSelect = document.querySelector<HTMLSelectElement>("#school-select")!;
const liveUpdateToggle = document.querySelector<HTMLInputElement>("#live-update-toggle")!;
const renderBtn = document.querySelector<HTMLButtonElement>("#render-btn")!;
const exportSvgBtn = document.querySelector<HTMLButtonElement>("#export-svg-btn")!;
const exportPngBtn = document.querySelector<HTMLButtonElement>("#export-png-btn")!;
const ragamDisplay = document.querySelector<HTMLInputElement>("#ragam-display")!;
const talamDisplay = document.querySelector<HTMLInputElement>("#talam-display")!;
const resetHeadersBtn = document.querySelector<HTMLButtonElement>("#reset-headers-btn")!;
const sourceInput = document.querySelector<HTMLTextAreaElement>("#source-input")!;
const statusLine = document.querySelector<HTMLDivElement>("#status-line")!;
const scorePage = document.querySelector<HTMLDivElement>("#score-page")!;

let currentSchool: SchoolPreset = schoolById(DEFAULT_SCHOOL_ID);
/** Once the user edits a name field, keep their text until Reset / fixture change. */
let ragamNameDirty = false;
let talamNameDirty = false;

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

function populateSchoolSelect(): void {
  schoolSelect.innerHTML = "";
  for (const preset of SCHOOL_PRESETS) {
    const opt = document.createElement("option");
    opt.value = preset.id;
    opt.textContent = preset.label;
    opt.title = preset.description;
    schoolSelect.appendChild(opt);
  }
  schoolSelect.value = DEFAULT_SCHOOL_ID;
}

/** Applies a school's CSS class to #score-page and its suggested language
 *  override to the Language select, then re-renders. */
function applySchool(id: SchoolId): void {
  currentSchool = schoolById(id);
  scorePage.classList.remove(...SCHOOL_CLASSES);
  scorePage.classList.add(currentSchool.cssClass);
  langSelect.value = currentSchool.preferredLang;
  render();
}

/** Whether the rendered score uses Tamil anywhere, so the preview can switch to a
 *  Tamil-friendly font family regardless of which school is selected. */
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

function findRagamTalamHeading(items: LayoutItem[]) {
  for (const item of items) {
    if (!(item instanceof VisualHeading)) continue;
    const h = item.heading;
    if (h.role === "ragamTalam" || parseRagamTalamHeading(h.text) != null) {
      return h;
    }
  }
  return null;
}

function syncHeaderFields(items: LayoutItem[], forceScript: Script | undefined): void {
  const h = findRagamTalamHeading(items);
  const parts = h != null ? parseRagamTalamHeading(h.text) : null;
  if (parts == null) {
    if (!ragamNameDirty) ragamDisplay.value = "";
    if (!talamNameDirty) talamDisplay.value = "";
    ragamDisplay.disabled = true;
    talamDisplay.disabled = true;
    return;
  }
  ragamDisplay.disabled = parts.ragaName == null;
  talamDisplay.disabled = parts.talaName == null;
  const script = forceScript !== undefined ? forceScript : scriptFor(h!.language?.split(":")[0] ?? null);
  if (!ragamNameDirty) ragamDisplay.value = autoRagamDisplayName(parts, script);
  if (!talamNameDirty) talamDisplay.value = autoTalamDisplayName(parts, script);
}

function clearHeaderOverrides(): void {
  ragamNameDirty = false;
  talamNameDirty = false;
}

function render(): void {
  const text = sourceInput.value;
  const forceScript = forceScriptFor(langSelect.value as LangOverride);

  try {
    const song = parse(text);
    const items = layoutSong(song);
    syncHeaderFields(items, forceScript);
    const svg = renderScoreSvg(items, {
      contentWidth: 1100,
      forceScript,
      unitWidthScale: currentSchool.density.unitWidthScale,
      rowSpacingScale: currentSchool.density.rowSpacingScale,
      ragamTalamOverrides: {
        ragaName: ragamNameDirty ? ragamDisplay.value : undefined,
        talaName: talamNameDirty ? talamDisplay.value : undefined,
      },
    });
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
  clearHeaderOverrides();
  sourceInput.value = text;
  render();
}

/** CSS custom properties `.cmnt-score` relies on -- resolved from the live,
 *  currently-applied school/language classes so exported files render
 *  identically to the on-screen preview without depending on styles.css. */
const EXPORT_CSS_VARS = [
  "--page-bg",
  "--swara-color",
  "--lyric-color",
  "--marker-color",
  "--heading-color",
  "--swara-font",
  "--lyric-font",
  "--swara-size",
  "--lyric-size",
] as const;

function currentSvgElement(): SVGSVGElement | null {
  return scorePage.querySelector("svg");
}

/** Serializes the currently rendered SVG as a standalone document: resolved
 *  CSS variables are inlined on the root element and the full stylesheet
 *  (class rules referencing those variables) is embedded, so the file opens
 *  correctly outside this app and rasterizes correctly via <canvas>. */
function buildStandaloneSvgMarkup(): string | null {
  const svgEl = currentSvgElement();
  if (!svgEl) return null;
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  const computed = getComputedStyle(svgEl);
  const varDecls = EXPORT_CSS_VARS.map((name) => `${name}: ${computed.getPropertyValue(name).trim()}`).join("; ");
  clone.setAttribute("style", varDecls);
  if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const styleTag = document.createElementNS("http://www.w3.org/2000/svg", "style");
  styleTag.textContent = stylesCssRaw;
  clone.insertBefore(styleTag, clone.firstChild);
  return new XMLSerializer().serializeToString(clone);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportSvg(): void {
  const markup = buildStandaloneSvgMarkup();
  if (markup == null) {
    setStatusError("Export SVG failed: nothing rendered yet");
    return;
  }
  const blob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
  downloadBlob(blob, `${fixtureSelect.value || "score"}.svg`);
}

function exportPng(): void {
  const svgEl = currentSvgElement();
  const markup = buildStandaloneSvgMarkup();
  if (svgEl == null || markup == null) {
    setStatusError("Export PNG failed: nothing rendered yet");
    return;
  }
  const width = Number(svgEl.getAttribute("width")) || svgEl.viewBox.baseVal.width || 1100;
  const height = Number(svgEl.getAttribute("height")) || svgEl.viewBox.baseVal.height || 800;
  const scale = 2; // rasterize at 2x for crisper PNGs on high-DPI displays
  const svgBlob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (ctx == null) {
      URL.revokeObjectURL(url);
      setStatusError("Export PNG failed: canvas 2D context unavailable");
      return;
    }
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);
    canvas.toBlob((blob) => {
      URL.revokeObjectURL(url);
      if (blob) downloadBlob(blob, `${fixtureSelect.value || "score"}.png`);
      else setStatusError("Export PNG failed: could not encode canvas");
    }, "image/png");
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    setStatusError("Export PNG failed: could not rasterize SVG");
  };
  img.src = url;
}

fixtureSelect.addEventListener("change", () => loadFixture(fixtureSelect.value));
langSelect.addEventListener("change", () => {
  clearHeaderOverrides();
  render();
});
schoolSelect.addEventListener("change", () => {
  clearHeaderOverrides();
  applySchool(schoolSelect.value as SchoolId);
});
renderBtn.addEventListener("click", render);
exportSvgBtn.addEventListener("click", exportSvg);
exportPngBtn.addEventListener("click", exportPng);
ragamDisplay.addEventListener("input", () => {
  ragamNameDirty = true;
  scheduleRender();
});
talamDisplay.addEventListener("input", () => {
  talamNameDirty = true;
  scheduleRender();
});
resetHeadersBtn.addEventListener("click", () => {
  clearHeaderOverrides();
  render();
});
sourceInput.addEventListener("input", scheduleRender);
sourceInput.addEventListener("keydown", (ev) => {
  if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") {
    ev.preventDefault();
    render();
  }
});

populateSchoolSelect();
sourceInput.value = FIXTURES[fixtureSelect.value] ?? "";
applySchool(schoolSelect.value as SchoolId);
