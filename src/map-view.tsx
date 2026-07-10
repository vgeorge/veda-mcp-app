// Single-layer raster map of a collection over a date range, rendered with
// veda-ui-blocks. MCP-free so the preview harness can render it standalone.
// No header bar: the in-map legend already surfaces the dataset info pulled
// from STAC, so title/dates above the map would just duplicate it.
import {
  CARTO_DARK_WITH_LABELS_BASEMAP_STYLE,
  GeoConfigProvider,
  StacSingleLayerMap,
} from "@teamimpact/veda-ui-blocks";
import type { MapView as MapViewData } from "../view-contract";
import styles from "./mcp-app.module.css";

// Rough camera fit for the collection's spatial extent in the ~425px panel:
// zoom so the bbox's larger dimension fills the view (global -> zoom 0).
function viewStateFromBbox(bbox: number[] | null) {
  if (!bbox || bbox.length < 4) return undefined;
  const [west, south, east, north] = bbox;
  const span = Math.max(east - west, (north - south) * 2, 1);
  return {
    longitude: (west + east) / 2,
    latitude: (south + north) / 2,
    zoom: Math.max(0, Math.min(8, Math.log2(360 / span))),
  };
}

export function MapView({ view }: { view: MapViewData }) {
  return (
    <GeoConfigProvider stacApiUrl={view.stacRoot} titilerBaseUrl={view.rasterRoot}>
      <div className={styles.mapPanel}>
        <StacSingleLayerMap
          baseMapStyle={CARTO_DARK_WITH_LABELS_BASEMAP_STYLE}
          initialViewState={viewStateFromBbox(view.bbox)}
          showScrollGuard
          layerConfig={{
            type: "raster",
            collectionId: view.collectionId,
            collectionAssetId: view.renderKey,
            dateRange: view.dateRange,
          }}
        />
      </div>
    </GeoConfigProvider>
  );
}
