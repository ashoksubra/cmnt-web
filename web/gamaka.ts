/**
 * Gamaka modeler page. The pitch plan lives in SspGamakaModel; this file
 * draws it and plays it with Web Audio.
 */

import { melakartaName } from "@cmnt/core/Ragas";
import {
  SSP_GAMAKAS,
  formatGamakaPath,
  formatScaleStep,
  isSspGamakaId,
  parsePhrase,
  planGamaka,
  scaleStep,
  sspGamaka,
  stepMidi,
  type ContourPoint,
  type GamakaContour,
  type GamakaDirection,
  type SspGamakaId,
  type SwaraLetter,
} from "@cmnt/core/SspGamakaModel";

const SVG_NS = "http://www.w3.org/2000/svg";

const PITCHES: readonly { pc: number; label: string }[] = [
  { pc: 0, label: "C · 1 kattai" },
  { pc: 1, label: "C♯ · 1½" },
  { pc: 2, label: "D · 2" },
  { pc: 3, label: "D♯ · 2½" },
  { pc: 4, label: "E · 3" },
  { pc: 5, label: "F · 4" },
  { pc: 6, label: "F♯ · 4½" },
  { pc: 7, label: "G · 5" },
  { pc: 8, label: "G♯ · 5½" },
  { pc: 9, label: "A · 6" },
  { pc: 10, label: "A♯ · 6½" },
  { pc: 11, label: "B · 7" },
];

const list = document.querySelector<HTMLElement>("#gamaka-list")!;
const summary = document.querySelector<HTMLElement>("#gamaka-summary")!;
const melaSelect = document.querySelector<HTMLSelectElement>("#mela")!;
const shrutiSelect = document.querySelector<HTMLSelectElement>("#shruti")!;
const saOctaveSelect = document.querySelector<HTMLSelectElement>("#sa-octave")!;
const swaraSelect = document.querySelector<HTMLSelectElement>("#swara")!;
const sthayiSelect = document.querySelector<HTMLSelectElement>("#sthayi")!;
const directionField = document.querySelector<HTMLElement>("#direction-field")!;
const directionSelect = document.querySelector<HTMLSelectElement>("#direction")!;
const spanField = document.querySelector<HTMLElement>("#span-field")!;
const spanLabel = document.querySelector<HTMLElement>("#span-label")!;
const spanInput = document.querySelector<HTMLInputElement>("#span")!;
const phraseInput = document.querySelector<HTMLInputElement>("#phrase")!;
const aksharaInput = document.querySelector<HTMLInputElement>("#aksharas")!;
const bpmInput = document.querySelector<HTMLInputElement>("#bpm")!;
const mixAField = document.querySelector<HTMLElement>("#mix-a-field")!;
const mixBField = document.querySelector<HTMLElement>("#mix-b-field")!;
const mixASelect = document.querySelector<HTMLSelectElement>("#mix-a")!;
const mixBSelect = document.querySelector<HTMLSelectElement>("#mix-b")!;
const graph = document.querySelector<SVGSVGElement>("#gamaka-graph")!;
const pathLine = document.querySelector<HTMLElement>("#gamaka-path")!;
const metaLine = document.querySelector<HTMLElement>("#gamaka-meta")!;
const playBtn = document.querySelector<HTMLButtonElement>("#play-btn")!;
const stopBtn = document.querySelector<HTMLButtonElement>("#stop-btn")!;

let currentId: SspGamakaId = "kampita";
let playGen = 0;
let playing: { ctx: AudioContext; oscs: OscillatorNode[]; raf: number } | null = null;

