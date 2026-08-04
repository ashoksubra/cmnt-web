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
import { TALA_NAMES } from "@cmnt/core/Talas";
import {
  INSTRUMENTS,
  clampPlaybackSpeed,
  playSong,
  stopPlayback,
  type InstrumentId,
  type PlaybackHandle,
} from "@cmnt/core/Playback";
import { SCHOOL_PRESETS, DEFAULT_SCHOOL_ID, schoolById } from "@cmnt/theme/schools";
import type { SchoolId, SchoolPreset, UiLangOverride } from "@cmnt/theme/schools";
import { buildMenubar, type MenuItem } from "./menubar";
import { createCanvasCellMeasurer } from "./canvasMeasure";
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

const NEW_SONG_TEMPLATE = [
  "Heading: \"Untitled\",bold,center,20",
  "Heading: \"Composer\",italic,center,16,tight",
  "Language: English",
  "Raagam: Mayamalavagowla",
  "Tala: Adi",
  "DefaultSpeed: 0",
  "",
  "S: s r g m | p d n s'",
  "L: sa ri ga ma pa da ni sa",
  "",
].join("\n");

const SCHOOL_CLASSES = SCHOOL_PRESETS.map((s) => s.cssClass);
const LANG_CLASSES = ["lang-tamil", "lang-telugu", "lang-kannada", "lang-sanskrit"] as const;

const menubarEl = document.querySelector<HTMLElement>("#menubar")!;
const docTitleEl = document.querySelector<HTMLSpanElement>("#doc-title")!;
const openFileInput = document.querySelector<HTMLInputElement>("#open-file-input")!;
const fixtureSelect = document.querySelector<HTMLSelectElement>("#fixture-select")!;
const langSelect = document.querySelector<HTMLSelectElement>("#lang-select")!;
const schoolSelect = document.querySelector<HTMLSelectElement>("#school-select")!;
const liveUpdateToggle = document.querySelector<HTMLInputElement>("#live-update-toggle")!;
const renderBtn = document.querySelector<HTMLButtonElement>("#render-btn")!;
const instrumentSelect = document.querySelector<HTMLSelectElement>("#instrument-select")!;
const speedSlider = document.querySelector<HTMLInputElement>("#speed-slider")!;
const speedLabel = document.querySelector<HTMLElement>("#speed-label")!;
const playBtn = document.querySelector<HTMLButtonElement>("#play-btn")!;
const stopBtn = document.querySelector<HTMLButtonElement>("#stop-btn")!;
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
let playbackHandle: PlaybackHandle | null = null;

function currentPlaybackSpeed(): number {
  return clampPlaybackSpeed(Number.parseFloat(speedSlider.value) || 1);
}

function currentInstrumentId(): InstrumentId {
  return (instrumentSelect.value || "shehnai") as InstrumentId;
}

function updateSpeedLabel(): void {
  const s = currentPlaybackSpeed();
  const text = Number.isInteger(s) ? String(s) : s.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  speedLabel.textContent = `${text}×`;
}

function populateInstrumentSelect(): void {
  instrumentSelect.innerHTML = "";
  for (const inst of INSTRUMENTS) {
    const opt = document.createElement("option");
    opt.value = inst.id;
    opt.textContent = inst.label;
    instrumentSelect.appendChild(opt);
  }
  instrumentSelect.value = "shehnai";
}

/** Current song document name (download / title bar). */
let currentFileName = "Untitled.txt";
/** Optional File System Access handle for true Save (Chrome/Edge). */
let currentFileHandle: FileSystemFileHandle | null = null;
let documentDirty = false;

type FileSystemFileHandle = {
  name: string;
  createWritable: () => Promise<{ write: (data: Blob | string) => Promise<void>; close: () => Promise<void> }>;
  getFile: () => Promise<File>;
};

function forceScriptFor(lang: UiLangOverride): Script | undefined {
  if (lang === "auto") return undefined;
  if (lang === "english") return null;
  return lang;
}

function setStatusOk(message = "Ready"): void {
  statusLine.textContent = message;
  statusLine.className = "status status-ok";
}

function setStatusError(message: string): void {
  statusLine.textContent = message;
  statusLine.className = "status status-error";
}

function updateDocTitle(): void {
  docTitleEl.textContent = documentDirty ? `${currentFileName} •` : currentFileName;
  document.title = `${documentDirty ? "• " : ""}${currentFileName} — CMNT Web`;
}

function markDirty(): void {
  if (!documentDirty) {
    documentDirty = true;
    updateDocTitle();
  }
}

function markClean(): void {
  documentDirty = false;
  updateDocTitle();
}

