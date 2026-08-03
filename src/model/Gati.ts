/** Subdivision factors (CATUSRA is 2, not 4 — matches classic CMNT). */
export const Gati = {
  TISRA: 3,
  CATUSRA: 2,
  KHANDA: 5,
  MISRA: 7,
  SANKIRNA: 9,
} as const;

export type GatiValue = (typeof Gati)[keyof typeof Gati];

export function gatiLabel(g: number): string {
  switch (g) {
    case Gati.TISRA: return "tisra";
    case Gati.CATUSRA: return "catusra";
    case Gati.KHANDA: return "khanda";
    case Gati.MISRA: return "misra";
    case Gati.SANKIRNA: return "sankirna";
    default: return String(g);
  }
}
