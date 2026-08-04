import type { SongPart } from "./SongPart.js";

export class Heading implements SongPart {
  text: string;
  font: string | null = null;
  fontSize = "12";
  alignment = "left";
  color: string | null = null;
  bold = false;
  italic = false;
  language: string | null = null;
  tightAbove = false;
  /**
   * Special heading roles. `"ragamTalam"` is the combined
   * "Ragam : … | Talam : …" line built by the parser -- renderers localize
   * labels into the score language; catalogue names stay roman unless
   * RaagamDisplay:/TalamDisplay: CMNT-roman overrides are set.
   */
  role: "ragamTalam" | null = null;
  /** CMNT-roman spelling from RaagamDisplay: (transliterated for Indic scripts). */
  ragaDisplayRoman: string | null = null;
  /** CMNT-roman spelling from TalamDisplay:. */
  talaDisplayRoman: string | null = null;

  constructor(text: string) {
    this.text = text;
  }
}
