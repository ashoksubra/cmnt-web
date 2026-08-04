import { describe, expect, it } from "vitest";
import { parse } from "@cmnt/core/CmntParser";
import { layoutSong, VisualHeading, VisualRow } from "@cmnt/core/Layout";
import { Heading } from "@cmnt/model/Heading";
import { paginateLayoutItems, estimateItemHeight } from "@cmnt/render/ScorePagination";
import { alignSection } from "@cmnt/render/SvgScore";
import { Cell } from "@cmnt/core/Layout";
import { Fraction } from "@cmnt/model/Fraction";

describe("paginateLayoutItems", () => {
  it("keeps a section title with the following notation row (no orphan heading)", () => {
    const heading = new VisualHeading(Object.assign(new Heading("madyama kAlam:"), { fontSize: "14" }));
    const row = new VisualRow();
    const c = new Cell();
    c.kind = "swara";
    c.text = "s";
    c.duration = Fraction.ONE;
    c.lyrics = ["sa"];
    row.cells = [c];

    // Tiny page: heading alone would fit, but heading+row does not after other content.
    const filler = new VisualRow();
    filler.cells = [c];
    const fillerH = estimateItemHeight(filler);
    const headingH = estimateItemHeight(heading);
    const rowH = estimateItemHeight(row);
    const pageH = fillerH + headingH + 1; // room for filler+heading, not +row

    const pages = paginateLayoutItems([filler, heading, row], { pageContentHeight: pageH });
    expect(pages.length).toBe(2);
    expect(pages[0]).toEqual([filler]);
    expect(pages[1]![0]).toBe(heading);
    expect(pages[1]![1]).toBe(row);
  });

  it("does not leave Tamil section labels alone at the bottom of a page", () => {
    const song = parse(
      [
        "Raagam: Sri",
        "Tala: Adi",
        "Language: Tamil",
        "DefaultSpeed: 0",
        "Heading: \"title\",center,16",
        "Heading: \"pallavi:\",left,bold,14",
        "S: s r g m p d n S",
        "L: sa ri ga ma pa da ni sa",
        "Heading: \"madyama kAlam:\",left,bold,14",
        "S: s r g m p d n S s r g m p d n S",
        "L: a b c d e f g h i j k l m n o p",
        "",
      ].join("\n"),
    );
    const items = layoutSong(song);
    const pages = paginateLayoutItems(items, { pageContentHeight: 280 });
    for (const page of pages) {
      const last = page[page.length - 1];
      if (last instanceof VisualHeading) {
        const t = last.heading.text.trim();
        expect(t.endsWith(":")).toBe(false); // section label not last on page
      }
    }
    // Every section heading page also contains a following VisualRow.
    for (const page of pages) {
      for (let i = 0; i < page.length; i++) {
        const it = page[i]!;
        if (!(it instanceof VisualHeading)) continue;
        const t = it.heading.text.trim();
        if (!t.endsWith(":")) continue;
        const rest = page.slice(i + 1);
        expect(rest.some((x) => x instanceof VisualRow)).toBe(true);
      }
    }
  });
});

describe("alignSection left-right justify", () => {
  it("makes every row in a section sum to the target width", () => {
    const marker = (t: string) => {
      const c = new Cell();
      c.kind = "marker";
      c.text = t;
      return c;
    };
    const sw = (t: string, d: Fraction) => {
      const c = new Cell();
      c.kind = "swara";
      c.text = t;
      c.duration = d;
      return c;
    };
    const rowA = new VisualRow();
    rowA.cells = [marker("||"), sw("s", Fraction.ONE), marker("|"), sw("r", Fraction.ONE), sw("g", Fraction.ONE)];
    const rowB = new VisualRow();
    // Fewer cells — previously ended short of the right margin.
    rowB.cells = [marker("||"), sw("s", Fraction.ONE), marker("|"), sw("r", new Fraction(2, 1))];
    const target = 900;
    const aligned = alignSection([rowA, rowB], target);
    expect(aligned.get(rowA)!.reduce((a, b) => a + b, 0)).toBeCloseTo(target, 1);
    expect(aligned.get(rowB)!.reduce((a, b) => a + b, 0)).toBeCloseTo(target, 1);
  });
});
