import { describe, expect, it } from "vitest";
import { Fraction } from "@cmnt/model/Fraction";

describe("Fraction", () => {
  it("reduces on construct", () => {
    const f = new Fraction(2, 4);
    expect(f.num).toBe(1);
    expect(f.den).toBe(2);
    expect(f.toString()).toBe("1/2");
  });

  it("adds and subtracts exactly", () => {
    const a = new Fraction(1, 4);
    const b = new Fraction(1, 2);
    expect(a.add(b).toString()).toBe("3/4");
    expect(b.sub(a).toString()).toBe("1/4");
  });

  it("supports madhyamakalam unit math", () => {
    // speed-2 catusra short note = 1/4 akshara; two dheergams = 1/2 each
    const s = new Fraction(1, 4);
    const rI = new Fraction(1, 2);
    const beforeBar = s.add(rI); // 3/4
    expect(beforeBar.toString()).toBe("3/4");
    const splitBefore = Fraction.of(1).sub(beforeBar); // 1/4 before |
    expect(splitBefore.toString()).toBe("1/4");
  });

  it("mods against cycle length", () => {
    const pos = new Fraction(4, 1);
    expect(pos.mod(3).toString()).toBe("1");
  });
});
