// Read-only items view (list_items): dated scenes with preview thumbnails.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@teamimpact/veda-ui-blocks/default.css";
import { parseItemsView, type ItemView } from "../../view-contract";
import { ItemCard } from "../cards";
import styles from "../mcp-app.module.css";
import { DebugDetails, safeAreaStyle, useViewResult } from "../use-view-result";

function ItemsView({
  collectionId,
  items,
}: {
  collectionId: string;
  items: ItemView[];
}) {
  return (
    <div>
      <h2 className={styles.subhead}>{collectionId}</h2>
      {items.length === 0 ? (
        <p>No items found.</p>
      ) : (
        <ul className={styles.cardList}>
          {items.map((item) => (
            <li key={item.id}>
              <ItemCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ItemsApp() {
  const { view, error, debug, connecting, hostContext } = useViewResult(
    "VEDA Items",
    parseItemsView,
  );

  if (connecting) return <div>Connecting...</div>;

  return (
    <main className={styles.main} style={safeAreaStyle(hostContext)}>
      {error && <p className={styles.error}>{error}</p>}
      {view && <ItemsView collectionId={view.collectionId} items={view.items} />}
      {!view && !error && <p className={styles.notice}>Waiting for results…</p>}
      {error && <DebugDetails debug={debug} />}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ItemsApp />
  </StrictMode>,
);
