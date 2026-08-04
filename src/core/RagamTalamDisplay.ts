/**
 * Display formatting for the combined "Ragam : … | Talam : …" heading (+ Aro/Ava).
 *
 * Catalogue raga/tala names in the DB are English spellings that do NOT round-trip
 * safely through Tamil syllable transliteration (ர/ற, ந/ன, ல/ள/ழ conflicts). So:
 *   - Labels are localized (ராகம் / தாளம்).
 *   - Proper names stay roman unless a CMNT-roman *display spelling* override is
 *     supplied (RaagamDisplay: / TalamDisplay:), which IS run through translit
 *     (and may use @/!/~n/#n markers).
 *   - Aro/Ava uses transliterable labels ArO / avarO and swara-letter mapping
 *     (ஸ ரி க ம ப த நி), never whole-string lyric translit.
 */
import type { Script } from "./Translit.js";
import { transliterateSwara, transliterateText } from "./Translit.js";

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

/**
 * Optional CMNT-roman display spellings (from RaagamDisplay: / TalamDisplay:).
 * These ARE transliterated into the target script -- unlike catalogue DB names.
 */
export type RagamTalamDisplayOverrides = {
  /** CMNT-roman raga spelling for Indic display (may include @/#/~n). */
  ragaRoman?: string | null;
  /** CMNT-roman tala spelling for Indic display. */
  talaRoman?: string | null;
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

/**
 * On-score raga name: catalogue DB names stay roman (safe). Only a saved
 * CMNT-roman display override is transliterated into `script`.
 */
export function autoRagamDisplayName(
  parts: RagamTalamParts,
  script: Script,
  overrides: RagamTalamDisplayOverrides = {},
): string {
  if (parts.ragaName == null) return "";
  const roman = overrides.ragaRoman?.trim() || "";
  if (roman !== "" && script != null) return transliterateText(roman, script);
  if (roman !== "") return roman;
  return parts.ragaName; // catalogue spelling — never force through Tamil translit
}

/** Same policy as {@link autoRagamDisplayName} for tala names. */
export function autoTalamDisplayName(
  parts: RagamTalamParts,
  script: Script,
  overrides: RagamTalamDisplayOverrides = {},
): string {
  if (parts.talaName == null) return "";
  const roman = overrides.talaRoman?.trim() || "";
  if (roman !== "" && script != null) return transliterateText(roman, script);
  if (roman !== "") return roman;
  return parts.talaName;
}

const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";

/** Format one Aro/Ava token: swara letters via swara map; ArO/avarO via text translit. */
export function formatAroAvaToken(tok: string, script: Script): string {
  if (tok === "-" || tok === "") return tok;

  const label = /^(ArOhaNam|avarOhaNam|ArO|avarO|Aro|Ava)(:)?$/i.exec(tok);
  if (label) {
    const raw = label[1]!;
    const colon = label[2] ?? "";
    let canon: string;
    if (/^avaroh/i.test(raw)) canon = "avarOhaNam";
    else if (/^aro/i.test(raw) && raw.length > 3) canon = "ArOhaNam";
    else if (/^ava/i.test(raw)) canon = "avarO";
    else canon = "ArO";
    if (script == null) return canon + colon;
    return transliterateText(canon, script) + colon;
  }

  // S, R₂, G3, M₁, S', nI, …
  const m = /^([SRGMPDNsrgmpdn])([₀₁₂₃₄₅₆₇₈₉]|[123])?(['`]?)$/.exec(tok);
  if (m) {
    const letter = m[1]!;
    const varMark = m[2] ?? "";
    const oct = m[3] ?? "";
    if (script == null) return tok;
    const sw = transliterateSwara(letter.toLowerCase(), script);
    let sub = varMark;
    if (/^[123]$/.test(varMark)) sub = SUBSCRIPT_DIGITS.charAt(Number(varMark));
    return sw + sub + oct;
  }

  if (script == null) return tok;
  return transliterateText(tok, script);
}

/**
 * Render an Aro/Ava line. Accepts legacy "Aro: … - Ava: …" or new "ArO: … - avarO: …".
 */
export function formatAroAvaDisplay(romanAroAva: string, script: Script): string {
  if (romanAroAva == null || romanAroAva === "") return romanAroAva;
  // Normalize legacy labels to transliterable forms before tokenization.
  let s = romanAroAva
    .replace(/\bArohana\b/gi, "ArOhaNam")
    .replace(/\bAvarohana\b/gi, "avarOhaNam")
    .replace(/\bAro\b/gi, "ArO")
    .replace(/\bAva\b/gi, "avarO");
  return s
    .split(/(\s+)/)
    .map((tok) => (/^\s+$/.test(tok) ? tok : formatAroAvaToken(tok, script)))
    .join("");
}

/**
 * Build the on-score combined heading in `script`.
 */
export function formatRagamTalamDisplay(
  parts: RagamTalamParts,
  script: Script,
  overrides: RagamTalamDisplayOverrides = {},
): string {
  const labels = script == null ? ROMAN_LABELS : LABELS[script];
  const clauses: string[] = [];

  if (parts.ragaName != null) {
    const name = autoRagamDisplayName(parts, script, overrides);
    const detail = parts.ragaDetail ?? "";
    clauses.push(`${labels.ragam} : ${name}${detail !== "" ? " " + detail : ""}`);
  }
  if (parts.talaName != null) {
    const name = autoTalamDisplayName(parts, script, overrides);
    const angas = parts.talaAngas ?? "";
    clauses.push(`${labels.talam} : ${name}${angas !== "" ? " " + angas : ""}`);
  }

  let out = clauses.join(" | ");
  if (parts.aroAva != null && parts.aroAva !== "") {
    out += (out.length > 0 ? "\n" : "") + formatAroAvaDisplay(parts.aroAva, script);
  }
  return out;
}

/**
 * Insert or replace RaagamDisplay: / TalamDisplay: lines in classic CMNT source
 * (also works after YAML preprocess). Empty string removes that directive.
 */
export function upsertDisplayDirectives(
  source: string,
  opts: { ragaRoman?: string | null; talaRoman?: string | null },
): string {
  let lines = source.split("\n");
  const setOrClear = (key: RegExp, directive: string, value: string | null | undefined): void => {
    if (value === undefined) return;
    const trimmed = value?.trim() ?? "";
    const idx = lines.findIndex((l) => key.test(l.trim()));
    if (trimmed === "") {
      if (idx >= 0) lines.splice(idx, 1);
      return;
    }
    const line = `${directive}: ${trimmed}`;
    if (idx >= 0) {
      lines[idx] = line;
      return;
    }
    // Prefer after Raagam:/Tala:; else after Language:; else just after YAML --- closer; else top.
    let insertAt = lines.findIndex((l) => /^(Raagam|Ragam|Tala)\s*:/i.test(l.trim()));
    if (insertAt < 0) insertAt = lines.findIndex((l) => /^Language\s*:/i.test(l.trim()));
    if (insertAt < 0) {
      // Second --- closes front matter
      let sawOpen = false;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i]!.trim() === "---") {
          if (!sawOpen) sawOpen = true;
          else {
            insertAt = i;
            break;
          }
        }
      }
    }
    if (insertAt >= 0) lines.splice(insertAt + 1, 0, line);
    else lines.unshift(line);
  };
  setOrClear(/^RaagamDisplay\s*:/i, "RaagamDisplay", opts.ragaRoman);
  setOrClear(/^TalamDisplay\s*:/i, "TalamDisplay", opts.talaRoman);
  return lines.join("\n");
}