function setDocument(text: string, fileName: string, handle: FileSystemFileHandle | null = null): void {
  clearHeaderOverrides();
  sourceInput.value = text;
  currentFileName = fileName.endsWith(".txt") || fileName.endsWith(".cmnt") ? fileName : `${fileName}.txt`;
  currentFileHandle = handle;
  markClean();
  render();
}

function baseName(): string {
  return currentFileName.replace(/\.(txt|cmnt)$/i, "") || "score";
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

function applySchool(id: SchoolId): void {
  currentSchool = schoolById(id);
  scorePage.classList.remove(...SCHOOL_CLASSES);
  scorePage.classList.add(currentSchool.cssClass);
  langSelect.value = currentSchool.preferredLang;
  render();
}

function activeIndicScript(items: LayoutItem[], forceScript: Script | undefined): Script {
  if (forceScript !== undefined) return forceScript;
  for (const item of items) {
    if (item instanceof VisualRow) {
      const s = scriptFor(item.language.split(":")[0]);
      if (s != null) return s;
    } else if (item instanceof VisualHeading) {
      const s = scriptFor(item.heading.language?.split(":")[0] ?? null);
      if (s != null) return s;
    }
  }
  return null;
}

function applyLangFontClass(script: Script): void {
  scorePage.classList.remove(...LANG_CLASSES);
  if (script != null) scorePage.classList.add(`lang-${script}`);
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
  const forceScript = forceScriptFor(langSelect.value as UiLangOverride);

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
      measureCellWidth: createCanvasCellMeasurer({ forceScript }),
    });
    scorePage.innerHTML = svg;
    applyLangFontClass(activeIndicScript(items, forceScript));
    setStatusOk(documentDirty ? "Edited — File → Save to keep your .txt" : "Ready");
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
  setDocument(text, `${key}.txt`, null);
}

// ---- File: save / open / export ------------------------------------------------

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

async function writeTextToHandle(handle: FileSystemFileHandle, text: string): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

function saveTextDownload(fileName: string): void {
  const blob = new Blob([sourceInput.value], { type: "text/plain;charset=utf-8" });
  downloadBlob(blob, fileName);
  currentFileName = fileName;
  currentFileHandle = null;
  markClean();
  setStatusOk(`Downloaded ${fileName}`);
}

async function saveFile(forceSaveAs: boolean): Promise<void> {
  const text = sourceInput.value;
  const picker = (window as unknown as {
    showSaveFilePicker?: (opts: unknown) => Promise<FileSystemFileHandle>;
  }).showSaveFilePicker;

  if (!forceSaveAs && currentFileHandle != null) {
    try {
      await writeTextToHandle(currentFileHandle, text);
      markClean();
      setStatusOk(`Saved ${currentFileName}`);
      return;
    } catch {
      // fall through to picker / download
    }
  }

  if (typeof picker === "function") {
    try {
      const handle = await picker({
        suggestedName: currentFileName,
        types: [
          {
            description: "CMNT song text",
            accept: { "text/plain": [".txt", ".cmnt"] },
          },
        ],
      });
      await writeTextToHandle(handle, text);
      currentFileHandle = handle;
      currentFileName = handle.name || currentFileName;
      markClean();
      setStatusOk(`Saved ${currentFileName}`);
      return;
    } catch (err) {
      // User cancelled the picker
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }

  // Safari / Firefox: download the .txt (browser chooses the Downloads folder).
  const name =
    forceSaveAs || currentFileName === "Untitled.txt"
      ? window.prompt("Save song as:", currentFileName) ?? ""
      : currentFileName;
  if (!name.trim()) return;
  const fileName = /\.(txt|cmnt)$/i.test(name.trim()) ? name.trim() : `${name.trim()}.txt`;
  saveTextDownload(fileName);
}

function newSong(): void {
  if (documentDirty && !window.confirm("Discard unsaved changes and start a new song?")) return;
  setDocument(NEW_SONG_TEMPLATE, "Untitled.txt", null);
  setStatusOk("New song — File → Save to download a .txt");
}

function openFileDialog(): void {
  if (documentDirty && !window.confirm("Discard unsaved changes and open another file?")) return;
  openFileInput.value = "";
  openFileInput.click();
}

async function openFileFromInput(file: File): Promise<void> {
  const text = await file.text();
  setDocument(text, file.name || "song.txt", null);
  setStatusOk(`Opened ${currentFileName}`);
}

function exportSvg(): void {
  render();
  const markup = buildStandaloneSvgMarkup();
  if (markup == null) {
    setStatusError("Export SVG failed: nothing rendered yet");
    return;
  }
  const blob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
  downloadBlob(blob, `${baseName()}.svg`);
  setStatusOk(`Exported ${baseName()}.svg`);
}

function exportPng(): void {
  render();
  const svgEl = currentSvgElement();
  const markup = buildStandaloneSvgMarkup();
  if (svgEl == null || markup == null) {
    setStatusError("Export PNG failed: nothing rendered yet");
    return;
  }
  const width = Number(svgEl.getAttribute("width")) || svgEl.viewBox.baseVal.width || 1100;
  const height = Number(svgEl.getAttribute("height")) || svgEl.viewBox.baseVal.height || 800;
  const scale = 2;
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
      if (blob) {
        downloadBlob(blob, `${baseName()}.png`);
        setStatusOk(`Exported ${baseName()}.png`);
      } else setStatusError("Export PNG failed: could not encode canvas");
    }, "image/png");
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    setStatusError("Export PNG failed: could not rasterize SVG");
  };
  img.src = url;
}