function el(name: string, attrs: Record<string, string | number>): SVGElement {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

function fillSelect(select: HTMLSelectElement, options: { value: string; label: string }[], selected: string): void {
  select.replaceChildren();
  for (const opt of options) {
    const node = document.createElement("option");
    node.value = opt.value;
    node.textContent = opt.label;
    if (opt.value === selected) node.selected = true;
    select.append(node);
  }
}

function shrutiLabel(pc: number, octave: number): string {
  const name = PITCHES.find((p) => p.pc === pc)?.label.split(" · ")[0] ?? "C";
  return `${name}${octave}`;
}

function tonicMidi(): number {
  const pc = Number.parseInt(shrutiSelect.value, 10) || 0;
  const octave = Number.parseInt(saOctaveSelect.value, 10) || 4;
  return (octave + 1) * 12 + pc;
}

function readDirection(): GamakaDirection {
  return directionSelect.value === "avarohana" ? "avarohana" : "arohana";
}

function readSwara(): SwaraLetter {
  const value = swaraSelect.value;
  return value === "r" || value === "g" || value === "m" || value === "p" || value === "d" || value === "n"
    ? value
    : "s";
}

function readMix(select: HTMLSelectElement, fallback: SspGamakaId): SspGamakaId {
  return isSspGamakaId(select.value) && select.value !== "misrita" ? select.value : fallback;
}

function readPhrase(): ReturnType<typeof parsePhrase> {
  return parsePhrase(phraseInput.value, Number.parseInt(sthayiSelect.value, 10) || 0);
}

function currentContour(): GamakaContour {
  const gamaka = sspGamaka(currentId);
  const phrase = readPhrase();
  return planGamaka({
    id: currentId,
    melakarta: Number.parseInt(melaSelect.value, 10) || 29,
    swara: readSwara(),
    octave: Number.parseInt(sthayiSelect.value, 10) || 0,
    direction: readDirection(),
    span: Number.parseInt(spanInput.value, 10) || gamaka.defaultSpan,
    aksharas: Number.parseInt(aksharaInput.value, 10) || 2,
    bpm: Number.parseInt(bpmInput.value, 10) || 60,
    tonicMidi: tonicMidi(),
    phrase: phrase.notes,
    mixA: readMix(mixASelect, "etraJaru"),
    mixB: readMix(mixBSelect, "kampita"),
  });
}

function midiHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

function stop(): void {
  playGen += 1;
  if (!playing) return;
  cancelAnimationFrame(playing.raf);
  const { ctx, oscs } = playing;
  for (const osc of oscs) {
    try {
      osc.stop();
    } catch {
      /* already stopped */
    }
  }
  void ctx.close();
  playing = null;
  const head = graph.querySelector("#playhead");
  if (head) head.setAttribute("opacity", "0");
}

function scheduleVoice(
  ctx: AudioContext,
  master: GainNode,
  points: readonly ContourPoint[],
  voice: number,
  t0: number,
  duration: number,
): OscillatorNode {
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(master);
  const pitchAt = (i: number): number => {
    const pitches = points[i]!.pitches;
    return pitches[Math.min(voice, pitches.length - 1)]!;
  };
  osc.frequency.setValueAtTime(midiHz(pitchAt(0)), t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(Math.max(0.0001, points[0]!.gain), t0 + 0.015);
  let lastFreq = t0;
  let lastGain = t0 + 0.015;
  for (let i = 1; i < points.length; i++) {
    const point = points[i]!;
    const t = t0 + point.sec;
    if (t <= lastFreq + 1e-4) continue;
    const hz = midiHz(pitchAt(i));
    if (point.slide) osc.frequency.linearRampToValueAtTime(hz, t);
    else osc.frequency.setValueAtTime(hz, t);
    lastFreq = t;
    const level = Math.max(0.0001, point.gain);
    const prev = t0 + points[i - 1]!.sec;
    if (!point.slide && t - prev > 0.03 && t - 0.012 > lastGain) {
      gain.gain.linearRampToValueAtTime(0.0001, t - 0.012);
      gain.gain.linearRampToValueAtTime(level, Math.min(t0 + duration, t + 0.012));
      lastGain = t + 0.012;
    } else if (t > lastGain) {
      gain.gain.linearRampToValueAtTime(level, t);
      lastGain = t;
    }
  }
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
  return osc;
}

async function play(contour: GamakaContour): Promise<void> {
  stop();
  const gen = playGen;
  const ctx = new AudioContext();
  await ctx.resume();
  if (gen !== playGen) {
    void ctx.close();
    return;
  }
  const master = ctx.createGain();
  master.gain.value = 0.2;
  master.connect(ctx.destination);
  const t0 = ctx.currentTime + 0.05;
  const voices = Math.max(...contour.points.map((p) => p.pitches.length));
  const oscs: OscillatorNode[] = [];
  for (let v = 0; v < voices; v++) {
    oscs.push(scheduleVoice(ctx, master, contour.points, v, t0, contour.durationSec));
  }
  const padL = 72;
  const plotW = 800 - padL - 16;
  const tick = (): void => {
    if (!playing || playing.ctx !== ctx) return;
    const head = graph.querySelector("#playhead");
    const x = padL + Math.min(1, Math.max(0, (ctx.currentTime - t0) / contour.durationSec)) * plotW;
    if (head) {
      head.setAttribute("x1", String(x));
      head.setAttribute("x2", String(x));
      head.setAttribute("opacity", ctx.currentTime < t0 + contour.durationSec ? "1" : "0");
    }
    if (ctx.currentTime < t0 + contour.durationSec + 0.05) playing.raf = requestAnimationFrame(tick);
  };
  playing = { ctx, oscs, raf: requestAnimationFrame(tick) };
  void ctx.resume();
}

function scaleGrid(contour: GamakaContour, lo: number, hi: number): { midi: number; label: string }[] {
  const rows: { midi: number; label: string }[] = [];
  for (let octave = -2; octave <= 3; octave++) {
    for (const letter of ["s", "r", "g", "m", "p", "d", "n"] as const) {
      const step = scaleStep(contour.melakarta, letter, octave, 0);
      const midi = stepMidi(step, contour.tonicMidi);
      if (midi < lo - 0.2 || midi > hi + 0.2) continue;
      rows.push({ midi, label: formatScaleStep(step, contour.melakarta) });
    }
  }
  return rows;
}

type TrendPoint = { x: number; y: number; gain: number };

/** Smooth a run of pitch points. Volume is interpolated, not splined, so it does not overshoot. */
function trendSamples(points: readonly TrendPoint[]): TrendPoint[] {
  if (points.length < 2) return [...points];
  const out: TrendPoint[] = [];
  const at = (i: number): TrendPoint => points[Math.max(0, Math.min(points.length - 1, i))]!;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const steps = 10;
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
        gain: p1.gain + (p2.gain - p1.gain) * t,
      });
    }
  }
  const last = points[points.length - 1]!;
  out.push(last);
  return out;
}

