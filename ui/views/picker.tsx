// Collection picker view (search_collections). Clicking a card announces the
// pick in the chat via sendMessage so the conversation drives the next step —
// no widget-local navigation.
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "@teamimpact/veda-ui-blocks/default.css";
import { parseCollectionsView, type CollectionView } from "../../view-contract";
import { CollectionCard } from "../cards";
import styles from "../mcp-app.module.css";
import { DebugDetails, safeAreaStyle, useViewResult } from "../use-view-result";

const SEND_FAILED =
  "Couldn't send your selection to the chat — type it instead.";

function CollectionsView({
  collections,
  busy,
  onPick,
}: {
  collections: CollectionView[];
  busy: boolean;
  onPick: (collection: CollectionView) => void;
}) {
  if (collections.length === 0) return <p>No collections found.</p>;
  return (
    <ul className={styles.collectionGrid}>
      {collections.map((c) => (
        <li key={c.id}>
          <CollectionCard collection={c} busy={busy} onPick={onPick} />
        </li>
      ))}
    </ul>
  );
}

function PickerApp() {
  const { app, view, error, debug, connecting, hostContext } = useViewResult(
    "VEDA Collection Picker",
    parseCollectionsView,
  );
  const [sending, setSending] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);

  if (connecting) return <div>Connecting...</div>;

  const pick = async (collection: CollectionView) => {
    if (!app) return;
    setSending(true);
    setPickError(null);
    try {
      const result = await app.sendMessage({
        role: "user",
        content: [{
          type: "text",
          text: `I picked the dataset "${collection.title}" (id: ${collection.id}).`,
        }],
      });
      if (result.isError) setPickError(SEND_FAILED);
    } catch (e) {
      console.error(e);
      setPickError(SEND_FAILED);
    } finally {
      setSending(false);
    }
  };

  const shownError = pickError ?? error;
  return (
    <main className={styles.main} style={safeAreaStyle(hostContext)}>
      {shownError && <p className={styles.error}>{shownError}</p>}
      {view && (
        <CollectionsView collections={view.collections} busy={sending} onPick={pick} />
      )}
      {!view && !shownError && <p className={styles.notice}>Waiting for results…</p>}
      {error && <DebugDetails debug={debug} />}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PickerApp />
  </StrictMode>,
);
