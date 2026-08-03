/**
 * Compact plain-text dump of layoutSong() output, for debugging and golden-file
 * regression tests (see fixtures/goldens/*.layout.txt).
 */
import { Cell, VisualBreak, VisualHeading, VisualPageBreak, VisualRow } from "./Layout.js";

function renderCell(cell: Cell): string {
  if (cell.kind === "gap") return "_";
  if (cell.kind === "marker") return `[${cell.text}]`;
  if (cell.kind === "gati") return `<${cell.text}>`;
  const octave = cell.octave !== 0 ? `@${cell.octave}` : "";
  return `${cell.text}${octave}(d=${cell.duration.toString()})`;
}

/**
 * Dumps layoutSong() items as one line per row/heading, e.g.:
 *   HEAD: Talam : Adi (L+D+D)
 *   BLOCK: 1)
 *   row00: s(d=1/4) r(d=1/4) ... s@1(d=1/4)
 * Gap cells render as `_`; markers render as `[|]` / `[||]`.
 */
export function dumpLayoutItems(items: unknown[]): string {
  const lines: string[] = [];
  let rowIdx = 0;
  for (const item of items) {
    if (item instanceof VisualHeading) {
      lines.push(`HEAD: ${item.heading.text}`);
    } else if (item instanceof VisualBreak) {
      lines.push("BREAK");
    } else if (item instanceof VisualPageBreak) {
      lines.push("PAGE_BREAK");
    } else if (item instanceof VisualRow) {
      if (item.blockHeading != null) {
        lines.push(`BLOCK: ${item.blockHeading}`);
      }
      const label = String(rowIdx++).padStart(2, "0");
      const cellText = item.cells.map(renderCell).join(" ");
      lines.push(`row${label}: ${cellText}`);
    }
  }
  return lines.length === 0 ? "" : lines.join("\n") + "\n";
}
