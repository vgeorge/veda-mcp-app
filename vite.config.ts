import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

const INPUT = process.env.INPUT;
if (!INPUT) {
  throw new Error("INPUT environment variable is not set");
}

const isDevelopment = process.env.NODE_ENV === "development";

// veda-ui-blocks' single entry statically imports its map/query/carousel deps;
// we only use its cards, so stub the heavy deps out of the bundle.
const VEDA_UI_BLOCKS_STUB = path.resolve(
  import.meta.dirname,
  "src/veda-ui-blocks-stubs.ts",
);

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      "maplibre-gl": VEDA_UI_BLOCKS_STUB,
      "react-map-gl/maplibre": VEDA_UI_BLOCKS_STUB,
      "mapbox-gl-compare": VEDA_UI_BLOCKS_STUB,
      "@tanstack/react-query": VEDA_UI_BLOCKS_STUB,
      "@developmentseed/stac-react": VEDA_UI_BLOCKS_STUB,
      "embla-carousel-react": VEDA_UI_BLOCKS_STUB,
    },
  },
  build: {
    sourcemap: isDevelopment ? "inline" : undefined,
    cssMinify: !isDevelopment,
    minify: !isDevelopment,

    rollupOptions: {
      input: INPUT,
    },
    outDir: "dist",
    emptyOutDir: false,
  },
});
