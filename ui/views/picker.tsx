// Collection picker view (search_collections). Clicking a card announces the
// pick in the chat via sendMessage so the conversation drives the next step —
// no widget-local navigation.
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "@teamimpact/veda-ui-blocks/default.css";
import { parseCollectionsView, type CollectionView } from "../../view-contract";
import { CollectionCard } from "../components/cards";
import { ViewShell } from "../components/view-shell";
import { useViewResult } from "../hooks/use-view-result";
import styles from "../styles/views.module.css";

const SEND_FAILED =
  "Couldn't send your selection to the chat — type it instead.";

function PickerApp() {
  const result = useViewResult("VEDA Collection Picker", parseCollectionsView);
  const [sending, setSending] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);

  const pick = async (collection: CollectionView) => {
    if (!result.app) return;
    setSending(true);
    setPickError(null);
    try {
      const sent = await result.app.sendMessage({
        role: "user",
        content: [{
          type: "text",
          text: `I picked the dataset "${collection.title}" (id: ${collection.id}).`,
        }],
      });
      if (sent.isError) setPickError(SEND_FAILED);
    } catch (e) {
      console.error(e);
      setPickError(SEND_FAILED);
    } finally {
      setSending(false);
    }
  };

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
    <PickerApp />
  </StrictMode>,
);
