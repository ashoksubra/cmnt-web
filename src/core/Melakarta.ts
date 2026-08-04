/** Semitone offsets for every named swarasthana variant, in the standard 12-tone layout. */
export const VARIANT_SEMITONE: Readonly<Record<string, number>> = {
  r1: 1,
  r2: 2,
  r3: 3,
  g1: 2,
  g2: 3,
  g3: 4,
  m1: 5,
  m2: 6,
  d1: 8,
  d2: 9,
  d3: 10,
  n1: 9,
  n2: 10,
  n3: 11,
};

/** R/G/M/D/N variant numbers (1–3, or M 1–2) for a melakarta (1–72). */
export function melakartaVariantNumbers(melakarta: number): Readonly<Partial<Record<"r" | "g" | "m" | "d" | "n", number>>> {
  if (melakarta < 1 || melakarta > 72) return {};
  const chakra = Math.floor((melakarta - 1) / 6) + 1;
  const position = ((melakarta - 1) % 6) + 1;
  const chakraMod = ((chakra - 1) % 6) + 1;
  let rVariant: number;
  let gVariant: number;
  switch (chakraMod) {
    case 1:
      rVariant = 1;
      gVariant = 1;
      break;
    case 2:
      rVariant = 1;
      gVariant = 2;
      break;
    case 3:
      rVariant = 1;
      gVariant = 3;
      break;
    case 4:
      rVariant = 2;
      gVariant = 2;
      break;
    case 5:
      rVariant = 2;
      gVariant = 3;
      break;
    default:
      rVariant = 3;
      gVariant = 3;
      break;
  }
  const mVariant = melakarta <= 36 ? 1 : 2;
  let dVariant: number;
  let nVariant: number;
  switch (position) {
    case 1:
      dVariant = 1;
      nVariant = 1;
      break;
    case 2:
      dVariant = 1;
      nVariant = 2;
      break;
    case 3:
      dVariant = 1;
      nVariant = 3;
      break;
    case 4:
      dVariant = 2;
      nVariant = 2;
      break;
    case 5:
      dVariant = 2;
      nVariant = 3;
      break;
    default:
      dVariant = 3;
      nVariant = 3;
      break;
  }
  return { r: rVariant, g: gVariant, m: mVariant, d: dVariant, n: nVariant };
}

/** Maps melakarta variant numbers to semitone offsets (includes S=0, P=7). */
export function melakartaVariants(melakarta: number): Readonly<Record<"s" | "r" | "g" | "m" | "p" | "d" | "n", number>> {
  if (melakarta < 1 || melakarta > 72) {
    return { s: 0, r: 0, g: 0, m: 0, p: 0, d: 0, n: 0 };
  }
  const vn = melakartaVariantNumbers(melakarta);
  return {
    s: 0,
    r: VARIANT_SEMITONE[`r${vn.r!}`]!,
    g: VARIANT_SEMITONE[`g${vn.g!}`]!,
    m: VARIANT_SEMITONE[`m${vn.m!}`]!,
    p: 7,
    d: VARIANT_SEMITONE[`d${vn.d!}`]!,
    n: VARIANT_SEMITONE[`n${vn.n!}`]!,
  };
}
