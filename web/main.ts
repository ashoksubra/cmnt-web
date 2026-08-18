import { parse, ParseException } from "@cmnt/core/CmntParser";
import { VisualHeading, VisualRow } from "@cmnt/core/Layout";
import type { LayoutItem } from "@cmnt/core/Layout";
import { layoutSongFitting } from "@cmnt/core/LayoutFitting";
import { renderScoreSvg } from "@cmnt/render/SvgScore";
import {
  LETTER_CONTENT_HEIGHT,
  LETTER_CONTENT_WIDTH,
  LETTER_MARGIN_X,
  LETTER_MARGIN_Y,
  LETTER_PAGE_HEIGHT_PX,
  LETTER_PAGE_WIDTH_PX,
  paginateLayoutItems,
} from "@cmnt/render/ScorePagination";
import { scriptFor } from "@cmnt/core/Translit";
import type { Script } from "@cmnt/core/Translit";
import {
  parseRagamTalamHeading,
  upsertDisplayDirectives,
} from "@cmnt/core/RagamTalamDisplay";
import {
  applyCorrection,
  decodeForEditing,
  lookupAny,
  melakartaName,
} from "@cmnt/core/Ragas";
import { TALA_NAMES } from "@cmnt/core/Talas";
import {
  INSTRUMENTS,
  clampBpm,
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
const audioPlayToggle = document.querySelector<HTMLInputElement>("#audio-play-toggle")!;
const playbackBar = document.querySelector<HTMLElement>(".playback-bar")!;
const renderBtn = document.querySelector<HTMLButtonElement>("#render-btn")!;
const instrumentSelect = document.querySelector<HTMLSelectElement>("#instrument-select")!;
const bpmInput = document.querySelector<HTMLInputElement>("#bpm-input")!;
const clickToggle = document.querySelector<HTMLInputElement>("#click-toggle")!;
const speedSlider = document.querySelector<HTMLInputElement>("#speed-slider")!;
const speedLabel = document.querySelector<HTMLElement>("#speed-label")!;
const playBtn = document.querySelector<HTMLButtonElement>("#play-btn")!;
const stopBtn = document.querySelector<HTMLButtonElement>("#stop-btn")!;
const ragamDisplay = document.querySelector<HTMLInputElement>("#ragam-display")!;
const talamDisplay = document.querySelector<HTMLElement>("#talam-display")!;
const resetHeadersBtn = document.querySelector<HTMLButtonElement>("#reset-headers-btn")!;
const saveHeadersBtn = document.querySelector<HTMLButtonElement>("#save-headers-btn")!;
const editRagaBtn = document.querySelector<HTMLButtonElement>("#edit-raga-btn")!;
const editRagaDialog = document.querySelector<HTMLDialogElement>("#edit-raga-dialog")!;
const editRagaForm = document.querySelector<HTMLFormElement>("#edit-raga-form")!;
const editRagaName = document.querySelector<HTMLInputElement>("#edit-raga-name")!;
const editRagaCurrent = document.querySelector<HTMLElement>("#edit-raga-current")!;
const editRagaMel = document.querySelector<HTMLInputElement>("#edit-raga-mel")!;
const editRagaAro = document.querySelector<HTMLInputElement>("#edit-raga-aro")!;
const editRagaAva = document.querySelector<HTMLInputElement>("#edit-raga-ava")!;
const editRagaDwija = document.querySelector<HTMLInputElement>("#edit-raga-dwija")!;
const sourceInput = document.querySelector<HTMLTextAreaElement>("#source-input")!;
const statusLine = document.querySelector<HTMLDivElement>("#status-line")!;
const scorePage = document.querySelector<HTMLDivElement>("#score-page")!;
const composerEl = document.querySelector<HTMLElement>(".composer")!;
const paneSplitter = document.querySelector<HTMLElement>("#pane-splitter")!;
const syntaxHelp = document.querySelector<HTMLElement>("#syntax-help")!;
const syntaxHelpTitle = document.querySelector<HTMLElement>("#syntax-help-title")!;
const syntaxHelpBody = document.querySelector<HTMLPreElement>("#syntax-help-body")!;
const syntaxHelpDismiss = document.querySelector<HTMLButtonElement>("#syntax-help-dismiss")!;

let currentSchool: SchoolPreset = schoolById(DEFAULT_SCHOOL_ID);
/** Once the user edits the ragam field, keep their text until Clear / fixture change. */
let ragamNameDirty = false;
/** Last roman display spelling loaded from the parsed song (RaagamDisplay:). */
let loadedRagaRoman = "";
let playbackHandle: PlaybackHandle | null = null;
/** Session-only: user hid the YAML syntax tip. */
let syntaxHelpDismissed = false;

const YAML_SYNTAX_HELP = [
  "Optional header: start and end with --- on its own line.",
  "Keys are lowercase (raga: not Raagam:).",
  "",
  "---",
  "title: Song title",
  "composer: Composer",
  "raga: Sri              # also: ragam / raagam",
  "tala: misracApu        # REQUIRED to pick the cycle (talam: ok too)",
  "                       # TalamDisplay: is only optional roman spelling — not the tala",
  "speed: 0               # DefaultSpeed 0 / 1 / 2 (chapu: 1 note/beat)",
  "language: Tamil",
  "layout:",
  "  type: krithi         # krithi | gitam | …",
  "  width: full          # full | compact",
  "style:",
  "  swara: { color: blue, size: 13 }",
  "  lyric: { color: black, size: 13 }",
  "---",
  "",
  "Then classic body lines:",
  "Pallavi:",
  "S: s r g m",
  "L: sa ri ga ma",
].join("\n");

const CLASSIC_SYNTAX_HELP = [
  "Classic CMNT directives (one per line), then swara/lyric rows:",
  "",
  "Language: English",
  "Raagam: Mayamalavagowla",
  "Tala: Adi",
  "DefaultSpeed: 0",
  "",
  "S: s r g m | p d n s'",
  "L: sa ri ga ma | pa da ni sa   (bars | on L: are ignored)",
  "",
  "Select notes, then Insert → Speed (2nd/3rd/4th) or Insert → Gamaka.",
  "A { sA r s r … }(kh) cluster fills one parent beat; sA is twice a short note.",
  "",
  "Tip: start with --- for optional YAML front matter (keys lowercase).",
].join("\n");

function currentPlaybackSpeed(): number {
  return clampPlaybackSpeed(Number.parseFloat(speedSlider.value) || 1);
}

function currentBpm(): number {
  return clampBpm(Number.parseFloat(bpmInput.value) || 60);
}

function currentClickEnabled(): boolean {
  return clickToggle.checked;
}

function currentInstrumentId(): InstrumentId {
  return (instrumentSelect.value || "shehnai") as InstrumentId;
}

function updateSpeedLabel(): void {
  const s = currentPlaybackSpeed();
  const text = Number.isInteger(s) ? String(s) : s.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  speedLabel.textContent = `${text}×`;
}

function isAudioPlayVisible(): boolean {
  return audioPlayToggle.checked;
}

function readStoredAudioPlayVisible(): boolean {
  try {
    return localStorage.getItem(AUDIO_PLAY_VISIBLE_KEY) === "1";
  } catch {
    return false;
  }
}

function applyAudioPlayVisible(visible: boolean, persist = true): void {
  audioPlayToggle.checked = visible;
  playbackBar.hidden = !visible;
  const playMenu = document.querySelector<HTMLElement>("#play-menu");
  if (playMenu) playMenu.hidden = !visible;
  if (!visible) {
    stopPlayback();
    playbackHandle = null;
  }
  if (persist) {
    try {
      localStorage.setItem(AUDIO_PLAY_VISIBLE_KEY, visible ? "1" : "0");
    } catch {
      /* private mode */
    }
  }
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

function setStatusHint(message: string): void {
  statusLine.textContent = message;
  statusLine.className = "status status-hint";
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
  // Re-show YAML tip when opening a YAML song (session Hide still applies until then).
  if (looksLikeYamlFrontMatter(text)) syntaxHelpDismissed = false;
  updateSyntaxHelp();
  render();
}

function baseName(): string {
  return currentFileName.replace(/\.(txt|cmnt)$/i, "") || "score";
}

/**
 * Scrolls a source line into view. Only selects the whole line when `force`
 * is true — live parse while typing must not steal the caret (that wiped the line).
 */
function selectSourceLine(lineNo: number, opts: { force?: boolean } = {}): void {
  const lines = sourceInput.value.split("\n");
  if (lineNo < 1 || lineNo > lines.length) return;
  let start = 0;
  for (let i = 0; i < lineNo - 1; i++) start += lines[i]!.length + 1;
  const end = start + lines[lineNo - 1]!.length;
  const lineHeight = parseFloat(getComputedStyle(sourceInput).lineHeight) || 20;
  const scrollTop = Math.max(0, (lineNo - 4) * lineHeight);
  const typingInSource = document.activeElement === sourceInput && !opts.force;
  if (typingInSource) {
    sourceInput.scrollTop = scrollTop;
    return;
  }
  sourceInput.focus();
  sourceInput.setSelectionRange(start, end);
  sourceInput.scrollTop = scrollTop;
}

function looksLikeYamlFrontMatter(text: string): boolean {
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length && lines[i]!.trim() === "") i++;
  if (i >= lines.length) return false;
  const first = lines[i]!.trim();
  // Show help as soon as the user starts a --- fence (including partial "-"/"--").
  return first === "-" || first === "--" || first.startsWith("---");
}

function updateSyntaxHelp(): void {
  if (syntaxHelpDismissed) {
    syntaxHelp.hidden = true;
    return;
  }
  const text = sourceInput.value;
  if (looksLikeYamlFrontMatter(text)) {
    syntaxHelp.hidden = false;
    syntaxHelpTitle.textContent = "YAML front matter — keys & shape";
    syntaxHelpBody.textContent = YAML_SYNTAX_HELP;
    return;
  }
  // Empty / new-song buffer: clarify classic shape (and that --- opens YAML).
  const trimmed = text.trim();
  if (trimmed === "" || trimmed === NEW_SONG_TEMPLATE.trim()) {
    syntaxHelp.hidden = false;
    syntaxHelpTitle.textContent = "CMNT source syntax";
    syntaxHelpBody.textContent = CLASSIC_SYNTAX_HELP;
    return;
  }
  syntaxHelp.hidden = true;
}

const EDITOR_SIZE_KEY = "cmnt.editorPaneSize";
const AUDIO_PLAY_VISIBLE_KEY = "cmnt.audioPlayVisible";

function isStackedLayout(): boolean {
  return window.matchMedia("(max-width: 860px)").matches;
}

function applyStoredEditorSize(): void {
  try {
    const raw = localStorage.getItem(EDITOR_SIZE_KEY);
    if (raw == null) return;
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n) || n < 160) return;
    composerEl.style.setProperty("--editor-size", `${Math.round(n)}px`);
  } catch {
    /* ignore */
  }
}

