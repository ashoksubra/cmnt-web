import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function loadFromFs(filename: string): string {
  const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
  return readFileSync(join(root, "resources/ragas", filename), "utf-8");
}

/** Node/tsc build: load bundled tables from resources/ragas/ on disk. */
export const janyasTsv = loadFromFs("janyas.tsv");
export const janyasDwijaTsv = loadFromFs("janyas_dwija.tsv");
export const sriRagamTsv = loadFromFs("sri_ragam.tsv");
