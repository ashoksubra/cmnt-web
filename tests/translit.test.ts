import { describe, expect, it } from "vitest";
import {
  firstConsonantKey,
  scriptFor,
  transliterate,
  transliterateSwara,
  transliterateText,
} from "@cmnt/core/Translit";

describe("scriptFor", () => {
  it("maps known language names to their script", () => {
    expect(scriptFor("tamil")).toBe("tamil");
    expect(scriptFor("Tamil")).toBe("tamil");
    expect(scriptFor("telugu")).toBe("telugu");
    expect(scriptFor("kannada")).toBe("kannada");
    expect(scriptFor("sanskrit")).toBe("sanskrit");
  });

  it("returns null for english/unknown/nullish languages", () => {
    expect(scriptFor("english")).toBeNull();
    expect(scriptFor("klingon")).toBeNull();
    expect(scriptFor(null)).toBeNull();
    expect(scriptFor(undefined)).toBeNull();
  });
});

describe("transliterateSwara", () => {
  it("renders single-letter swaras with inherent-a / recognizable vowel (matches Java)", () => {
    expect(transliterateSwara("s", "tamil")).toBe("ஸ");
    expect(transliterateSwara("r", "tamil")).toBe("ரி");
    expect(transliterateSwara("g", "tamil")).toBe("க");
    expect(transliterateSwara("m", "tamil")).toBe("ம");
    expect(transliterateSwara("p", "tamil")).toBe("ப");
    expect(transliterateSwara("d", "tamil")).toBe("த");
    expect(transliterateSwara("n", "tamil")).toBe("நி");
  });

  it("renders two-letter swara names preserving vowel length", () => {
    expect(transliterateSwara("sA", "tamil")).toBe("ஸா");
    expect(transliterateSwara("rI", "tamil")).toBe("ரீ");
    expect(transliterateSwara("sa", "tamil")).toBe("ஸ");
    expect(transliterateSwara("ri", "tamil")).toBe("ரி");
  });

  it("keeps a trailing bhinna '*' marker", () => {
    expect(transliterateSwara("s*", "tamil")).toBe("ஸ*");
  });

  it("leaves markers/pauses untouched", () => {
    expect(transliterateSwara(",", "tamil")).toBe(",");
    expect(transliterateSwara("-", "tamil")).toBe("-");
    expect(transliterateSwara("..", "tamil")).toBe("..");
    expect(transliterateSwara("_", "tamil")).toBe("_");
  });

  it("returns the roman label unchanged for english or null script", () => {
    expect(transliterateSwara("s", scriptFor("english"))).toBe("s");
    expect(transliterateSwara("sA", null)).toBe("sA");
  });
});

describe("transliterate (Tamil nasals — matches JAR)", () => {
  it("maps #n / ~n / @n / !n escape hatches", () => {
    expect(transliterate("#n", "tamil")).toBe("ங்");
    expect(transliterate("~n", "tamil")).toBe("ஞ்");
    expect(transliterate("@n", "tamil")).toBe("ந்");
    expect(transliterate("!n", "tamil")).toBe("ந்");
    expect(transliterate("@nA", "tamil")).toBe("நா");
    expect(transliterate("@nE", "tamil")).toBe("நே");
  });

  it("treats lone n as ni, with dental vs alveolar by wordStart", () => {
    expect(transliterate("n", "tamil", true)).toBe("நி");
    expect(transliterate("n", "tamil", false)).toBe("னி");
    expect(transliterate("nA", "tamil", true)).toBe("நா");
    expect(transliterate("nA", "tamil", false)).toBe("னா");
  });

  it("keeps #n attached inside a syllable (sa#ngam → ஸங்கம்)", () => {
    expect(transliterate("sa#ngam", "tamil")).toBe("ஸங்கம்");
    expect(transliterate("#nga", "tamil")).toBe("ங்க");
    expect(transliterate("~nja", "tamil")).toBe("ஞ்ஜ");
    expect(transliterate("ku#n", "tamil")).toBe("குங்");
  });

  it("uses dental ந before dental stops and after liquid/glides", () => {
    expect(transliterate("santham", "tamil")).toBe("ஸந்தம்");
    expect(transliterate("vandhitha", "tamil")).toBe("வந்தித");
  });

  it("uses alveolar ன் in bare clusters otherwise (janyam)", () => {
    expect(transliterate("janyam", "tamil")).toBe("ஜன்யம்");
  });

  it("keeps dental ந் when a word is split across notes (kan + dan)", () => {
    expect(transliterate("kan", "tamil", true, "dan")).toBe("கந்");
    expect(transliterate("dan", "tamil", false)).toBe("தன்");
    expect(transliterate("mun", "tamil", true, "thai")).toBe("முந்");
    expect(transliterate("thai", "tamil", false)).toBe("தை");
    expect(transliterate("pan", "tamil", true, "dam")).toBe("பந்");
    expect(transliterate("dam", "tamil", false)).toBe("தம்");
    expect(transliterate("jan", "tamil", true, "yam")).toBe("ஜன்");
  });

  it("keeps alveolar ன் when the split syllable has no following token", () => {
    expect(transliterate("kan", "tamil", true)).toBe("கன்");
    expect(transliterate("kan", "tamil", true, null)).toBe("கன்");
  });

  it("reads the first consonant of the next syllable", () => {
    expect(firstConsonantKey("dan")).toBe("d");
    expect(firstConsonantKey("thai")).toBe("th");
    expect(firstConsonantKey("yam")).toBe("y");
  });

  it("strips markers for english/null script", () => {
    expect(transliterate("@nE", null)).toBe("nE");
    expect(transliterate("sa#ngam", scriptFor("english"))).toBe("sangam");
    expect(transliterate("sa~ngam", null)).toBe("sangam");
  });
});

describe("transliterateText", () => {
  it("transliterates common maha_ganapatim lyric syllables into Tamil", () => {
    expect(transliterateText("ma", "tamil")).toBe("ம");
    expect(transliterateText("hA", "tamil")).toBe("ஹா");
    expect(transliterateText("ga", "tamil")).toBe("க");
    expect(transliterateText("Na", "tamil")).toBe("ண");
    expect(transliterateText("pa", "tamil")).toBe("ப");
    expect(transliterateText("tim", "tamil")).toBe("திம்");
  });

  it("keeps @/!/~n/#n markers attached across multi-syllable text", () => {
    expect(transliterateText("@nA", "tamil")).toBe("நா");
    expect(transliterateText("#n", "tamil")).toBe("ங்");
    expect(transliterateText("~n", "tamil")).toBe("ஞ்");
    expect(transliterateText("sa#ngam", "tamil")).toBe("ஸங்கம்");
    // Capital S = palatal/retroflex sibilant (ஶ); lowercase s = dental ஸ.
    expect(transliterateText("Sa #n kha", "tamil")).toBe("ஶ ங் க");
  });

  it("returns the roman text unchanged for english or null script", () => {
    expect(transliterateText("ganesha", scriptFor("english"))).toBe("ganesha");
    expect(transliterateText("ganesha", null)).toBe("ganesha");
  });

  it("leaves blank/placeholder lyrics untouched", () => {
    expect(transliterateText("", "tamil")).toBe("");
    expect(transliterateText(".", "tamil")).toBe(".");
  });
});
