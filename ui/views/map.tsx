// Map view (show_map / run_demo / compare_map): raster map rendered with
// veda-ui-blocks — the single-layer variant for kind "map", the swipe-compare
// variant for kind "compare". No header bar: the in-map legend already
// surfaces the dataset info pulled from STAC, so title/dates above the map
// would just duplicate it.
import {
  CARTO_DARK_WITH_LABELS_BASEMAP_STYLE,
  GeoConfigProvider,
  StacCompareMap,
  StacSingleLayerMap,
} from "@teamimpact/veda-ui-blocks";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@teamimpact/veda-ui-blocks/default.css";
import {
  parseMapResourceView,
  type CompareView,
  type MapView as MapViewData,
} from "../../view-contract";
import { ViewShell } from "../components/view-shell";
import { useViewResult } from "../hooks/use-view-result";
import { viewStateFromBbox } from "../lib/map-camera";
import styles from "../styles/views.module.css";

function MapView({ view }: { view: MapViewData | CompareView }) {
  return (
    <GeoConfigProvider stacApiUrl={view.stacRoot} titilerBaseUrl={view.rasterRoot}>
      <div className={styles.mapPanel}>
        {view.kind === "map" ? (
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
        ) : (
          <StacCompareMap
            baseMapStyle={CARTO_DARK_WITH_LABELS_BASEMAP_STYLE}
            initialViewState={viewStateFromBbox(view.bbox)}
            showScrollGuard
            leftLayerConfig={{
              type: "raster",
              collectionId: view.left.collectionId,
              collectionAssetId: view.left.renderKey,
              dateRange: view.left.dateRange,
            }}
            rightLayerConfig={{
              type: "raster",
              collectionId: view.right.collectionId,
              collectionAssetId: view.right.renderKey,
              dateRange: view.right.dateRange,
            }}
          />
        )}
      </div>
    </GeoConfigProvider>
  );
}

function MapApp() {
  const result = useViewResult("VEDA Map", parseMapResourceView);
  return <ViewShell result={result}>{(view) => <MapView view={view} />}</ViewShell>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MapApp />
  </StrictMode>,
);
