/**
 * Web Audio playback for a laid-out CMNT song (browser port of JAR Playback.java).
 *
 * Builds a timed note list from layout cells using melakarta / Aro-Ava pitch
 * mapping, then schedules oscillators. No MIDI dependency — works in the
 * composer preview. Gamaka envelopes are a light sketch (kampita vibrato,
 * slide expression via gain), not a full violin/gamaka synthesis.
 */
import type { Song } from "../model/Song.js";
import { Heading } from "../model/Heading.js";
import { layoutSong, VisualRow, type LayoutItem } from "./Layout.js";
import { melakartaVariants, VARIANT_SEMITONE } from "./Melakarta.js";

const DEFAULT_SEMITONE: Readonly<Record<string, number>> = {
  s: 0,
  r: 2,
  g: 4,
  m: 5,
  p: 7,
  d: 9,
  n: 11,
};

const ARO_TOKEN = /([RGMDNrgmdn])([123])/g;
const VOLUME_TAG = /v([123])/i;

const TONIC_MIDI = 60;
const SECONDS_PER_AKSHARA = 0.55; // ~BASE_BPM 60 feel
const LEVEL_GAIN = [0, 0.18, 0.32, 0.48] as const;

export type PlannedNote = {
  startSec: number;
  endSec: number;
  midi: number;
  volumeLevel: number;
  kampita: boolean;
  slideUp: boolean;
  slideDown: boolean;
};

export type DynMark = { volumeLevel: number | null; gamaka: string | null };

export function parseDynMark(raw: string | null | undefined): DynMark {
  if (raw == null || raw.trim() === "") return { volumeLevel: null, gamaka: null };
  let g = raw.trim();
  let volumeLevel: number | null = null;
  const m = VOLUME_TAG.exec(g);
  if (m) {
    volumeLevel = Number.parseInt(m[1]!, 10);
    g = (g.slice(0, m.index) + g.slice(m.index + m[0].length)).trim();
  }
  return { volumeLevel, gamaka: g === "" ? null : g };
}

export function extractRagaMapping(song: Song): Map<string, number> {
  const found = new Map<string, number>();
  for (const part of song.parts) {
    if (!(part instanceof Heading)) continue;
    const text = part.text;
    if (text == null) continue;
    const low = text.toLowerCase();
    if (!low.includes("aro") && !low.includes("ava")) continue;
    ARO_TOKEN.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = ARO_TOKEN.exec(text)) !== null) {
      const letter = m[1]!.toLowerCase();
      const key = letter + m[2]!;
      const semi = VARIANT_SEMITONE[key];
      if (semi != null && !found.has(letter)) found.set(letter, semi);
    }
  }
  return found;
}

function semitoneMapForSong(song: Song): Map<string, number> {
  const map = new Map<string, number>(Object.entries(DEFAULT_SEMITONE));
  if (song.melakarta != null) {
    const mk = melakartaVariants(song.melakarta);
    for (const [k, v] of Object.entries(mk)) {
      if (v != null) map.set(k, v);
    }
  }
  for (const [k, v] of extractRagaMapping(song)) map.set(k, v);
  return map;
}

/** Plan timed notes from a song (layout → swara cells). Pure; no audio. */
export function planNotes(song: Song, items?: LayoutItem[]): PlannedNote[] {
  const semitones = semitoneMapForSong(song);
  const layout = items ?? layoutSong(song);
  const notes: PlannedNote[] = [];
  let t = 0;
  let open: PlannedNote | null = null;
  let level = 2;
  let prevMidi: number | null = null;

  for (const it of layout) {
    if (!(it instanceof VisualRow)) continue;
    for (const c of it.cells) {
      if (c.kind !== "swara") continue;
      const dur = Math.max(c.duration.doubleValue(), 0) * SECONDS_PER_AKSHARA;
      if (dur <= 0) continue;

      if (c.isRest) {
        if (open != null) {
          open.endSec = t;
          notes.push(open);
          open = null;
        }
        t += dur;
        continue;
      }
      if (c.isSustain) {
        t += dur;
        continue;
      }

      const base = c.text.replace("*", "").trim();
      const letter = base.length > 0 ? base[0]!.toLowerCase() : null;
      const semi = letter == null ? undefined : semitones.get(letter);
      if (semi == null) {
        t += dur;
        continue;
      }

      const midi = TONIC_MIDI + semi + 12 * c.octave;
      const dyn = parseDynMark(c.gamaka);
      let gamaka = dyn.gamaka;

      if (dyn.volumeLevel != null) level = dyn.volumeLevel;
      else if (prevMidi != null) {
        if (midi > prevMidi) level = Math.min(3, level + 1);
        else if (midi < prevMidi) level = Math.max(1, level - 1);
      }

      if (open != null) {
        open.endSec = t;
        notes.push(open);
      }

      let kampita = gamaka === "~" || gamaka === "~~";
      let slideUp = gamaka === "/" || gamaka === "//";
      let slideDown = gamaka === "\\" || gamaka === "\\\\";
      if (!kampita && !slideUp && !slideDown && gamaka != null) {
        const gl = gamaka.toLowerCase();
        if (gl === "kh" || gl === "or" || gl === "pr") slideDown = true;
        if (gl === "sp") slideUp = true;
      }

      open = {
        startSec: t,
        endSec: t,
        midi,
        volumeLevel: level,
        kampita,
        slideUp,
        slideDown,
      };
      prevMidi = midi;
      t += dur;
    }
  }
  if (open != null) {
    open.endSec = t;
    notes.push(open);
  }
  return notes;
}

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export type PlaybackHandle = {
  stop: () => void;
  readonly playing: boolean;
};

