// Dev-only visual harness: renders the views with fixture data outside the
// MCP host, so card layout can be inspected in a plain browser (vite dev,
// open /preview.html). Not part of the shipped bundle (build input is
// mcp-app.html only).
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@teamimpact/veda-ui-blocks/default.css";
import type { CollectionView, ItemView } from "../view-contract";
import styles from "./mcp-app.module.css";
import { CollectionsView, ItemsView } from "./views";

const PREVIEW =
  "https://dev.openveda.cloud/api/raster/collections/no2-monthly/items/OMI_trno2_0.10x0.10_202312_Col3_V4.nc/preview.png?assets=cog_default&bidx=1&rescale=0%2C15000000000000000&colormap_name=rdbu_r&color_formula=gamma+r+1.05&resampling=bilinear";

const COLLECTIONS: CollectionView[] = [
  {
    id: "no2-monthly",
    title: "NO₂",
    description:
      "Darker colors indicate higher nitrogen dioxide (NO₂) levels and more activity. Lighter colors indicate lower levels of NO₂ and less activity.",
  },
  { id: "hls-swir", title: "HLS SWIR FalseColor Composite", description: null },
  { id: "geos-cf-ana", title: "geos-cf-ana", description: "GEOS-CF analysis files." },
];

const ITEMS: ItemView[] = [
  {
    id: "OMI_trno2_0.10x0.10_202312_Col3_V4.nc",
    start: "2023-12-01T00:00:00Z",
    end: "2023-12-31T00:00:00Z",
    previewHref: PREVIEW,
    cogHref: "s3://veda-data-store-staging/no2-monthly/x.tif",
    bbox: [-180, -90, 180, 90],
  },
  {
    id: "OMI_trno2_0.10x0.10_202311_Col3_V4.nc",
    start: "2023-11-01T00:00:00Z",
    end: "2023-11-30T00:00:00Z",
    previewHref: null, // exercises the svg placeholder path
    cogHref: null,
    bbox: null,
  },
];

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <main className={styles.main}>
      <h1>VEDA MCP App</h1>
      <div className={styles.toolbar}>
        <button type="button">Run demo</button>
        <button type="button">Browse collections</button>
      </div>
      <CollectionsView collections={COLLECTIONS} busy={false} onOpen={() => {}} />
      <ItemsView collectionId="no2-monthly" items={ITEMS} demo={true} />
    </main>
  </StrictMode>,
);
