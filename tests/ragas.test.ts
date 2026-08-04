import { describe, expect, it } from "vitest";
import {
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
});
