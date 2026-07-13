// Collection picker view (search_collections). Clicking a card announces the
// pick in the chat via sendMessage so the conversation drives the next step —
// no widget-local navigation.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@teamimpact/veda-ui-blocks/default.css";
import { parseCollectionsView } from "../../view-contract";
import { CollectionCard } from "../components/cards";
import { ViewShell } from "../components/view-shell";
import { useSendPick } from "../hooks/use-send-pick";
import { useViewResult } from "../hooks/use-view-result";
import styles from "../styles/views.module.css";

function CollectionPickerApp() {
  const result = useViewResult("VEDA Collection Picker", parseCollectionsView);
  const { pick, sending, pickError } = useSendPick(result.app);

  return (
    <ViewShell result={result} errorOverride={pickError}>
      {(view) =>
        view.collections.length === 0 ? (
          <p>No collections found.</p>
        ) : (
          <ul className={styles.collectionGrid}>
            {view.collections.map((c) => (
              <li key={c.id}>
                <CollectionCard collection={c} busy={sending} onPick={pick} />
              </li>
            ))}
          </ul>
        )
      }
    </ViewShell>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CollectionPickerApp />
  </StrictMode>,
);
