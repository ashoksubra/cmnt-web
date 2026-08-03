import type { SongPart } from "./SongPart.js";

export class SongBreak implements SongPart {}
export class PageBreak implements SongPart {}

export class GatiSwitch implements SongPart {
  constructor(public readonly gati: number) {}
}
