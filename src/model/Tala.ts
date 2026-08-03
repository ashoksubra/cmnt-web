import { Fraction } from "./Fraction.js";
import { Gati } from "./Gati.js";
import type { SongPart } from "./SongPart.js";

export class TalaPart {
  constructor(
    public readonly index: number,
    public gati: number,
    public readonly marker: string,
  ) {}
}

export class TalaSegment {
  constructor(
    public readonly span: number,
    public readonly nAksharas: number,
    public readonly gati: number,
  ) {}
}

export class TalaRow {
  constructor(
    public readonly segments: TalaSegment[],
    public readonly duration: Fraction,
  ) {}
}

export class Tala implements SongPart {
  static readonly END_MARKER = "||";
  static readonly MIDDLE_MARKER = "|";
  static readonly EMPTY_MARKER = "";

  name: string;
  aksharaCount: number;
  predefName: string;
  parts: TalaPart[] = [];
  layoutRows: TalaRow[] = [];
  layoutName = "krithi";
  gatiSwitchable = true;
  defaultGati: number = Gati.CATUSRA;

  constructor(name: string, aksharaCount: number, predefName: string) {
    this.name = name;
    this.aksharaCount = aksharaCount;
    this.predefName = predefName;
  }

  primaryGati(): number {
    if (this.parts.length > 0) return this.parts[0]!.gati;
    return this.defaultGati;
  }

  switchGati(gati: number): void {
    if (!this.gatiSwitchable) throw new Error(`Cannot switch gati for tala ${this.name}`);
    for (const p of this.parts) p.gati = gati;
    this.defaultGati = gati;
  }

  copyWithRows(newRows: TalaRow[]): Tala {
    const t = new Tala(this.name, this.aksharaCount, this.predefName);
    t.parts = [...this.parts];
    t.layoutRows = newRows;
    t.layoutName = this.layoutName;
    t.gatiSwitchable = this.gatiSwitchable;
    t.defaultGati = this.defaultGati;
    return t;
  }
}
