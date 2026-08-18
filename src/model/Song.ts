import type { SongPart } from "./SongPart.js";
import { Heading } from "./Heading.js";
import { SongBlock } from "./SongBlock.js";
import type { Tala } from "./Tala.js";

export type ParseWarning = {
  line: number;
  message: string;
  severity: "error" | "hint";
};

export class Song {
  tala: Tala;
  defaultSpeed = 1;
  effectiveDefaultSpeed = 1;
  parts: SongPart[] = [];
  speedMarksBelow = false;
  phraseEndsStyle = "show";
  compact = true;
  portrait = true;
  layoutName = "krithi";
  language = "english";
  title: string | null = null;
  melakarta: number | null = null;
  cyclesPerRow: number | null = null;
  rowSpacing = 1.0;
  cellSpacing = 1.0;
  ragaName: string | null = null;
  /** Optional CMNT-roman display spelling (RaagamDisplay:) for Indic scores. */
  ragaDisplayRoman: string | null = null;
  /** Optional CMNT-roman display spelling (TalamDisplay:). */
  talaDisplayRoman: string | null = null;
  /** Non-fatal issues from a live/lenient parse (empty for a strict parse). */
  parseWarnings: ParseWarning[] = [];

  constructor(tala: Tala) {
    this.tala = tala;
  }

  add(p: SongPart): void {
    this.parts.push(p);
  }

  swaraCount(): number {
    let n = 0;
    for (const p of this.parts) {
      if (p instanceof SongBlock) n += p.notations.length;
    }
    return n;
  }

  blockCount(): number {
    let n = 0;
    for (const p of this.parts) if (p instanceof SongBlock) n++;
    return n;
  }

  headingCount(): number {
    let n = 0;
    for (const p of this.parts) if (p instanceof Heading) n++;
    return n;
  }
}