let activeHandle: PlaybackHandle | null = null;

/** Stop any in-flight playback. */
export function stopPlayback(): void {
  activeHandle?.stop();
  activeHandle = null;
}

/**
 * Play a song via Web Audio. Returns a handle; calling stop() or starting
 * another play cancels the current one.
 */
export async function playSong(song: Song, opts: { bpmScale?: number } = {}): Promise<PlaybackHandle> {
  stopPlayback();
  const AudioCtx =
    typeof globalThis !== "undefined"
      ? (globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
          .AudioContext ??
        (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : undefined;
  if (AudioCtx == null) {
    throw new Error("Web Audio API is not available in this environment");
  }

  const ctx = new AudioCtx();
  if (ctx.state === "suspended") await ctx.resume();

  const scale = opts.bpmScale ?? 1;
  const notes = planNotes(song).map((n) => ({
    ...n,
    startSec: n.startSec / scale,
    endSec: n.endSec / scale,
  }));

  const master = ctx.createGain();
  master.gain.value = 0.85;
  master.connect(ctx.destination);

  const startAt = ctx.currentTime + 0.05;
  const oscillators: OscillatorNode[] = [];

  for (const n of notes) {
    const dur = Math.max(0.04, n.endSec - n.startSec);
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    const baseHz = midiToHz(n.midi);
    osc.frequency.setValueAtTime(baseHz, startAt + n.startSec);

    if (n.kampita) {
      const depth = n.volumeLevel >= 3 ? 18 : 12;
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = n.volumeLevel >= 3 ? 5.5 : 4.5;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = depth;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(startAt + n.startSec);
      lfo.stop(startAt + n.endSec + 0.02);
    } else if (n.slideUp) {
      osc.frequency.setValueAtTime(baseHz * 0.94, startAt + n.startSec);
      osc.frequency.linearRampToValueAtTime(baseHz, startAt + n.startSec + Math.min(0.18, dur * 0.4));
    } else if (n.slideDown) {
      osc.frequency.setValueAtTime(baseHz * 1.06, startAt + n.startSec);
      osc.frequency.linearRampToValueAtTime(baseHz, startAt + n.startSec + Math.min(0.18, dur * 0.4));
    }

    const g = ctx.createGain();
    const peak = LEVEL_GAIN[n.volumeLevel] ?? LEVEL_GAIN[2];
    const t0 = startAt + n.startSec;
    const t1 = startAt + n.endSec;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
    g.gain.setValueAtTime(peak, Math.max(t0 + 0.02, t1 - 0.04));
    g.gain.exponentialRampToValueAtTime(0.0001, t1);

    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t1 + 0.03);
    oscillators.push(osc);
  }

  let playing = true;
  const handle: PlaybackHandle = {
    get playing() {
      return playing;
    },
    stop() {
      if (!playing) return;
      playing = false;
      for (const o of oscillators) {
        try {
          o.stop();
        } catch {
          /* already stopped */
        }
      }
      void ctx.close();
      if (activeHandle === handle) activeHandle = null;
    },
  };
  activeHandle = handle;

  const totalMs = notes.length === 0 ? 0 : Math.max(...notes.map((n) => n.endSec)) * 1000 + 80;
  if (totalMs > 0) {
    setTimeout(() => {
      if (activeHandle === handle) handle.stop();
    }, totalMs + 50);
  } else {
    handle.stop();
  }
  return handle;
}
