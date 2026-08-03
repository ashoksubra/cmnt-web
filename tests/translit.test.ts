import { describe, expect, it } from "vitest";
import { scriptFor, transliterateSwara, transliterateText } from "@cmnt/core/Translit";

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

describe("transliterateText", () => {
  it("transliterates common maha_ganapatim lyric syllables into Tamil", () => {
    expect(transliterateText("ma", "tamil")).toBe("ம");
    expect(transliterateText("hA", "tamil")).toBe("ஹா");
    expect(transliterateText("ga", "tamil")).toBe("க");
    expect(transliterateText("Na", "tamil")).toBe("ண");
    expect(transliterateText("pa", "tamil")).toBe("ப");
    expect(transliterateText("tim", "tamil")).toBe("திம்");
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