function initPaneSplitter(): void {
  applyStoredEditorSize();
  let dragging = false;

  const onPointerMove = (ev: PointerEvent): void => {
    if (!dragging) return;
    const rect = composerEl.getBoundingClientRect();
    const stacked = isStackedLayout();
    const minEditor = stacked ? 160 : 260;
    const minPreview = stacked ? 120 : 200;
    const splitter = 6;
    let size: number;
    if (stacked) {
      size = ev.clientY - rect.top;
      size = Math.max(minEditor, Math.min(rect.height - minPreview - splitter, size));
    } else {
      size = ev.clientX - rect.left;
      size = Math.max(minEditor, Math.min(rect.width - minPreview - splitter, size));
    }
    composerEl.style.setProperty("--editor-size", `${Math.round(size)}px`);
  };

  const endDrag = (ev: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    composerEl.classList.remove("resizing-panes");
    try {
      paneSplitter.releasePointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
    const cur = getComputedStyle(composerEl).getPropertyValue("--editor-size").trim();
    const n = Number.parseFloat(cur);
    if (Number.isFinite(n)) {
      try {
        localStorage.setItem(EDITOR_SIZE_KEY, String(Math.round(n)));
      } catch {
        /* ignore */
      }
    }
  };

  paneSplitter.addEventListener("pointerdown", (ev) => {
    if (ev.button !== 0) return;
    dragging = true;
    composerEl.classList.add("resizing-panes");
    paneSplitter.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  });
  paneSplitter.addEventListener("pointermove", onPointerMove);
  paneSplitter.addEventListener("pointerup", endDrag);
  paneSplitter.addEventListener("pointercancel", endDrag);
  paneSplitter.addEventListener("keydown", (ev) => {
    const step = ev.shiftKey ? 40 : 16;
    const stacked = isStackedLayout();
    const cur = Number.parseFloat(getComputedStyle(composerEl).getPropertyValue("--editor-size")) || (stacked ? 280 : 420);
    let next = cur;
    if (stacked) {
      if (ev.key === "ArrowUp") next = cur - step;
      else if (ev.key === "ArrowDown") next = cur + step;
      else return;
    } else {
      if (ev.key === "ArrowLeft") next = cur - step;
      else if (ev.key === "ArrowRight") next = cur + step;
      else return;
    }
    ev.preventDefault();
    next = Math.max(stacked ? 160 : 260, next);
    composerEl.style.setProperty("--editor-size", `${Math.round(next)}px`);
    try {
      localStorage.setItem(EDITOR_SIZE_KEY, String(Math.round(next)));
    } catch {
      /* ignore */
    }
  });
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

function syncHeaderFields(items: LayoutItem[]): void {
  const h = findRagamTalamHeading(items);
  const parts = h != null ? parseRagamTalamHeading(h.text) : null;
  if (parts == null) {
    if (!ragamNameDirty) ragamDisplay.value = "";
    loadedRagaRoman = "";
    ragamDisplay.disabled = true;
    talamDisplay.textContent = "—";
    return;
  }
  ragamDisplay.disabled = parts.ragaName == null;
  loadedRagaRoman = h?.ragaDisplayRoman ?? "";
  // Ragam field edits optional CMNT-roman display spelling (persisted).
  if (!ragamNameDirty) ragamDisplay.value = loadedRagaRoman;
  ragamDisplay.placeholder =
    parts.ragaName != null ? `optional CMNT spelling (catalogue: ${parts.ragaName})` : "optional CMNT spelling";
  // Talam is catalogue-only — show name, no custom save UI.
  talamDisplay.textContent = parts.talaName ?? "—";
}

function clearHeaderOverrides(): void {
  ragamNameDirty = false;
}

function applyDisplayNamesToSource(clear = false): void {
  const raga = clear ? "" : ragamDisplay.value.trim();
  // Only RaagamDisplay: is written; talam stays on the fixed catalogue (Tala:).
  sourceInput.value = upsertDisplayDirectives(sourceInput.value, {
    ragaRoman: raga,
  });
  ragamNameDirty = false;
  markDirty();
  render();
  setStatusOk(
    clear
      ? "Cleared RaagamDisplay: from source — File → Save to keep"
      : "Wrote RaagamDisplay: into source — File → Save to keep",
  );
}

/** On-screen preview width (px). */
const PREVIEW_CONTENT_WIDTH = 1100;
const ROW_LABEL_GUTTER = 36;
let lastGoodSvg = "";

function caretLineNumber(): number {
  const pos = sourceInput.selectionStart ?? 0;
  return sourceInput.value.slice(0, pos).split("\n").length;
}

function renderScoreAtWidth(
  contentWidth: number,
  live = false,
): {
  svg: string;
  items: LayoutItem[];
  forceScript: Script | undefined;
  warnings: { line: number; message: string; severity: "error" | "hint" }[];
} {
  const forceScript = forceScriptFor(langSelect.value as UiLangOverride);
  const song = live
    ? parse(sourceInput.value, { live: true, caretLine: caretLineNumber() })
    : parse(sourceInput.value);
  const unitWidthScale = currentSchool.density.unitWidthScale;
  const measureCellWidth = createCanvasCellMeasurer({ forceScript });
  // Cycle-fit only (JAR layoutFittingLetter). Do not mid-wrap cells — short
  // fragments get full-width stretched and look orphaned in PDF.
  const items = layoutSongFitting(song, {
    targetWidth: Math.max(50, contentWidth - ROW_LABEL_GUTTER),
    unitWidthScale,
    measureCellWidth,
  });
  const svg = renderScoreSvg(items, {
    contentWidth,
    forceScript,
    unitWidthScale,
    rowSpacingScale: currentSchool.density.rowSpacingScale,
    ragamTalamOverrides: {
      ragaRoman: ragamNameDirty ? ragamDisplay.value : loadedRagaRoman || undefined,
    },
    measureCellWidth,
  });
  return { svg, items, forceScript, warnings: song.parseWarnings };
}

/** Insert or replace DefaultSpeed: in the source (notation density 0/1/2 — not BPM). */
function upsertDefaultSpeedDirective(source: string, n: number): string {
  const line = `DefaultSpeed: ${n}`;
  const lines = source.split("\n");
  const idx = lines.findIndex((l) => /^DefaultSpeed\s*:/i.test(l.trim()));
  if (idx >= 0) {
    lines[idx] = line;
    return lines.join("\n");
  }
  let insertAt = lines.findIndex((l) => /^(Tala|Raagam|Ragam|Language)\s*:/i.test(l.trim()));
  if (insertAt < 0) {
    let sawOpen = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]!.trim() === "---") {
        if (!sawOpen) sawOpen = true;
        else {
          insertAt = i;
          break;
        }
      }
    }
  }
  if (insertAt >= 0) lines.splice(insertAt + 1, 0, line);
  else lines.unshift(line);
  return lines.join("\n");
}