const PRINT_FONT_LINKS = [
  "https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&family=Noto+Sans+Kannada:wght@400;600;700&family=Noto+Sans+Tamil:wght@400;500;600;700&family=Noto+Sans+Telugu:wght@400;600;700&family=Noto+Serif+Tamil:wght@400;600;700&display=swap",
].join("");

/**
 * PDF via a dedicated print window that contains the *full* standalone SVG
 * (not the scrolled preview viewport on the right). User picks “Save as PDF”
 * in the browser print dialog.
 */
function exportPdf(): void {
  render();
  const markup = buildStandaloneSvgMarkup();
  if (markup == null) {
    setStatusError("Export PDF failed: nothing rendered yet");
    return;
  }
  // Do not pass "noopener" here -- it makes window.open() return null in modern
  // browsers, and we need the handle to write the full SVG and call print().
  const printWin = window.open("", "_blank");
  if (printWin == null) {
    setStatusError("Export PDF failed: popup blocked — allow popups, then try again");
    return;
  }
  const title = escapeHtml(baseName());
  printWin.document.open();
  printWin.document.write(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${PRINT_FONT_LINKS}" rel="stylesheet" />
  <style>
    @page { margin: 10mm; size: auto; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body { padding: 0; }
    .sheet { width: 100%; }
    .sheet svg { display: block; width: 100%; height: auto; max-width: 100%; }
  </style>
</head>
<body>
  <div class="sheet">${markup}</div>
</body>
</html>`);
  printWin.document.close();

  const triggerPrint = (): void => {
    try {
      printWin.focus();
      printWin.print();
    } catch {
      /* ignore */
    }
  };
  // Give the SVG + webfonts a moment to lay out before the print snapshot.
  printWin.addEventListener("afterprint", () => {
    try {
      printWin.close();
    } catch {
      /* ignore */
    }
  });
  if (printWin.document.fonts?.ready) {
    void printWin.document.fonts.ready.then(() => setTimeout(triggerPrint, 50));
  } else {
    setTimeout(triggerPrint, 300);
  }
  setStatusOk("Print dialog: choose “Save as PDF” — full score (not just the preview pane)");
}

// ---- Insert helpers ------------------------------------------------------------

function insertAtCursor(text: string): void {
  const start = sourceInput.selectionStart ?? sourceInput.value.length;
  const end = sourceInput.selectionEnd ?? start;
  const before = sourceInput.value.slice(0, start);
  const after = sourceInput.value.slice(end);
  sourceInput.value = before + text + after;
  const pos = start + text.length;
  sourceInput.focus();
  sourceInput.setSelectionRange(pos, pos);
  markDirty();
  scheduleRender();
}

function insertGamakaCluster(tag: string): void {
  const selected = sourceInput.value.slice(sourceInput.selectionStart, sourceInput.selectionEnd);
  if (selected.trim()) insertAtCursor(`{${selected}}(${tag})`);
  else insertAtCursor(`{ }(${tag})`);
}

function promptAndInsert(title: string, template: (value: string) => string, initial = ""): void {
  const value = window.prompt(title, initial);
  if (value == null || value.trim() === "") return;
  insertAtCursor(template(value.trim()));
}

function promptTala(): void {
  const list = TALA_NAMES.join(", ");
  const value = window.prompt(`Tala name (e.g. Adi, Rupaka).\nKnown: ${list}`, "Adi");
  if (value == null || value.trim() === "") return;
  insertAtCursor(`Tala: ${value.trim()}\n`);
}

function promptSubscript(sub: boolean): void {
  const n = window.prompt(sub ? "Subscript digit 0-9 (e.g. 2 → ₂ for R₂)" : "Superscript digit 0-9", "2");
  if (n == null || !/^[0-9]$/.test(n)) return;
  const glyphs = sub ? "₀₁₂₃₄₅₆₇₈₉" : "⁰¹²³⁴⁵⁶⁷⁸⁹";
  insertAtCursor(glyphs[Number(n)]!);
}

// ---- Menubar -------------------------------------------------------------------

function sampleMenuItems(): MenuItem[] {
  return Object.keys(FIXTURES).map((key) => ({
    label: key,
    action: () => {
      if (documentDirty && !window.confirm("Discard unsaved changes and load this sample?")) return;
      fixtureSelect.value = key;
      loadFixture(key);
    },
  }));
}

async function playFromStart(): Promise<void> {
  try {
    const song = parse(sourceInput.value);
    const speed = currentPlaybackSpeed();
    const instrument = currentInstrumentId();
    playbackHandle = await playSong(song, { speed, instrument });
    const instLabel = INSTRUMENTS.find((i) => i.id === instrument)?.label ?? instrument;
    setStatusOk(`Playing ${instLabel} at ${speed.toFixed(2)}× — Stop to cancel`);
  } catch (err) {
    if (err instanceof ParseException) {
      setStatusError(`Play failed: line ${err.line} — ${err.message.replace(/^line \d+:\s*/, "")}`);
      selectSourceLine(err.line);
    } else {
      setStatusError(`Play failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

function stopPlay(): void {
  stopPlayback();
  playbackHandle = null;
  setStatusOk("Stopped");
}

function buildAppMenus(): void {
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  const mod = isMac ? "⌘" : "Ctrl+";

  const gamakaItems: MenuItem[] = [
    { label: "Kampita (shake)  ~", action: () => insertAtCursor("~") },
    { label: "Kampita (heavy)  ~~", action: () => insertAtCursor("~~") },
    { label: "Slide up (etRa jAru)  /", action: () => insertAtCursor("/") },
    { label: "Slide up, long  //", action: () => insertAtCursor("//") },
    { label: "Slide down (iRakka jAru)  \\", action: () => insertAtCursor("\\") },
    { label: "Slide down, long  \\\\", action: () => insertAtCursor("\\\\") },
    { label: "Ravai  ^", action: () => insertAtCursor("^") },
    { label: "Sustain  =", action: () => insertAtCursor("=") },
    { separator: true },
    { label: "Volume soft  (v1)", action: () => insertAtCursor("(v1)") },
    { label: "Volume medium  (v2)", action: () => insertAtCursor("(v2)") },
    { label: "Volume loud  (v3)", action: () => insertAtCursor("(v3)") },
    { separator: true },
    { label: "Sphurita  (sp)", action: () => insertAtCursor("(sp)") },
    { label: "Pratyaghata  (pr)", action: () => insertAtCursor("(pr)") },
    { label: "Nokku / tirupa  (w)", action: () => insertAtCursor("(w)") },
    { label: "VaLi  (vl)", action: () => insertAtCursor("(vl)") },
    { separator: true },
    { label: "Khandippu cluster  { }(kh)", action: () => insertGamakaCluster("kh") },
    { label: "Odukkal cluster  { }(od)", action: () => insertGamakaCluster("od") },
    { label: "Orikai cluster  { }(or)", action: () => insertGamakaCluster("or") },
    { label: "VaLi cluster  { }(vl)", action: () => insertGamakaCluster("vl") },
  ];

  const languageItems: MenuItem[] = [
    { label: "English (roman)", action: () => insertAtCursor("Language: English\n") },
    { label: "Tamil", action: () => insertAtCursor("Language: Tamil\n") },
    { label: "Telugu", action: () => insertAtCursor("Language: Telugu\n") },
    { label: "Kannada", action: () => insertAtCursor("Language: Kannada\n") },
    { label: "Sanskrit", action: () => insertAtCursor("Language: Sanskrit\n") },
  ];

  buildMenubar(menubarEl, [
    {
      label: "File",
      items: [
        { label: "New Song…", shortcut: `${mod}N`, action: newSong },
        { label: "Open…", shortcut: `${mod}O`, action: openFileDialog },
        { label: "Save (.txt)", shortcut: `${mod}S`, action: () => void saveFile(false) },
        { label: "Save As…", shortcut: `${mod}⇧S`, action: () => void saveFile(true) },
        { separator: true },
        { label: "Update Preview", shortcut: `${mod}Enter`, action: render },
        { label: "Open Sample", submenu: sampleMenuItems() },
        { separator: true },
        { label: "Export as SVG…", action: exportSvg },
        { label: "Export as PNG…", action: exportPng },
        { label: "Export as PDF…", action: exportPdf },
      ],
    },
    {
      label: "Play",
      items: [
        { label: "Play from Start", shortcut: `${mod}P`, action: () => void playFromStart() },
        { label: "Stop", shortcut: `${mod}.`, action: () => stopPlay() },
        { separator: true },
        ...INSTRUMENTS.map(
          (inst): MenuItem => ({
            label: `Instrument: ${inst.label}`,
            action: () => {
              instrumentSelect.value = inst.id;
              setStatusOk(`Instrument → ${inst.label}`);
            },
          }),
        ),
      ],
    },
    {
      label: "Insert",
      items: [
        { label: "Gamaka", submenu: gamakaItems },
        { label: "Language", submenu: languageItems },
        { separator: true },
        {
          label: "Raagam Name…",
          action: () => promptAndInsert("Raagam name (roman catalogue spelling)", (v) => `Raagam: ${v}\n`, "Sri"),
        },
        { label: "Tala Name…", action: promptTala },
        {
          label: "Melakarta Number…",
          action: () =>
            promptAndInsert("Melakarta number (1–72)", (v) => `Melakarta: ${v}\n`, "15"),
        },
        {
          label: "Cycles Per Row…",
          action: () => promptAndInsert("Cycles per row (e.g. 1 or 2)", (v) => `CyclesPerRow: ${v}\n`, "1"),
        },
        { separator: true },
        {
          label: "Heading…",
          action: () =>
            promptAndInsert('Heading text', (v) => `Heading: "${v}",bold,center,14\n`, "pallavi:"),
        },
        {
          label: "Swara line (S:)",
          action: () => insertAtCursor("S: s r g m | p d n s'\n"),
        },
        {
          label: "Lyric line (L:)",
          action: () => insertAtCursor("L: sa ri ga ma pa da ni sa\n"),
        },
        { separator: true },
        { label: "Subscript Number…", action: () => promptSubscript(true) },
        { label: "Superscript Number…", action: () => promptSubscript(false) },
      ],
    },
  ]);
}

// ---- Events --------------------------------------------------------------------

fixtureSelect.addEventListener("change", () => {
  if (documentDirty && !window.confirm("Discard unsaved changes and load this sample?")) {
    return;
  }
  loadFixture(fixtureSelect.value);
});
langSelect.addEventListener("change", () => {
  clearHeaderOverrides();
  render();
});
schoolSelect.addEventListener("change", () => {
  clearHeaderOverrides();
  applySchool(schoolSelect.value as SchoolId);
});
renderBtn.addEventListener("click", render);
playBtn.addEventListener("click", () => void playFromStart());
stopBtn.addEventListener("click", stopPlay);
speedSlider.addEventListener("input", () => {
  updateSpeedLabel();
});
instrumentSelect.addEventListener("change", () => {
  const inst = INSTRUMENTS.find((i) => i.id === instrumentSelect.value);
  setStatusOk(`Instrument → ${inst?.label ?? instrumentSelect.value}`);
});
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
openFileInput.addEventListener("change", () => {
  const file = openFileInput.files?.[0];
  if (file) void openFileFromInput(file);
});
sourceInput.addEventListener("input", () => {
  markDirty();
  scheduleRender();
});
sourceInput.addEventListener("keydown", (ev) => {
  if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") {
    ev.preventDefault();
    render();
  }
});

window.addEventListener("keydown", (ev) => {
  const mod = ev.metaKey || ev.ctrlKey;
  if (!mod) return;
  const key = ev.key.toLowerCase();
  if (key === "s") {
    ev.preventDefault();
    void saveFile(ev.shiftKey);
  } else if (key === "o") {
    ev.preventDefault();
    openFileDialog();
  } else if (key === "n") {
    ev.preventDefault();
    newSong();
  } else if (key === "p") {
    ev.preventDefault();
    void playFromStart();
  } else if (key === ".") {
    ev.preventDefault();
    stopPlay();
  }
});

window.addEventListener("beforeunload", (ev) => {
  if (!documentDirty) return;
  ev.preventDefault();
  ev.returnValue = "";
});

populateSchoolSelect();
populateInstrumentSelect();
updateSpeedLabel();
buildAppMenus();
updateDocTitle();
sourceInput.value = FIXTURES[fixtureSelect.value] ?? "";
currentFileName = `${fixtureSelect.value || "Untitled"}.txt`;
markClean();
applySchool(schoolSelect.value as SchoolId);
