/**
 * Display formatting for the combined "Ragam : … | Talam : …" heading.
 *
 * The parser always stores that line in roman CMNT form. At render time we
 * localize the Ragam/Talam labels (syllable translit would garble them into
 * ரகம்/தலம்) and transliterate the proper names -- which can still be wrong
 * for some catalogue spellings, so callers may pass per-name overrides that
 * are used as-is (already in the target script).
 */
import type { Script } from "./Translit.js";
import { transliterateHeading, transliterateText } from "./Translit.js";

export type RagamTalamParts = {
  /** Raga display name without trailing melakarta "(22)". */
  ragaName: string | null;
  /** Trailing melakarta detail including parens, e.g. "(22)", or null. */
  ragaDetail: string | null;
  /** Tala display name without trailing anga breakdown. */
  talaName: string | null;
  /** Trailing anga detail including parens, e.g. "(L4+D2+D2)", or null. */
  talaAngas: string | null;
  /** Optional second line (Aro/Ava), still roman. */
  aroAva: string | null;
};

export type RagamTalamDisplayOverrides = {
  /** Final on-score raga name (not transliterated again). */
  ragaName?: string | null;
  /** Final on-score tala name (not transliterated again). */
  talaName?: string | null;
};

const LABELS: Record<Exclude<Script, null>, { ragam: string; talam: string }> = {
  tamil: { ragam: "ராகம்", talam: "தாளம்" },
  telugu: { ragam: "రాగం", talam: "తాళం" },
  kannada: { ragam: "ರಾಗ", talam: "ತಾಳ" },
  sanskrit: { ragam: "रागम्", talam: "तालम्" },
};

const ROMAN_LABELS = { ragam: "Ragam", talam: "Talam" };

/** True when `text` looks like the parser-built combined ragam/talam heading. */
export function looksLikeRagamTalamHeading(text: string): boolean {
  const first = text.split(/\n/, 1)[0] ?? "";
  return /^(Ragam|Talam)\s*:/i.test(first.trim());
}

/**
 * Parse the roman combined heading produced by {@code CmntParser}.
 * Returns null if the text is not in the expected shape.
 */
export function parseRagamTalamHeading(text: string): RagamTalamParts | null {
  if (text == null || text === "") return null;
  const nl = text.indexOf("\n");
  const first = (nl < 0 ? text : text.slice(0, nl)).trim();
  const aroAva = nl < 0 ? null : text.slice(nl + 1).trim() || null;

  let ragaRaw: string | null = null;
  let talaRaw: string | null = null;
  const both = /^(?:Ragam\s*:\s*(.*?))\s*\|\s*(?:Talam\s*:\s*(.*))$/i.exec(first);
  if (both) {
    ragaRaw = both[1]!.trim();
    talaRaw = both[2]!.trim();
  } else {
    const rOnly = /^Ragam\s*:\s*(.*)$/i.exec(first);
    const tOnly = /^Talam\s*:\s*(.*)$/i.exec(first);
    if (rOnly) ragaRaw = rOnly[1]!.trim();
    else if (tOnly) talaRaw = tOnly[1]!.trim();
    else return null;
  }

  const raga = splitNameDetail(ragaRaw);
  const tala = splitNameDetail(talaRaw);
  return {
    ragaName: raga?.name ?? null,
    ragaDetail: raga?.detail ?? null,
    talaName: tala?.name ?? null,
    talaAngas: tala?.detail ?? null,
    aroAva,
  };
}

function splitNameDetail(raw: string | null): { name: string; detail: string | null } | null {
  if (raw == null || raw === "") return null;
  const m = /^(.*?)(\s*\([^)]*\))\s*$/.exec(raw);
  if (m) return { name: m[1]!.trim(), detail: m[2]!.trim() };
  return { name: raw.trim(), detail: null };
}

/** Auto-transliterated raga name for the given script (roman when script is null). */
export function autoRagamDisplayName(parts: RagamTalamParts, script: Script): string {
  if (parts.ragaName == null) return "";
  if (script == null) return parts.ragaName;
  return transliterateText(parts.ragaName, script);
}

/** Auto-transliterated tala name for the given script (roman when script is null). */
export function autoTalamDisplayName(parts: RagamTalamParts, script: Script): string {
  if (parts.talaName == null) return "";
  if (script == null) return parts.talaName;
  return transliterateText(parts.talaName, script);
}

/**
 * Build the on-score combined heading in `script`, applying optional name
 * overrides (used as-is when non-empty).
 */
export function formatRagamTalamDisplay(
  parts: RagamTalamParts,
  script: Script,
  overrides: RagamTalamDisplayOverrides = {},
): string {
  const labels = script == null ? ROMAN_LABELS : LABELS[script];
  const clauses: string[] = [];

  if (parts.ragaName != null) {
    const name =
      overrides.ragaName != null && overrides.ragaName !== ""
        ? overrides.ragaName
        : autoRagamDisplayName(parts, script);
    const detail = parts.ragaDetail ?? "";
    clauses.push(`${labels.ragam} : ${name}${detail !== "" ? " " + detail : ""}`);
  }
  if (parts.talaName != null) {
    const name =
      overrides.talaName != null && overrides.talaName !== ""
        ? overrides.talaName
        : autoTalamDisplayName(parts, script);
    const angas = parts.talaAngas ?? "";
    clauses.push(`${labels.talam} : ${name}${angas !== "" ? " " + angas : ""}`);
  }

  let out = clauses.join(" | ");
  if (parts.aroAva != null && parts.aroAva !== "") {
    const aro =
      script == null ? parts.aroAva : transliterateHeading(parts.aroAva, script);
    out += (out.length > 0 ? "\n" : "") + aro;
  }
  return out;
}
