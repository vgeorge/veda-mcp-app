import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

const INPUT = process.env.INPUT;
if (!INPUT) {
  throw new Error("INPUT environment variable is not set");
}

const isDevelopment = process.env.NODE_ENV === "development";

// veda-ui-blocks' single entry statically imports every optional dep, so each
// view entry stubs what it doesn't render. Only the map entry keeps the real
// map stack.
const VEDA_UI_BLOCKS_STUB = path.resolve(
  import.meta.dirname,
  "src/veda-ui-blocks-stubs.ts",
);

const NEEDS_MAP = INPUT === "map.html";

const STUBS: Record<string, string> = {
  "embla-carousel-react": VEDA_UI_BLOCKS_STUB,
  ...(NEEDS_MAP
    ? {}
    : {
        // StacCompareMap (mapbox-gl-compare) is only mounted by the map entry;
        // the picker/items entries don't render it, so they stub it.
        "mapbox-gl-compare": VEDA_UI_BLOCKS_STUB,
        "maplibre-gl": VEDA_UI_BLOCKS_STUB,
        "react-map-gl/maplibre": VEDA_UI_BLOCKS_STUB,
        "@tanstack/react-query": VEDA_UI_BLOCKS_STUB,
        "@developmentseed/stac-react": VEDA_UI_BLOCKS_STUB,
      }),
};

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: STUBS,
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
