// Dev-only visual harness: renders the step views with fixture data outside
// the MCP host, so layout can be inspected in a plain browser. Run with
// INPUT=map.html (the map alias set) so the map stack is real:
//   INPUT=map.html npx vite --port 3006   ->   /preview.html
// Not part of the shipped bundles (build inputs are picker/items/map.html).
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@teamimpact/veda-ui-blocks/default.css";
import type { CollectionView, ItemView, MapView as MapViewData } from "../view-contract";
import { MapView } from "./map-view";
import styles from "./mcp-app.module.css";
import { CollectionsView, ItemsView } from "./views";

const PREVIEW =
  "https://dev.openveda.cloud/api/raster/collections/no2-monthly/items/OMI_trno2_0.10x0.10_202312_Col3_V4.nc/preview.png?assets=cog_default&bidx=1&rescale=0%2C15000000000000000&colormap_name=rdbu_r&color_formula=gamma+r+1.05&resampling=bilinear";

const COLLECTIONS: CollectionView[] = [
  {
    id: "no2-monthly-diff",
    title: "NO₂ (Diff)",
    description:
      "Darker colors indicate higher nitrogen dioxide (NO₂) levels and more activity. Lighter colors indicate lower levels of NO₂ and less activity.",
    temporal: { start: "2015-01-01", end: "2023-12-31" },
    thumbnailHref: "https://thumbnails.openveda.cloud/no2--dataset-cover.jpg",
  },
  {
    id: "hls-swir",
    title: "HLS SWIR FalseColor Composite",
    description: null,
    temporal: { start: "2020-01-01", end: null },
    thumbnailHref: null, // exercises the placeholder path
  },
  {
    id: "geos-cf-ana",
    title: "geos-cf-ana",
    description: "GEOS-CF analysis files.",
    temporal: null,
    thumbnailHref: "https://thumbnails.openveda.cloud/geoscf--dataset-cover.jpg",
  },
  {
    id: "omi-tropospheric-no2",
    title: "OMI/Aura Tropospheric Nitrogen Dioxide",
    description:
      "Gridded tropospheric NO₂ column information derived from observations collected by the Ozone Monitoring Instrument aboard NASA's Aura satellite.",
    temporal: { start: "2005-01-01", end: "2022-12-31" },
    thumbnailHref: null,
  },
  {
    id: "tempo-no2-l3",
    title: "Troposphere nitrogen dioxide vertical column",
    description: "Troposphere nitrogen dioxide integrated within the vertical column.",
    temporal: { start: "2024-04-01", end: "2024-04-11" },
    thumbnailHref: "https://thumbnails.openveda.cloud/does-not-exist.jpg", // 404 -> onError globe
  },
  {
    id: "tropess-nox-anth",
    title: "TROPESS Surface Anthropogenic NOx emissions",
    description:
      "Surface total NOx emissions monthly product, part of the Tropospheric Chemical Reanalysis v2.",
    temporal: { start: "2005-01-01", end: "2021-12-31" },
    thumbnailHref: null,
  },
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

// Live fixture: the map fetches the collection, titiler mosaic and tiles from
// the real dev APIs, so this doubles as the asset-resolution check.
const MAP_VIEW: MapViewData = {
  kind: "map",
  collectionId: "no2-monthly-diff",
  collectionTitle: "NO₂ (Diff)",
  renderKey: "dashboard",
  dateRange: { from: "2020-01-01", to: "2021-12-31" },
  bbox: [-180, -90, 180, 90],
  stacRoot: "https://dev.openveda.cloud/api/stac",
  rasterRoot: "https://dev.openveda.cloud/api/raster",
  demo: true,
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <main className={styles.main}>
      <h1>VEDA MCP App views</h1>
      <MapView view={MAP_VIEW} />
      <CollectionsView
        collections={COLLECTIONS}
        busy={false}
        onPick={(c) => console.log("picked", c.id)}
      />
      <ItemsView collectionId="no2-monthly" items={ITEMS} />
    </main>
  </StrictMode>,
);
