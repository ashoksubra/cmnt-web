import { Fraction } from "./Fraction.js";

export class Swara {
  label: string;
  pause = false;
  octave = 0;
  length = 1;
  speed = 1;
  gamaka: string | null = null;
  empty = false;
  phraseHyphens = 0;
  gatiOverride: number | null = null;
  clusterGamaka: string | null = null;
  clusterStart = false;
  clusterEnd = false;

  constructor(
    label: string,
    pause = false,
    octave = 0,
    length = 1,
    speed = 1,
    gamaka: string | null = null,
    phraseHyphens = 0,
  ) {
    this.label = label;
    this.pause = pause;
    this.octave = octave;
    this.length = length;
    this.speed = speed;
    this.gamaka = gamaka;
    this.phraseHyphens = phraseHyphens;
    if (label === "_" || label === "__") this.empty = true;
    const bareDash = label === "-" || label === "--";
    if (this.phraseHyphens <= 0 && label.endsWith("-") && !bareDash) {
      this.phraseHyphens = 1;
    }
  }

  displayLabel(): string {
    if (this.empty) return "";
    const bareDash = this.label === "-" || this.label === "--";
    if (this.label.endsWith("-") && !bareDash) {
      return this.label.slice(0, -1);
    }
    return this.label;
  }

  duration(gati: number): Fraction {
    const effective = this.gatiOverride != null ? this.gatiOverride : gati;
    let denom = 1;
    if (this.speed > 0) {
      let factor = 1;
      for (let i = 1; i < this.speed; i++) factor *= 2;
      denom = factor * effective;
    }
    return new Fraction(this.length, denom);
  }
}