/**
 * Split where the pitch jumps. The note just left is held until the pluck,
 * so a struck tone still has length. A slide stays one curve.
 */
function trendRuns(points: readonly TrendPoint[], slides: readonly boolean[]): TrendPoint[][] {
  const runs: TrendPoint[][] = [];
  let run: TrendPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const point = points[i]!;
    if (i > 0 && !slides[i] && run.length > 0) {
      const held = run[run.length - 1]!;
      if (point.x - held.x > 0.4) run.push({ x: point.x, y: held.y, gain: held.gain });
      runs.push(run);
      run = [];
    }
    run.push(point);
  }
  if (run.length > 0) runs.push(run);
  return runs;
}

/** Closed outline whose thickness follows gain: quiet is thin, a waxing tone swells. */
function volumeRibbon(samples: readonly TrendPoint[]): string {
  if (samples.length < 2) return "";
  const left: string[] = [];
  const right: string[] = [];
  let nx = 0;
  let ny = -1;
  for (let i = 0; i < samples.length; i++) {
    const prev = samples[Math.max(0, i - 1)]!;
    const next = samples[Math.min(samples.length - 1, i + 1)]!;
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy);
    if (len > 0.5) {
      nx = -dy / len;
      ny = dx / len;
    }
    const half = 1.4 + Math.max(0, samples[i]!.gain) * 8;
    const p = samples[i]!;
    left.push(`${(p.x + nx * half).toFixed(2)},${(p.y + ny * half).toFixed(2)}`);
    right.push(`${(p.x - nx * half).toFixed(2)},${(p.y - ny * half).toFixed(2)}`);
  }
  right.reverse();
  return `M${left[0]} L${left.slice(1).join(" L")} L${right.join(" L")} Z`;
}

