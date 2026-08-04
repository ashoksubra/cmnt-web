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

/** Web-Audio instrument voices (JAR-style picker; synthesized, not SoundFonts). */
export type InstrumentId = "shehnai" | "flute" | "violin" | "sitar" | "piano";

export type Instrument = {
  id: InstrumentId;
  label: string;
  /** Partials: [harmonicMultiple, relativeGain] */
  partials: readonly [number, number][];
  attack: number;
  release: number;
};

export const INSTRUMENTS: readonly Instrument[] = [
  {
    id: "shehnai",
    label: "Shehnai",
    partials: [
      [1, 1],
      [2, 0.45],
      [3, 0.22],
      [4, 0.1],
    ],
    attack: 0.03,
    release: 0.06,
  },
  {
    id: "flute",
    label: "Flute",
    partials: [
      [1, 1],
      [2, 0.12],
      [3, 0.05],
    ],
    attack: 0.04,
    release: 0.08,
  },
  {
    id: "violin",
    label: "Violin",
    partials: [
      [1, 1],
      [2, 0.55],
      [3, 0.3],
      [4, 0.15],
      [5, 0.08],
    ],
    attack: 0.05,
    release: 0.1,
  },
  {
    id: "sitar",
    label: "Sitar",
    partials: [
      [1, 1],
      [2, 0.35],
      [3, 0.4],
      [5, 0.2],
      [7, 0.12],
    ],
    attack: 0.01,
    release: 0.18,
  },
  {
    id: "piano",
    label: "Piano",
    partials: [
      [1, 1],
      [2, 0.5],
      [3, 0.25],
      [4, 0.12],
    ],
    attack: 0.005,
    release: 0.22,
  },
];

export function instrumentById(id: string | null | undefined): Instrument {
  return INSTRUMENTS.find((i) => i.id === id) ?? INSTRUMENTS[0]!;
}

export type PlaySongOptions = {
  /**
   * Playback speed multiplier. 1 = default tempo, 2 = twice as fast,
   * 0.5 = half speed. Clamped to a sensible UI range.
   */
  speed?: number;
  /** Instrument voice (default Shehnai). */
  instrument?: InstrumentId | string;
};

/** Clamp UI speed slider values into a safe playback range. */
export function clampPlaybackSpeed(speed: number): number {
  if (!Number.isFinite(speed)) return 1;
  return Math.min(2.5, Math.max(0.4, speed));
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

type Stoppable = { stop: (when?: number) => void };

function scheduleNoteVoice(
  ctx: AudioContext,
  master: AudioNode,
  instrument: Instrument,
  n: PlannedNote,
  startAt: number,
  stoppables: Stoppable[],
): void {
  const dur = Math.max(0.04, n.endSec - n.startSec);
  const baseHz = midiToHz(n.midi);
  const t0 = startAt + n.startSec;
  const t1 = startAt + n.endSec;
  const peak = (LEVEL_GAIN[n.volumeLevel] ?? LEVEL_GAIN[2]) * 0.9;
  const attack = Math.min(instrument.attack, dur * 0.35);
  const release = Math.min(instrument.release, dur * 0.45);

  const noteGain = ctx.createGain();
  noteGain.gain.setValueAtTime(0.0001, t0);
  noteGain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
  noteGain.gain.setValueAtTime(Math.max(0.0002, peak), Math.max(t0 + attack, t1 - release));
  noteGain.gain.exponentialRampToValueAtTime(0.0001, t1);
  noteGain.connect(master);

  for (const [mult, rel] of instrument.partials) {
    const osc = ctx.createOscillator();
    osc.type = instrument.id === "flute" ? "sine" : instrument.id === "piano" ? "triangle" : "sawtooth";
    const hz = baseHz * mult;
    osc.frequency.setValueAtTime(hz, t0);

    if (n.kampita && mult === 1) {
      const depth = n.volumeLevel >= 3 ? 14 : 9;
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = n.volumeLevel >= 3 ? 5.5 : 4.5;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = depth;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t1 + 0.02);
      stoppables.push(lfo);
    } else if (n.slideUp && mult === 1) {
      osc.frequency.setValueAtTime(hz * 0.94, t0);
      osc.frequency.linearRampToValueAtTime(hz, t0 + Math.min(0.18, dur * 0.4));
    } else if (n.slideDown && mult === 1) {
      osc.frequency.setValueAtTime(hz * 1.06, t0);
      osc.frequency.linearRampToValueAtTime(hz, t0 + Math.min(0.18, dur * 0.4));
    }

    const partialGain = ctx.createGain();
    partialGain.gain.value = rel;
    osc.connect(partialGain);
    partialGain.connect(noteGain);
    osc.start(t0);
    osc.stop(t1 + 0.03);
    stoppables.push(osc);
  }
}

/**
 * Play a song via Web Audio. Returns a handle; calling stop() or starting
 * another play cancels the current one.
 */
export async function playSong(song: Song, opts: PlaySongOptions = {}): Promise<PlaybackHandle> {
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

  const speed = clampPlaybackSpeed(opts.speed ?? 1);
  const instrument = instrumentById(opts.instrument);
  const notes = planNotes(song).map((n) => ({
    ...n,
    startSec: n.startSec / speed,
    endSec: n.endSec / speed,
  }));

  const master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);

  const startAt = ctx.currentTime + 0.05;
  const stoppables: Stoppable[] = [];

  for (const n of notes) {
    scheduleNoteVoice(ctx, master, instrument, n, startAt, stoppables);
  }

  let playing = true;
  const handle: PlaybackHandle = {
    get playing() {
      return playing;
    },
    stop() {
      if (!playing) return;
      playing = false;
      for (const o of stoppables) {
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
