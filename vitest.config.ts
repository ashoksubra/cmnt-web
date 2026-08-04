import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(root, "src");
const ragasTablesVite = resolve(root, "src/core/ragasTables.vite.ts");

function ragasTablesBrowserPlugin(): Plugin {
  return {
    name: "ragas-tables-browser",
    enforce: "pre",
    resolveId(source) {
      if (
        source === "./ragasTables.js" ||
        source.endsWith("/core/ragasTables.ts") ||
        source.endsWith("/core/ragasTables.js") ||
        source.endsWith("\\core\\ragasTables.ts") ||
        source.endsWith("\\core\\ragasTables.js")
      ) {
        return ragasTablesVite;
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [ragasTablesBrowserPlugin()],
  resolve: {
    alias: {
      "@cmnt": srcRoot,
    },
  },
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
  },
});
