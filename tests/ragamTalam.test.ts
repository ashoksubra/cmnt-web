import { describe, expect, it } from "vitest";
import { parse } from "@cmnt/core/CmntParser";
import {
  autoRagamDisplayName,
  autoTalamDisplayName,
  formatAroAvaDisplay,
  formatRagamTalamDisplay,
  parseRagamTalamHeading,
  upsertDisplayDirectives,
} from "@cmnt/core/RagamTalamDisplay";
import { renderScoreSvg } from "@cmnt/render/SvgScore";
import { layoutSong } from "@cmnt/core/Layout";
import { Heading } from "@cmnt/model/Heading";
import { melakartaAroAva } from "@cmnt/core/Ragas";

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
    const parts = parseRagamTalamHeading("Ragam : Sri | Talam : Adi\nArO: S R2 G3");
    expect(parts?.aroAva).toBe("ArO: S R2 G3");
  });
});

describe("formatRagamTalamDisplay", () => {
  it("keeps catalogue names roman in Tamil (no garbling) but localizes labels", () => {
    const parts = parseRagamTalamHeading("Ragam : Purnachandrika | Talam : Rupaka (L2+D4)")!;
    const out = formatRagamTalamDisplay(parts, "tamil");
    expect(out.startsWith("ராகம் : Purnachandrika")).toBe(true);
    expect(out).toContain("தாளம் : Rupaka (L2+D4)");
    expect(out).not.toMatch(/உர்ந|றுபக/);
  });

  it("transliterates saved CMNT-roman display spellings", () => {
    const parts = parseRagamTalamHeading("Ragam : Purnachandrika | Talam : Rupaka (L2+D4)")!;
    const out = formatRagamTalamDisplay(parts, "tamil", {
      ragaRoman: "pUrNa",
      talaRoman: "rUpakam",
    });
    expect(out).toContain("ராகம் : பூர்ண");
    expect(out).toContain("தாளம் : ");
    expect(out).not.toContain("Purnachandrika");
  });

  it("leaves english labels/names in roman when script is null", () => {
    const parts = parseRagamTalamHeading("Ragam : Sri | Talam : Adi")!;
    expect(formatRagamTalamDisplay(parts, null)).toBe("Ragam : Sri | Talam : Adi");
    expect(autoRagamDisplayName(parts, null)).toBe("Sri");
    expect(autoTalamDisplayName(parts, null)).toBe("Adi");
  });

  it("uses Telugu / Kannada / Sanskrit labels with roman catalogue names", () => {
    const parts = parseRagamTalamHeading("Ragam : Sri | Talam : Adi")!;
    expect(formatRagamTalamDisplay(parts, "telugu")).toBe("రాగం : Sri | తాళం : Adi");
    expect(formatRagamTalamDisplay(parts, "kannada")).toBe("ರಾಗ : Sri | ತಾಳ : Adi");
    expect(formatRagamTalamDisplay(parts, "sanskrit")).toBe("रागम् : Sri | तालम् : Adi");
  });
});

describe("formatAroAvaDisplay", () => {
  it("maps ArO/avarO labels and swaras into Tamil", () => {
    const out = formatAroAvaDisplay("ArO: S R₂ G₃ M₁ P D₂ N₃ S' - avarO: S' N₃ D₂ P M₁ G₃ R₂ S", "tamil");
    expect(out).toContain("ஆரோ:");
    expect(out).toContain("அவரோ:");
    expect(out).toContain("ஸ");
    expect(out).toContain("ரி");
    expect(out).toContain("க");
    expect(out).toContain("ம");
    expect(out).toContain("ப");
    expect(out).toContain("த");
    expect(out).toContain("நி");
    expect(out).not.toMatch(/\bAro\b|\bAva\b|ற்₂|ஆரொ/);
  });

  it("accepts legacy Aro:/Ava: and rewrites labels", () => {
    const out = formatAroAvaDisplay("Aro: S R2 G3 M1 P - Ava: P M1 G3 R2 S", "tamil");
    expect(out.startsWith("ஆரோ:")).toBe(true);
    expect(out).toContain("அவரோ:");
  });

  it("matches melakartaAroAva emitter form", () => {
    const roman = melakartaAroAva(29)!;
    expect(roman.startsWith("ArO:")).toBe(true);
    expect(roman).toContain("avarO:");
    const ta = formatAroAvaDisplay(roman, "tamil");
    expect(ta).toContain("ஆரோ:");
    expect(ta).toContain("அவரோ:");
  });
});

describe("upsertDisplayDirectives", () => {
  it("inserts and updates RaagamDisplay:/TalamDisplay: in classic source", () => {
    const src = ["Raagam: Sri", "Tala: Adi", "Language: Tamil", "S: s", ""].join("\n");
    const once = upsertDisplayDirectives(src, { ragaRoman: "SrI", talaRoman: "Adi" });
    expect(once).toContain("RaagamDisplay: SrI");
    expect(once).toContain("TalamDisplay: Adi");
    const twice = upsertDisplayDirectives(once, { ragaRoman: "SrIragam" });
    expect(twice.match(/RaagamDisplay:/g)?.length).toBe(1);
    expect(twice).toContain("RaagamDisplay: SrIragam");
    const cleared = upsertDisplayDirectives(twice, { ragaRoman: "", talaRoman: "" });
    expect(cleared).not.toMatch(/RaagamDisplay:|TalamDisplay:/);
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

  it("parses RaagamDisplay:/TalamDisplay: onto the heading", () => {
    const song = parse(
      [
        "Raagam: Purnachandrika",
        "RaagamDisplay: pUrNa",
        "Tala: Rupaka",
        "TalamDisplay: rUpakam",
        "Language: Tamil",
        "DefaultSpeed: 0",
        "S: s r g m",
        "L: sa ri ga ma",
        "",
      ].join("\n"),
    );
    const h = song.parts.find((p): p is Heading => p instanceof Heading && p.role === "ragamTalam")!;
    expect(h.ragaDisplayRoman).toBe("pUrNa");
    expect(h.talaDisplayRoman).toBe("rUpakam");
    const svg = renderScoreSvg(layoutSong(song));
    expect(svg).toContain("ராகம்");
    expect(svg).toContain("பூர்ண");
    expect(svg).not.toContain("Purnachandrika");
  });

  it("renders Tamil labels and roman catalogue names without display overrides", () => {
    const song = parse(
      ["Raagam: Sri", "Tala: Adi", "Language: Tamil", "DefaultSpeed: 0", "S: s r g m", "L: sa ri ga ma", ""].join(
        "\n",
      ),
    );
    const svg = renderScoreSvg(layoutSong(song));
    expect(svg).toContain("ராகம்");
    expect(svg).toContain("தாளம்");
    expect(svg).toContain("Sri");
    expect(svg).toContain("Adi");
    expect(svg).not.toContain("Ragam :");
  });

  it("renders ArO/avarO swaras in Tamil on the score", () => {
    const song = parse(
      ["Raagam: Mayamalavagowla", "Tala: Adi", "Language: Tamil", "DefaultSpeed: 0", "S: s r g m", "L: . . . .", ""].join(
        "\n",
      ),
    );
    const svg = renderScoreSvg(layoutSong(song));
    expect(svg).toContain("ஆரோ");
    expect(svg).toContain("அவரோ");
    expect(svg).toContain("ஸ");
    expect(svg).toContain("ரி");
  });
});