function applyNotationDefaultSpeed(n: number): void {
  if (![0, 1, 2].includes(n)) return;
  sourceInput.value = upsertDefaultSpeedDirective(sourceInput.value, n);
  markDirty();
  render();
  setStatusOk(
    `DefaultSpeed: ${n} (notation density) — BPM/click are separate playback controls`,
  );
}

function render(): void {
  try {
    const { svg, items, forceScript, warnings } = renderScoreAtWidth(PREVIEW_CONTENT_WIDTH, true);
    syncHeaderFields(items);
    scorePage.innerHTML = svg;
    lastGoodSvg = svg;
    applyLangFontClass(activeIndicScript(items, forceScript));
    const hard = warnings.find((w) => w.severity === "error");
    const hint = warnings.find((w) => w.severity === "hint");
    if (hard) {
      setStatusError(`Line ${hard.line} — ${hard.message}`);
    } else if (hint) {
      setStatusHint(`Still typing (line ${hint.line}): ${hint.message}`);
    } else {
      setStatusOk(documentDirty ? "Edited — File → Save to keep your .txt" : "Ready");
    }
  } catch (err) {
    if (lastGoodSvg) scorePage.innerHTML = lastGoodSvg;
    if (err instanceof ParseException) {
      setStatusError(`Parse error: line ${err.line} — ${err.message.replace(/^line \d+:\s*/, "")}`);
      // Live update while typing: scroll only — do not select the whole line.
      selectSourceLine(err.line, { force: document.activeElement !== sourceInput });
    } else {
      const message = err instanceof Error ? err.message : String(err);
      setStatusError(`Error: ${message}`);
    }
    if (!lastGoodSvg) {
      scorePage.innerHTML = `<p class="app-error">${escapeHtml(
        err instanceof Error ? err.message : String(err),
      )}</p>`;
    }
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

function themeVarDecls(): string {
  const svgEl = currentSvgElement();
  const computed = svgEl != null ? getComputedStyle(svgEl) : getComputedStyle(scorePage);
  return EXPORT_CSS_VARS.map((name) => `${name}: ${computed.getPropertyValue(name).trim()}`).join("; ");
}

/** Standalone SVG for export (SVG/PNG). Pass a content width to re-layout. */
function buildStandaloneSvgMarkup(contentWidth?: number): string | null {
  let svgMarkup: string;
  if (contentWidth != null) {
    try {
      svgMarkup = renderScoreAtWidth(contentWidth).svg;
    } catch {
      return null;
    }
  } else {
    const svgEl = currentSvgElement();
    if (!svgEl) return null;
    svgMarkup = new XMLSerializer().serializeToString(svgEl);
  }
  return decorateSvgMarkup(svgMarkup);
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

/** Flush live ragam roman display into source before File → Save / export. */
function flushDisplayNamesIfDirty(): void {
  if (!ragamNameDirty) return;
  sourceInput.value = upsertDisplayDirectives(sourceInput.value, {
    ragaRoman: ragamDisplay.value.trim(),
  });
  ragamNameDirty = false;
  loadedRagaRoman = ragamDisplay.value.trim();
}

async function saveFile(forceSaveAs: boolean): Promise<void> {
  flushDisplayNamesIfDirty();
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

/** Decorate a raw SVG string with theme vars + app CSS (for print/export). */
function decorateSvgMarkup(svgMarkup: string): string | null {
  const doc = new DOMParser().parseFromString(svgMarkup, "image/svg+xml");
  const clone = doc.documentElement;
  if (clone == null || clone.nodeName.toLowerCase() !== "svg") return null;
  clone.setAttribute("style", themeVarDecls());
  if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const styleTag = doc.createElementNS("http://www.w3.org/2000/svg", "style");
  styleTag.textContent = stylesCssRaw;
  clone.insertBefore(styleTag, clone.firstChild);
  return new XMLSerializer().serializeToString(clone);
}

/**
 * Letter-paginated SVGs for PDF: cycle-fit layout, section-aligned columns,
 * no orphan section titles at the bottom of a page.
 */
function buildLetterPdfPages(): string[] | null {
  try {
    const forceScript = forceScriptFor(langSelect.value as UiLangOverride);
    const song = parse(sourceInput.value);
    const unitWidthScale = currentSchool.density.unitWidthScale;
    const rowSpacingScale = currentSchool.density.rowSpacingScale;
    const measureCellWidth = createCanvasCellMeasurer({ forceScript });
    const items = layoutSongFitting(song, {
      targetWidth: Math.max(50, LETTER_CONTENT_WIDTH - ROW_LABEL_GUTTER),
      unitWidthScale,
      measureCellWidth,
    });
    const pages = paginateLayoutItems(items, {
      pageContentHeight: LETTER_CONTENT_HEIGHT,
      rowSpacingScale,
    });
    const svgs: string[] = [];
    for (const pageItems of pages) {
      const raw = renderScoreSvg(pageItems, {
        contentWidth: LETTER_CONTENT_WIDTH,
        marginX: LETTER_MARGIN_X,
        marginTop: LETTER_MARGIN_Y,
        minHeight: LETTER_PAGE_HEIGHT_PX,
        forceScript,
        unitWidthScale,
        rowSpacingScale,
        ragamTalamOverrides: {
          ragaRoman: ragamNameDirty ? ragamDisplay.value : loadedRagaRoman || undefined,
        },
        measureCellWidth,
      });
      const decorated = decorateSvgMarkup(raw);
      if (decorated == null) return null;
      svgs.push(decorated);
    }
    return svgs;
  } catch {
    return null;
  }
}

/**
 * PDF via a dedicated print window: one Letter SVG per page (not one tall SVG
 * sliced by the browser). User picks “Save as PDF” in the print dialog.
 */
function exportPdf(): void {
  render(); // keep preview in sync / theme classes applied
  const pages = buildLetterPdfPages();
  if (pages == null || pages.length === 0) {
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
  const pageDivs = pages
    .map((svg, i) => `<div class="page${i === pages.length - 1 ? " page-last" : ""}">${svg}</div>`)
    .join("\n");
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
    @page { size: letter; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    .page {
      width: ${LETTER_PAGE_WIDTH_PX}px;
      height: ${LETTER_PAGE_HEIGHT_PX}px;
      margin: 0 auto;
      page-break-after: always;
      break-after: page;
      overflow: hidden;
    }
    .page-last { page-break-after: auto; break-after: auto; }
    .page svg { display: block; width: ${LETTER_PAGE_WIDTH_PX}px; height: ${LETTER_PAGE_HEIGHT_PX}px; }
  </style>
</head>
<body>
${pageDivs}
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
    void printWin.document.fonts.ready.then(() => setTimeout(triggerPrint, 80));
  } else {
    setTimeout(triggerPrint, 350);
  }
  setStatusOk(`Print dialog: ${pages.length} Letter page(s) — choose “Save as PDF”`);
}

// ---- Insert helpers ------------------------------------------------------------

/** Gamaka suffix on a swara token (must stay glued — `r~`, not `r ~`). */
const GAMAKA_MARK_RE = /^(?:\^|\/\/|\/|\\\\|\\|~~|~|=|\([^)]*\))$/;
const SWARA_WITH_GAMAKA_RE =
  /^([srgmpdn][ai]?)(['`]?)(\*?)(?:\^|\/\/|\/|\\\\|\\|~~|~|=|\([^)]*\))?(-*)$/i;

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

function replaceRange(from: number, to: number, text: string, selectEnd = true): void {
  const before = sourceInput.value.slice(0, from);
  const after = sourceInput.value.slice(to);
  sourceInput.value = before + text + after;
  const caret = selectEnd ? from + text.length : from;
  sourceInput.focus();
  sourceInput.setSelectionRange(caret, caret);
  markDirty();
  scheduleRender();
}

function wrapSelection(prefix: string, suffix: string, ok: string): boolean {
  const start = sourceInput.selectionStart ?? 0;
  const end = sourceInput.selectionEnd ?? start;
  if (start === end) {
    setStatusError("Select the notes in the S: line first");
    return false;
  }
  const raw = sourceInput.value.slice(start, end);
  const trimmed = raw.trim();
  if (!trimmed) {
    setStatusError("Select the notes in the S: line first");
    return false;
  }
  const lead = raw.indexOf(trimmed);
  replaceRange(start + lead, start + lead + trimmed.length, `${prefix}${trimmed}${suffix}`);
  setStatusOk(ok);
  return true;
}

/** Wrap highlighted notes as 2nd / 3rd / 4th speed (one/two/three paren levels). */
function wrapSelectionAsSpeed(levels: 1 | 2 | 3): void {
  const open = "( ".repeat(levels);
  const close = " )".repeat(levels);
  const label = levels === 1 ? "2nd" : levels === 2 ? "3rd" : "4th";
  wrapSelection(open, close, `${label} speed — notes share the parent beat`);
}

function attachGamakaToToken(tok: string, mark: string): string | null {
  if (!GAMAKA_MARK_RE.test(mark)) return null;
  const m = SWARA_WITH_GAMAKA_RE.exec(tok);
  if (!m) return null;
  return `${m[1]}${m[2] ?? ""}${m[3] ?? ""}${mark}${m[4] ?? ""}`;
}

/**
 * Insert a single-note gamaka. Prefers the current selection or the swara token
 * immediately left of the caret so the mark stays glued (`g/`, `r~`, `m(sp)`).
 */
function insertGamakaMark(mark: string): void {
  const start = sourceInput.selectionStart ?? 0;
  const end = sourceInput.selectionEnd ?? start;
  const value = sourceInput.value;

  if (start !== end) {
    const sel = value.slice(start, end).trim();
    if (/\s/.test(sel)) {
      const tag = mark.replace(/[^A-Za-z0-9~]/g, "") || "kh";
      wrapSelection("{ ", ` }(${tag})`, `Gamaka cluster { … }(${tag}) — fills one parent beat`);
      return;
    }
    const attached = attachGamakaToToken(sel, mark);
    if (attached != null) {
      // Expand trim: replace only the trimmed token inside the selection.
      const lead = value.slice(start, end).indexOf(sel);
      replaceRange(start + lead, start + lead + sel.length, attached);
      setStatusOk(`Gamaka → ${attached}`);
      return;
    }
  }

  const before = value.slice(0, start);
  const leftTok = /([^\s]+)$/.exec(before);
  if (leftTok) {
    const tok = leftTok[1]!;
    const attached = attachGamakaToToken(tok, mark);
    if (attached != null) {
      const tokStart = start - tok.length;
      replaceRange(tokStart, start, attached);
      setStatusOk(`Gamaka → ${attached}`);
      return;
    }
  }

  insertAtCursor(mark);
  setStatusOk("Gamaka mark needs a note — select a swara (e.g. r) or place the caret after it, then Insert → Gamaka");
}

function insertGamakaCluster(tag: string): void {
  const start = sourceInput.selectionStart ?? 0;
  const end = sourceInput.selectionEnd ?? start;
  const selected = sourceInput.value.slice(start, end).trim();
  if (selected) {
    insertAtCursor(`{ ${selected} }(${tag})`);
    setStatusOk(`Gamaka cluster { … }(${tag})`);
  } else {
    // Non-empty placeholder — empty { }(tag) is a parse error.
    const stub = `{ s r g }(${tag})`;
    insertAtCursor(stub);
    // Select the notes so the user can type over them immediately.
    const caret = sourceInput.selectionStart ?? 0;
    const notesStart = caret - stub.length + 2; // after "{ "
    const notesEnd = notesStart + 5; // "s r g"
    sourceInput.setSelectionRange(notesStart, notesEnd);
    setStatusOk(`Gamaka cluster (${tag}) — replace the selected notes, keep { }(${tag})`);
  }
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

/** Catalogue raga from the current source (`Raagam:`), if any. */
function currentCatalogueRagaName(): string {
  const m = /^(?:Raagam|Ragam)\s*:\s*(.+)$/im.exec(sourceInput.value);
  return m?.[1]?.trim() ?? "";
}

function fillEditRagaForm(name: string): void {
  const trimmed = name.trim();
  editRagaName.value = trimmed;
  const current = lookupAny(trimmed);
  if (current.kind === "MELAKARTA") {
    editRagaCurrent.textContent =
      `"${trimmed}" is melakarta ${current.melakarta} (${melakartaName(current.melakarta) ?? "?"}) — Aro/Ava is formula-fixed and cannot be edited.`;
    editRagaMel.value = String(current.melakarta);
    editRagaAro.value = "";
    editRagaAva.value = "";
    editRagaDwija.checked = false;
    editRagaMel.disabled = true;
    editRagaAro.disabled = true;
    editRagaAva.disabled = true;
    editRagaDwija.disabled = true;
    return;
  }
  editRagaMel.disabled = false;
  editRagaAro.disabled = false;
  editRagaAva.disabled = false;
  editRagaDwija.disabled = false;
  if (current.kind === "UNKNOWN") {
    editRagaCurrent.textContent =
      "(not in the library — saving will add it as a new janya)";
    editRagaMel.value = "";
    editRagaAro.value = "";
    editRagaAva.value = "";
    editRagaDwija.checked = false;
  } else {
    const melLabel = melakartaName(current.melakarta) ?? "?";
    editRagaCurrent.textContent =
      `Current: Melakarta ${current.melakarta} (${melLabel})\n` +
      `Aro: ${decodeForEditing(current.aro)}   Ava: ${decodeForEditing(current.ava)}` +
      (current.kind === "DWIJA" ? "   [dwi-madhyama]" : "");
    editRagaMel.value = String(current.melakarta);
    editRagaAro.value = decodeForEditing(current.aro);
    editRagaAva.value = decodeForEditing(current.ava);
    editRagaDwija.checked = current.kind === "DWIJA";
  }
}

function openEditRagaDialog(initialName?: string): void {
  const fromArg = initialName?.trim() ?? "";
  const fromSource = currentCatalogueRagaName();
  const name = fromArg || fromSource || "Hamsadwani";
  fillEditRagaForm(name);
  if (typeof editRagaDialog.showModal === "function") {
    editRagaDialog.showModal();
  } else {
    editRagaDialog.setAttribute("open", "");
  }
  editRagaName.focus();
}

function saveEditRagaFromForm(): boolean {
  const name = editRagaName.value.trim();
  if (name === "") {
    setStatusError("Raga name can't be empty");
    return false;
  }
  const looked = lookupAny(name);
  if (looked.kind === "MELAKARTA") {
    setStatusError(`"${name}" is a melakarta — Aro/Ava can't be edited`);
    return false;
  }
  const mel = Number.parseInt(editRagaMel.value.trim(), 10);
  if (!Number.isFinite(mel) || mel < 1 || mel > 72) {
    setStatusError("Melakarta # must be 1–72");
    return false;
  }
  try {
    applyCorrection(name, mel, editRagaAro.value, editRagaAva.value, editRagaDwija.checked);
  } catch (err) {
    setStatusError(err instanceof Error ? err.message : String(err));
    return false;
  }
  render();
  setStatusOk(`Saved "${name}" to this browser’s raga library — ArO/avarO on the score is updated`);
  return true;
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
  if (!isAudioPlayVisible()) {
    setStatusOk("Turn on Audio play in the toolbar to hear a synthesized sketch");
    return;
  }
  try {
    const song = parse(sourceInput.value);
    const bpm = currentBpm();
    const speed = currentPlaybackSpeed();
    const click = currentClickEnabled();
    const instrument = currentInstrumentId();
    playbackHandle = await playSong(song, { bpm, speed, click, instrument });
    const instLabel = INSTRUMENTS.find((i) => i.id === instrument)?.label ?? instrument;
    const clickNote = click ? ", click on" : ", click off";
    setStatusOk(`Playing ${instLabel} @ ${bpm} BPM × ${speed.toFixed(2)}${clickNote} — Stop to cancel`);
  } catch (err) {
    if (err instanceof ParseException) {
      setStatusError(`Play failed: line ${err.line} — ${err.message.replace(/^line \d+:\s*/, "")}`);
      selectSourceLine(err.line, { force: true });
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
    { label: "Kampita (shake)  ~", action: () => insertGamakaMark("~") },
    { label: "Kampita (heavy)  ~~", action: () => insertGamakaMark("~~") },
    { label: "Slide up (etRa jAru)  /", action: () => insertGamakaMark("/") },
    { label: "Slide up, long  //", action: () => insertGamakaMark("//") },
    { label: "Slide down (iRakka jAru)  \\", action: () => insertGamakaMark("\\") },
    { label: "Slide down, long  \\\\", action: () => insertGamakaMark("\\\\") },
    { label: "Ravai  ^", action: () => insertGamakaMark("^") },
    { label: "Sustain  =", action: () => insertGamakaMark("=") },
    { separator: true },
    { label: "Volume soft  (v1)", action: () => insertGamakaMark("(v1)") },
    { label: "Volume medium  (v2)", action: () => insertGamakaMark("(v2)") },
    { label: "Volume loud  (v3)", action: () => insertGamakaMark("(v3)") },
    { separator: true },
    { label: "Sphurita  (sp)", action: () => insertGamakaMark("(sp)") },
    { label: "Pratyaghata  (pr)", action: () => insertGamakaMark("(pr)") },
    { label: "Nokku / tirupa  (w)", action: () => insertGamakaMark("(w)") },
    { label: "VaLi  (vl)", action: () => insertGamakaMark("(vl)") },
    { separator: true },
    { label: "Khandippu cluster  { }(kh)", action: () => insertGamakaCluster("kh") },
    { label: "Odukkal cluster  { }(od)", action: () => insertGamakaCluster("od") },
    { label: "Orikai cluster  { }(or)", action: () => insertGamakaCluster("or") },
    { label: "VaLi cluster  { }(vl)", action: () => insertGamakaCluster("vl") },
    { label: "Kampita cluster  { }(~)", action: () => insertGamakaCluster("~") },
  ];

  const speedItems: MenuItem[] = [
    { label: "2nd speed  ( … )", action: () => wrapSelectionAsSpeed(1) },
    { label: "3rd speed  (( … ))", action: () => wrapSelectionAsSpeed(2) },
    { label: "4th speed  ((( … )))", action: () => wrapSelectionAsSpeed(3) },
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
      id: "play-menu",
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
        { label: "Speed (2nd / 3rd / 4th)", submenu: speedItems },
        { label: "Language", submenu: languageItems },
        { separator: true },
        {
          label: "Raagam Name…",
          action: () => promptAndInsert("Raagam name (roman catalogue spelling)", (v) => `Raagam: ${v}\n`, "Sri"),
        },
        {
          label: "Edit Raga (Aro/Ava)…",
          action: () => openEditRagaDialog(),
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
        {
          label: "Default Speed…",
          action: () => {
            const v = window.prompt(
              "Notation DefaultSpeed (0/1/2 — note density for ( ) nesting).\nBPM tempo is set in the playback bar.",
              "0",
            );
            if (v == null || !/^[012]$/.test(v.trim())) return;
            applyNotationDefaultSpeed(Number.parseInt(v.trim(), 10));
          },
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
audioPlayToggle.addEventListener("change", () => {
  applyAudioPlayVisible(audioPlayToggle.checked);
  setStatusOk(
    audioPlayToggle.checked
      ? "Audio play on — experimental sketch, not a finished gamaka model"
      : "Audio play hidden",
  );
});
speedSlider.addEventListener("input", () => {
  updateSpeedLabel();
});
bpmInput.addEventListener("change", () => {
  bpmInput.value = String(currentBpm());
  setStatusOk(`BPM → ${currentBpm()}${currentClickEnabled() ? " (click on)" : ""}`);
});
clickToggle.addEventListener("change", () => {
  setStatusOk(currentClickEnabled() ? `Click on @ ${currentBpm()} BPM` : "Click off (silent beat)");
});
instrumentSelect.addEventListener("change", () => {
  const inst = INSTRUMENTS.find((i) => i.id === instrumentSelect.value);
  setStatusOk(`Instrument → ${inst?.label ?? instrumentSelect.value}`);
});
ragamDisplay.addEventListener("input", () => {
  ragamNameDirty = true;
  scheduleRender();
});
saveHeadersBtn.addEventListener("click", () => applyDisplayNamesToSource(false));
resetHeadersBtn.addEventListener("click", () => applyDisplayNamesToSource(true));
editRagaBtn.addEventListener("click", () => openEditRagaDialog());
editRagaName.addEventListener("change", () => fillEditRagaForm(editRagaName.value));
editRagaForm.addEventListener("submit", (ev) => {
  const submitter = (ev as SubmitEvent).submitter as HTMLButtonElement | null;
  if (submitter?.value === "cancel") return;
  ev.preventDefault();
  if (saveEditRagaFromForm()) editRagaDialog.close();
});
syntaxHelpDismiss.addEventListener("click", () => {
  syntaxHelpDismissed = true;
  syntaxHelp.hidden = true;
});
openFileInput.addEventListener("change", () => {
  const file = openFileInput.files?.[0];
  if (file) void openFileFromInput(file);
});
sourceInput.addEventListener("input", () => {
  markDirty();
  updateSyntaxHelp();
  scheduleRender();
});
sourceInput.addEventListener("keyup", (ev) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "Enter"].includes(ev.key)) {
    scheduleRender();
  }
});
sourceInput.addEventListener("click", () => scheduleRender());
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
    if (!isAudioPlayVisible()) return;
    ev.preventDefault();
    void playFromStart();
  } else if (key === ".") {
    if (!isAudioPlayVisible()) return;
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
initPaneSplitter();
buildAppMenus();
applyAudioPlayVisible(readStoredAudioPlayVisible(), false);
updateDocTitle();
sourceInput.value = FIXTURES[fixtureSelect.value] ?? "";
currentFileName = `${fixtureSelect.value || "Untitled"}.txt`;
markClean();
updateSyntaxHelp();
applySchool(schoolSelect.value as SchoolId);