function centerline(samples: readonly TrendPoint[]): string {
  if (samples.length === 0) return "";
  return samples
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");
}

function draw(contour: GamakaContour): void {
  graph.replaceChildren();
  const padL = 72;
  const padR = 16;
  const padT = 18;
  const padB = 28;
  const width = 800;
  const height = 340;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const heard = contour.points.flatMap((p) => [...p.pitches]);
  let lo = Math.min(...heard);
  let hi = Math.max(...heard);
  if (hi - lo < 3) {
    const mid = (hi + lo) / 2;
    lo = mid - 1.5;
    hi = mid + 1.5;
  }
  lo -= 0.4;
  hi += 0.4;
  const xOf = (sec: number): number => padL + (sec / contour.durationSec) * plotW;
  const yOf = (midi: number): number => padT + ((hi - midi) / (hi - lo)) * plotH;

  for (const row of scaleGrid(contour, lo, hi)) {
    const y = yOf(row.midi);
    graph.append(el("line", { x1: padL, x2: width - padR, y1: y, y2: y, stroke: "#e2e8f0", "stroke-width": 1 }));
    const label = el("text", { x: 8, y: y + 4, fill: "#64748b", "font-size": 11 });
    label.textContent = row.label;
    graph.append(label);
  }

  for (let i = 0; i <= contour.aksharas; i++) {
    const x = xOf((i / contour.aksharas) * contour.durationSec);
    graph.append(
      el("line", { x1: x, x2: x, y1: padT, y2: padT + plotH, stroke: "#e2e8f0", "stroke-width": 1 }),
    );
    if (i < contour.aksharas) {
      const tick = el("text", {
        x: xOf(((i + 0.5) / contour.aksharas) * contour.durationSec),
        y: height - 8,
        fill: "#94a3b8",
        "font-size": 11,
        "text-anchor": "middle",
      });
      tick.textContent = String(i + 1);
      graph.append(tick);
    }
  }

  const voiceCount = Math.max(...contour.points.map((p) => p.pitches.length));
  const slides = contour.points.map((p) => p.slide);
  for (let v = voiceCount - 1; v >= 0; v--) {
    const knots: TrendPoint[] = contour.points.map((p) => ({
      x: xOf(p.sec),
      y: yOf(p.pitches[Math.min(v, p.pitches.length - 1)]!),
      gain: p.gain,
    }));
    for (const run of trendRuns(knots, slides)) {
      if (run.length === 1 && v === 0) {
        const p = run[0]!;
        const r = 1.4 + Math.max(0, p.gain) * 4;
        graph.append(el("circle", { cx: p.x, cy: p.y, r, fill: "#1d4ed8" }));
        continue;
      }
      const smooth = trendSamples(run);
      if (v === 0) {
        const ribbon = volumeRibbon(smooth);
        if (ribbon) {
          graph.append(
            el("path", {
              d: ribbon,
              fill: "#93c5fd",
              stroke: "none",
            }),
          );
        }
      }
      const line = centerline(smooth);
      if (!line) continue;
      const stroke: Record<string, string | number> = {
        d: line,
        fill: "none",
        stroke: v === 0 ? "#1d4ed8" : "#94a3b8",
        "stroke-width": v === 0 ? 1.6 : 1.35,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      };
      if (v !== 0) stroke["stroke-dasharray"] = "5 4";
      graph.append(el("path", stroke));
    }
  }

  graph.append(
    el("line", {
      id: "playhead",
      x1: padL,
      x2: padL,
      y1: padT,
      y2: padT + plotH,
      stroke: "#dc2626",
      "stroke-width": 1.5,
      opacity: 0,
    }),
  );
  graph.setAttribute(
    "aria-label",
    `${sspGamaka(contour.id).name}: ${formatGamakaPath(contour.path, contour.melakarta)}`,
  );
}

