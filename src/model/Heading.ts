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
   * labels/names into the score language and accept on-screen name overrides.
   */
  role: "ragamTalam" | null = null;

  constructor(text: string) {
    this.text = text;
  }
}
