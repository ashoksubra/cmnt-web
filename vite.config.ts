import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: "web",
  base: "./",
  publicDir: false,
  resolve: {
    alias: {
      "@cmnt": resolve(root, "src"),
    },
  },
  server: {
    fs: {
      allow: [root],
    },
  },
  build: {
    outDir: resolve(root, "dist-web"),
    emptyOutDir: true,
  },
});
