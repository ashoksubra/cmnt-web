/**
 * Raga lookup tables (melakarta / dwi-madhyama / janya). Iteration 1 stub:
 * CmntParser needs these symbols to resolve Raagam:/Melakarta: directives,
 * but the actual melakarta/janya/aro-ava tables are ported in a later
 * iteration. Every lookup here intentionally returns "not found" so that
 * Raagam:/Melakarta: directives still parse (falling back to the raw
 * displayed name) without throwing.
 */

export function melakartaNumberForName(_name: string): number | null {
  return null;
}

export function melakartaName(n: number): string {
  return String(n);
}

export function melakartaAroAva(_n: number): string | null {
  return null;
}

export type JanyaRaga = { name: string; melakarta: number };

export function dwijaForName(_name: string): JanyaRaga | null {
  return null;
}

export function janyaForName(_name: string): JanyaRaga | null {
  return null;
}

export function dwijaAroAva(_j: JanyaRaga): string | null {
  return null;
}

export function janyaAroAva(_j: JanyaRaga): string | null {
  return null;
}
