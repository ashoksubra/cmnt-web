import { describe, expect, it } from "vitest";
import { parse } from "@cmnt/core/CmntParser";
import {
  autoRagamDisplayName,
  autoTalamDisplayName,
  formatRagamTalamDisplay,
  parseRagamTalamHeading,
} from "@cmnt/core/RagamTalamDisplay";
import { renderScoreSvg } from "@cmnt/render/SvgScore";
import { layoutSong } from "@cmnt/core/Layout";
import { Heading } from "@cmnt/model/Heading";

describe("parseRagamTalamHeading", () => {
  it("parses combined raga + tala with melakarta and angas", () => {
    const parts = parseRagamTalamHeading("Ragam : Sri (22) | Talam : Adi (L4+D2+D2)");
    expect(parts).toEqual({
      ragaName: "Sri",
      ragaDetail: "(22)",
      talaName: "Adi",
      talaAngas: "(L4+D2+D2)",
      aroAva: null,
    });
  });

  it("keeps an Aro/Ava second line", () => {
    const parts = parseRagamTalamHeading("Ragam : Sri | Talam : Adi\nAro: S R2 G3");
    expect(parts?.aroAva).toBe("Aro: S R2 G3");
  });
});

describe("formatRagamTalamDisplay", () => {
  it("uses localized Tamil labels (not syllable-garbled Ragam/Talam)", () => {
    const parts = parseRagamTalamHeading("Ragam : Sri | Talam : Adi (L4+D2+D2)")!;
    const out = formatRagamTalamDisplay(parts, "tamil");
    expect(out.startsWith("ராகம் : ")).toBe(true);
    expect(out).toContain("தாளம் : ");
    expect(out).toContain("(L4+D2+D2)");
    expect(out).not.toMatch(/Ragam|Talam/);
  });

  it("honours on-screen name overrides as-is", () => {
    const parts = parseRagamTalamHeading("Ragam : Purnachandrika | Talam : Rupaka (L2+D4)")!;
    const out = formatRagamTalamDisplay(parts, "tamil", {
      ragaName: "பூர்ணசந்த்ரிகா",
      talaName: "ரூபகம்",
    });
    expect(out).toBe("ராகம் : பூர்ணசந்த்ரிகா | தாளம் : ரூபகம் (L2+D4)");
  });

  it("leaves english labels/names in roman when script is null", () => {
    const parts = parseRagamTalamHeading("Ragam : Sri | Talam : Adi")!;
    expect(formatRagamTalamDisplay(parts, null)).toBe("Ragam : Sri | Talam : Adi");
    expect(autoRagamDisplayName(parts, null)).toBe("Sri");
    expect(autoTalamDisplayName(parts, null)).toBe("Adi");
  });
});

describe("CmntParser ragam/talam language", () => {
  it("tags the combined heading with Language: even when Language comes after Raagam/Tala", () => {
    const song = parse(
      ["Raagam: Sri", "Tala: Adi", "Language: Tamil", "DefaultSpeed: 0", "S: s r g m", "L: sa ri ga ma", ""].join(
        "\n",
      ),
    );
    const h = song.parts.find((p): p is Heading => p instanceof Heading && p.role === "ragamTalam");
    expect(h).toBeTruthy();
    expect(h!.language?.split(":")[0]).toBe("tamil");
    expect(h!.text).toMatch(/^Ragam :/);
  });

  it("renders Tamil labels in SVG for a Tamil-language score", () => {
    const song = parse(
      ["Raagam: Sri", "Tala: Adi", "Language: Tamil", "DefaultSpeed: 0", "S: s r g m", "L: sa ri ga ma", ""].join(
        "\n",
      ),
    );
    const svg = renderScoreSvg(layoutSong(song));
    expect(svg).toContain("ராகம்");
    expect(svg).toContain("தாளம்");
    expect(svg).not.toContain("Ragam :");
  });

  it("applies SvgScore name overrides without re-transliterating them", () => {
    const song = parse(
      ["Raagam: Sri", "Tala: Adi", "Language: Tamil", "DefaultSpeed: 0", "S: s r g m", "L: sa ri ga ma", ""].join(
        "\n",
      ),
    );
    const svg = renderScoreSvg(layoutSong(song), {
      ragamTalamOverrides: { ragaName: "ஸ்ரீ", talaName: "ஆதி" },
    });
    expect(svg).toContain("ராகம் : ஸ்ரீ");
    expect(svg).toContain("தாளம் : ஆதி");
  });
});
