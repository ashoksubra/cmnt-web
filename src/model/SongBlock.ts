import type { SongPart } from "./SongPart.js";
import type { Swara } from "./Swara.js";

export class Notation {
  readonly swara: Swara;
  readonly lyrics: string[] = [];
  constructor(swara: Swara) {
    this.swara = swara;
  }
}

export class SongBlock implements SongPart {
  notations: Notation[] = [];
  heading: string | null = null;
  language = "english";
  font: string | null = null;
  swaraFontSize: string | null = null;
  lyricFontSize: string | null = null;
  swaraColor: string | null = null;
  lyricColor: string | null = null;
  swaraFont: string | null = null;
  lyricFont: string | null = null;
  swaraBold = false;
  lyricBold = false;
  gamakaFontSize: string | null = null;
  gamakaColor: string | null = null;
  nLyricLines = 0;

  addSwara(s: Swara): Notation {
    const n = new Notation(s);
    for (let i = 0; i < this.nLyricLines; i++) n.lyrics.push("");
    this.notations.push(n);
    return n;
  }

  ensureLyricLines(count: number): void {
    while (this.nLyricLines < count) {
      this.nLyricLines++;
      for (const n of this.notations) n.lyrics.push("");
    }
  }
}
