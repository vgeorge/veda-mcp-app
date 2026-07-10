// Collections/items views rendered from the parsed view data. Kept free of
// MCP plumbing so the preview harness (preview.html) can render them
// standalone.
import type { CollectionView, ItemView } from "../view-contract";
import { CollectionCard, ItemCard } from "./cards";
import styles from "./mcp-app.module.css";

// Collapsed dump of what the host actually delivered to ontoolresult, for
// debugging delivery differences between hosts from inside the sandbox.
export function DebugDetails({ debug }: { debug: string | null }) {
  if (!debug) return null;
  return (
    <details className={styles.debug}>
      <summary>Debug: last tool result</summary>
      <pre>{debug}</pre>
    </details>
  );
}

export function CollectionsView({
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

export function ItemsView({
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