function syncSpanControl(): void {
  const gamaka = sspGamaka(currentId);
  const grouped = readPhrase().notes.length >= 2;
  const fixed = gamaka.minSpan === gamaka.maxSpan;
  spanField.hidden = fixed || grouped;
  spanLabel.textContent = fixed ? "Notes" : `${gamaka.spanLabel} (${gamaka.minSpan}–${gamaka.maxSpan})`;
  spanInput.min = String(gamaka.minSpan);
  spanInput.max = String(gamaka.maxSpan);
  spanInput.disabled = fixed;
  const span = Number.parseInt(spanInput.value, 10);
  if (!Number.isFinite(span) || span < gamaka.minSpan || span > gamaka.maxSpan) {
    spanInput.value = String(gamaka.defaultSpan);
  }
  directionField.hidden = !gamaka.usesDirection;
  const mixed = currentId === "misrita";
  mixAField.hidden = !mixed;
  mixBField.hidden = !mixed;
}

function render(): void {
  syncSpanControl();
  const contour = currentContour();
  const gamaka = sspGamaka(contour.id);
  summary.textContent = gamaka.summary;
  const phrase = formatGamakaPath(contour.path, contour.melakarta);
  pathLine.textContent = phrase;
  const pc = ((contour.tonicMidi % 12) + 12) % 12;
  const octave = Math.floor(contour.tonicMidi / 12) - 1;
  const named = readPhrase();
  const countNote =
    named.truncated ? " · first 8 notes" : named.notes.length >= 2 ? ` · ${named.notes.length} notes` : "";
  const volumeNote = " · curve thickens as volume waxes";
  metaLine.textContent = `${contour.aksharas} aksharakala${contour.aksharas === 1 ? "" : "s"} · ${contour.durationSec.toFixed(1)} s · ${contour.bpm} BPM · Sa = ${shrutiLabel(pc, octave)}${countNote}${volumeNote}`;
  draw(contour);
  for (const button of list.querySelectorAll<HTMLButtonElement>("button")) {
    const on = button.dataset.id === currentId;
    button.setAttribute("aria-selected", on ? "true" : "false");
  }
}

function selectGamaka(id: SspGamakaId): void {
  currentId = id;
  spanInput.value = String(sspGamaka(id).defaultSpan);
  stop();
  render();
}

function buildList(): void {
  let group = "";
  for (const gamaka of SSP_GAMAKAS) {
    if (gamaka.group !== group) {
      group = gamaka.group;
      const heading = document.createElement("div");
      heading.className = "gamaka-group";
      heading.textContent = group;
      list.append(heading);
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gamaka-item";
    button.dataset.id = gamaka.id;
    button.setAttribute("role", "option");
    button.title = gamaka.summary;
    const mark = document.createElement("span");
    mark.className = "gamaka-symbol";
    mark.textContent = gamaka.symbol;
    const name = document.createElement("span");
    name.textContent = gamaka.name;
    button.append(mark, name);
    button.addEventListener("click", () => {
      if (isSspGamakaId(gamaka.id)) selectGamaka(gamaka.id);
    });
    list.append(button);
  }
}

const mixOptions = SSP_GAMAKAS.filter((g) => g.id !== "misrita").map((g) => ({
  value: g.id,
  label: g.name,
}));

fillSelect(
  melaSelect,
  Array.from({ length: 72 }, (_, i) => {
    const n = i + 1;
    return { value: String(n), label: `${n} · ${melakartaName(n) ?? ""}` };
  }),
  "29",
);
fillSelect(
  shrutiSelect,
  PITCHES.map((p) => ({ value: String(p.pc), label: p.label })),
  "0",
);
fillSelect(mixASelect, mixOptions, "etraJaru");
fillSelect(mixBSelect, mixOptions, "kampita");
buildList();

for (const node of [
  melaSelect,
  shrutiSelect,
  saOctaveSelect,
  swaraSelect,
  sthayiSelect,
  directionSelect,
  spanInput,
  phraseInput,
  aksharaInput,
  bpmInput,
  mixASelect,
  mixBSelect,
]) {
  node.addEventListener("input", () => {
    stop();
    render();
  });
  node.addEventListener("change", () => {
    stop();
    render();
  });
}

playBtn.addEventListener("click", () => play(currentContour()));
stopBtn.addEventListener("click", stop);

render();
