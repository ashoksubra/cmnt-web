import { describe, expect, it } from "vitest";
import {
  applyCorrection,
  dwijaCount,
  janyaCount,
  janyaAroAva,
  janyaForName,
  lookupAny,
  melakartaAroAva,
  melakartaNumberForName,
} from "@cmnt/core/Ragas";

describe("Ragas", () => {
  it("resolves Mayamalavagowla to melakarta 15", () => {
    expect(melakartaNumberForName("Mayamalavagowla")).toBe(15);
  });

  it("formats melakarta 29 Aro/Ava with subscript variants", () => {
    const text = melakartaAroAva(29);
    expect(text).not.toBeNull();
    expect(text).toBe("ArO: S R₂ G₃ M₁ P D₂ N₃ S' - avarO: S' N₃ D₂ P M₁ G₃ R₂ S");
  });

  it("resolves janya Hamsadhwani (alternate spelling)", () => {
    const j = janyaForName("Hamsadhwani") ?? janyaForName("Hamsadwani");
    expect(j).not.toBeNull();
    expect(j!.melakarta).toBe(29);
    expect(j!.aro).toBe("SRGPNS");
    const aroAva = janyaAroAva(j!);
    expect(aroAva).toMatch(/^ArO: /);
  });

  it("resolves Sankachakra janya Purnachandrika", () => {
    const j = janyaForName("Purnachandrika");
    expect(j).not.toBeNull();
    expect(j!.melakarta).toBe(29);
    expect(j!.name).toBe("Purnachandrika");
  });

  it("loads bundled tables", () => {
    expect(janyaCount()).toBeGreaterThan(1000);
    expect(dwijaCount()).toBeGreaterThan(100);
  });

  it("lookupAny finds melakarta, janya, and unknown", () => {
    expect(lookupAny("Mayamalavagowla").kind).toBe("MELAKARTA");
    expect(lookupAny("Hamsadwani").kind).toBe("JANYA");
    expect(lookupAny("NotARealRagaXYZ").kind).toBe("UNKNOWN");
  });

  it("applyCorrection updates janya Aro/Ava in-memory", () => {
    applyCorrection("TestAroAvaRagaXYZ", 29, "S R G P N S", "S N D P G R S", false);
    const j = janyaForName("TestAroAvaRagaXYZ");
    expect(j).not.toBeNull();
    expect(j!.aro).toBe("SRGPNS");
    expect(j!.ava).toBe("SNDPGRS");
    expect(janyaAroAva(j!)!).toContain("D₂");
    expect(() => applyCorrection("Kalyani", 65, "S R G M P D N S", "S N D P M G R S", false)).toThrow(
      /melakarta/i,
    );
  });

  it("applyCorrection overrides a bundled janya Aro/Ava", () => {
    const orig = janyaForName("Hamsadwani");
    expect(orig).not.toBeNull();
    applyCorrection("Hamsadwani", orig!.melakarta, "S R G P S", orig!.ava, false);
    expect(janyaForName("Hamsadwani")!.aro).toBe("SRGPS");
    applyCorrection("Hamsadwani", orig!.melakarta, orig!.aro, orig!.ava, false);
    expect(janyaForName("Hamsadwani")!.aro).toBe(orig!.aro);
  });
});
