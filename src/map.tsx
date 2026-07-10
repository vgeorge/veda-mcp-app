// Map view (show_map / run_demo): single-layer raster map of a collection.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@teamimpact/veda-ui-blocks/default.css";
import { parseMapResourceView } from "../view-contract";
import { MapView } from "./map-view";
import styles from "./mcp-app.module.css";
import { safeAreaStyle, useViewResult } from "./use-view-result";
import { DebugDetails } from "./views";

function MapApp() {
  const { view, error, debug, connecting, hostContext } = useViewResult(
    "VEDA Map",
    parseMapResourceView,
  );

  if (connecting) return <div>Connecting...</div>;

  return (
    <main className={styles.main} style={safeAreaStyle(hostContext)}>
      {error && <p className={styles.error}>{error}</p>}
      {view && <MapView view={view} />}
      {!view && !error && <p className={styles.notice}>Waiting for results…</p>}
      {error && <DebugDetails debug={debug} />}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MapApp />
  </StrictMode>,
);
