/**
 * Web Audio playback for a laid-out CMNT song (browser port of JAR Playback.java).
 *
 * Builds a timed note list from layout cells using melakarta / Aro-Ava pitch
 * mapping, then schedules oscillators. No MIDI dependency — works in the
 * composer preview. Gamaka envelopes are a light sketch (kampita vibrato,
 * slide expression via gain), not a full violin/gamaka synthesis.
 *
 * Duration is sustain-until-next: each pitched note stays at full level until
 * the following pitched note (or a true rest) starts. Karvai tokens `,` / `;`
 * and `=` extend the current pitch without re-attacking. The audible envelope
 * does not fade out before the next note — that was making phrases sound
 * chopped into discrete plucks.
 *
 * Phrase-end hyphens in the source (`p- sA`, rendered as a centered "-")
 * insert a short breath before the next attack. Tala alignment is kept: the
 * gap is stolen from the end of the phrase, not added to the timeline.
 */
import type { Song } from "../model/Song.js";
import { Heading } from "../model/Heading.js";
import { layoutSong, VisualRow, type LayoutItem } from "./Layout.js";
import { melakartaVariants, VARIANT_SEMITONE } from "./Melakarta.js";
import {
  planPitchTransition,
  type TransitionWaypoint,
} from "./PitchTransition.js";

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
/** Reference duration when BPM = 60 (1 akshara = 1 beat = 1 second). */
export const DEFAULT_BPM = 60;
const SECONDS_PER_AKSHARA_AT_60 = 60 / DEFAULT_BPM; // 1.0
const LEVEL_GAIN = [0, 0.18, 0.32, 0.48] as const;

