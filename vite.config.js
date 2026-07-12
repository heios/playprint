import { defineConfig } from "vite";

// GitHub Pages serves project sites from /<repo-name>/, so the build needs a
// matching base path. Overridable via BASE_PATH for local/other deployments.
const base = process.env.BASE_PATH ?? "/playprint/";

export default defineConfig({
  base,
  build: {
    outDir: "dist",
  },
});
