// Read-only items view (list_items): dated scenes with preview thumbnails.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@teamimpact/veda-ui-blocks/default.css";
import { parseItemsView } from "../../view-contract";
import { ItemCard } from "../components/cards";
import { ViewShell } from "../components/view-shell";
import { useViewResult } from "../hooks/use-view-result";
import styles from "../styles/views.module.css";

function ItemsApp() {
  const result = useViewResult("VEDA Items", parseItemsView);

  return (
    <ViewShell result={result}>
      {(view) => (
        <div>
          <h2 className={styles.subhead}>{view.collectionId}</h2>
          {view.items.length === 0 ? (
            <p>No items found.</p>
          ) : (
            <ul className={styles.cardList}>
              {view.items.map((item) => (
                <li key={item.id}>
                  <ItemCard item={item} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </ViewShell>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ItemsApp />
  </StrictMode>,
);