export type PlannedNote = {
  startSec: number;
  endSec: number;
  midi: number;
  volumeLevel: number;
  kampita: boolean;
  slideUp: boolean;
  slideDown: boolean;
  /** Previous pitch; used to fill a jaru/traversal into this note. */
  fromMidi: number | null;
  /** Departure → arrival waypoints (¼ / ¾ split, gravity on leaps). */
  waypoints: TransitionWaypoint[];
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
export function planNotes(
  song: Song,
  items?: LayoutItem[],
  secondsPerAkshara: number = SECONDS_PER_AKSHARA_AT_60,
): PlannedNote[] {
  const semitones = semitoneMapForSong(song);
  const layout = items ?? layoutSong(song);
  const notes: PlannedNote[] = [];
  let t = 0;
  let open: PlannedNote | null = null;
  let openPhraseEnd = false;
  let afterPhrase = false;
  let level = 2;
  let prevMidi: number | null = null;
  const beat = Math.max(0.05, secondsPerAkshara);

  const closeOpen = (at: number, applyPhraseGap: boolean): void => {
    if (open == null) return;
    const held = Math.max(0, at - open.startSec);
    const gap = applyPhraseGap && openPhraseEnd ? phraseSeparatorGapSec(beat, held) : 0;
    open.endSec = Math.max(open.startSec, at - gap);
    if (open.endSec > open.startSec) notes.push(open);
    if (applyPhraseGap && openPhraseEnd && gap > 0) afterPhrase = true;
    open = null;
    openPhraseEnd = false;
  };

  for (const it of layout) {
    if (!(it instanceof VisualRow)) continue;
    for (const c of it.cells) {
      if (c.kind !== "swara") continue;
      const dur = Math.max(c.duration.doubleValue(), 0) * beat;
      if (dur <= 0) continue;

      if (c.isRest) {
        // A full rest already demarcates; do not also steal a micro-gap.
        closeOpen(t, false);
        t += dur;
        continue;
      }
      if (c.isSustain) {
        t += dur;
        if (c.phraseEnd) openPhraseEnd = true;
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

      closeOpen(t, true);

      let kampita = gamaka === "~" || gamaka === "~~";
      let slideUp = gamaka === "/" || gamaka === "//";
      let slideDown = gamaka === "\\" || gamaka === "\\\\";
      if (!kampita && !slideUp && !slideDown && gamaka != null) {
        const gl = gamaka.toLowerCase();
        if (gl === "kh" || gl === "or" || gl === "pr") slideDown = true;
        if (gl === "sp") slideUp = true;
      }

      const fromMidi = afterPhrase ? null : prevMidi;
      afterPhrase = false;
      const waypoints =
        fromMidi == null
          ? [
              { frac: 0, midi, gainMul: 1 },
              { frac: 1, midi, gainMul: 1 },
            ]
          : planPitchTransition(fromMidi, midi);

      open = {
        startSec: t,
        endSec: t,
        midi,
        volumeLevel: level,
        kampita,
        slideUp,
        slideDown,
        fromMidi,
        waypoints,
      };
      prevMidi = midi;
      openPhraseEnd = c.phraseEnd;
      t += dur;
    }
  }
  closeOpen(t, true);
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
   * Beats per minute. 1 akshara = 1 beat. Default {@link DEFAULT_BPM} (60).
   * Independent of notation DefaultSpeed: 0/1/2 (which only changes note density).
   */
  bpm?: number;
  /**
   * When true, schedule an audible metronome click on each akshara beat.
   * Silent when false/omitted.
   */
  click?: boolean;
  /**
   * Extra practice multiplier on top of BPM (1 = as written, 0.5 = half).
   * Clamped to a sensible UI range.
   */
  speed?: number;
  /** Instrument voice (default Shehnai). */
  instrument?: InstrumentId | string;
};

/** Clamp UI BPM into a practical singing/practice range. */
export function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return DEFAULT_BPM;
  return Math.min(240, Math.max(20, Math.round(bpm)));
}

/** Clamp UI practice-speed slider values into a safe playback range. */
export function clampPlaybackSpeed(speed: number): number {
  if (!Number.isFinite(speed)) return 1;
  return Math.min(2.5, Math.max(0.4, speed));
}

/**
 * Micro-pause after a phrase-end hyphen. Scales with tempo, never more than
 * about a third of the note being released so short notes still speak.
 */
export function phraseSeparatorGapSec(secondsPerAkshara: number, heldSec: number): number {
  const beat = Math.max(0.05, secondsPerAkshara);
  const gap = Math.min(0.09, Math.max(0.04, beat * 0.1));
  return Math.min(gap, Math.max(0, heldSec * 0.35));
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

function scheduleMetronomeClick(
  ctx: AudioContext,
  master: AudioNode,
  when: number,
  accent: boolean,
  stoppables: Stoppable[],
): void {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = accent ? 1200 : 900;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(accent ? 0.22 : 0.12, when + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.04);
  osc.connect(g);
  g.connect(master);
  osc.start(when);
  osc.stop(when + 0.05);
  stoppables.push(osc);
}

function scheduleNoteVoice(
  ctx: AudioContext,
  master: AudioNode,
  instrument: Instrument,
  n: PlannedNote,
  startAt: number,
  stoppables: Stoppable[],
): void {
  const dur = Math.max(0.04, n.endSec - n.startSec);
  const t0 = startAt + n.startSec;
  const t1 = startAt + n.endSec;
  const peak = (LEVEL_GAIN[n.volumeLevel] ?? LEVEL_GAIN[2]) * 0.9;
  const attack = Math.min(instrument.attack, dur * 0.25);
  // Hold full level until the next note (or rest) starts. A few milliseconds
  // after t1 only avoids a click — it must not eat into this note's duration.
  const release = 0.012;
  const waypoints = n.waypoints.length > 0 ? n.waypoints : [{ frac: 0, midi: n.midi, gainMul: 1 }, { frac: 1, midi: n.midi, gainMul: 1 }];

  const noteGain = ctx.createGain();
  noteGain.gain.setValueAtTime(0.0001, t0);
  const firstPeak = Math.max(0.0002, peak * (waypoints[0]?.gainMul ?? 1));
  noteGain.gain.exponentialRampToValueAtTime(firstPeak, t0 + attack);
  for (const w of waypoints) {
    const tw = t0 + w.frac * dur;
    if (tw <= t0 + attack) continue;
    noteGain.gain.linearRampToValueAtTime(Math.max(0.0002, peak * w.gainMul), tw);
  }
  noteGain.gain.setValueAtTime(Math.max(0.0002, peak * (waypoints[waypoints.length - 1]?.gainMul ?? 1)), t1);
  noteGain.gain.exponentialRampToValueAtTime(0.0001, t1 + release);
  noteGain.connect(master);

  for (const [mult, rel] of instrument.partials) {
    const osc = ctx.createOscillator();
    osc.type = instrument.id === "flute" ? "sine" : instrument.id === "piano" ? "triangle" : "sawtooth";
    const clickAvoid = 0.008;
    for (const w of waypoints) {
      const tw = t0 + w.frac * dur;
      const hz = midiToHz(w.midi) * mult;
      if (w.frac === 0) osc.frequency.setValueAtTime(hz, t0);
      else osc.frequency.linearRampToValueAtTime(hz, Math.max(t0 + clickAvoid, tw));
    }

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
      lfo.stop(t1 + release + 0.02);
      stoppables.push(lfo);
    }

    const partialGain = ctx.createGain();
    partialGain.gain.value = rel;
    osc.connect(partialGain);
    partialGain.connect(noteGain);
    osc.start(t0);
    osc.stop(t1 + release + 0.02);
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

  const bpm = clampBpm(opts.bpm ?? DEFAULT_BPM);
  const practice = clampPlaybackSpeed(opts.speed ?? 1);
  const secondsPerAkshara = (60 / bpm) / practice;
  const instrument = instrumentById(opts.instrument);
  const notes = planNotes(song, undefined, secondsPerAkshara);

  const master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);

  const startAt = ctx.currentTime + 0.05;
  const stoppables: Stoppable[] = [];

  for (const n of notes) {
    scheduleNoteVoice(ctx, master, instrument, n, startAt, stoppables);
  }

  const totalSec = notes.length === 0 ? 0 : Math.max(...notes.map((n) => n.endSec));
  if (opts.click && totalSec > 0) {
    const clickGain = ctx.createGain();
    clickGain.gain.value = 0.7;
    clickGain.connect(master);
    const beat = secondsPerAkshara;
    const nBeats = Math.ceil(totalSec / beat - 1e-9) + 1;
    for (let i = 0; i < nBeats; i++) {
      const t = i * beat;
      if (t > totalSec + 0.001) break;
      scheduleMetronomeClick(ctx, clickGain, startAt + t, i % 4 === 0, stoppables);
    }
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

  const totalMs = totalSec * 1000 + 80;
  if (totalMs > 0) {
    setTimeout(() => {
      if (activeHandle === handle) handle.stop();
    }, totalMs + 50);
  } else {
    handle.stop();
  }
  return handle;
}
