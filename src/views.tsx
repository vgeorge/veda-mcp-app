// Collections/items views rendered from the parsed View. Kept free of MCP
// plumbing so the preview harness (preview.html) can render them standalone.
import type { CollectionView, ItemView } from "../view-contract";
import { CollectionCard, ItemCard } from "./cards";
import styles from "./mcp-app.module.css";

export function CollectionsView({
  collections,
  busy,
  onOpen,
}: {
  collections: CollectionView[];
  busy: boolean;
  onOpen: (id: string) => void;
}) {
  if (collections.length === 0) return <p>No collections found.</p>;
  return (
    <ul className={styles.cardList}>
      {collections.map((c) => (
        <li key={c.id}>
          <CollectionCard collection={c} busy={busy} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  );
}

export function ItemsView({
  collectionId,
  items,
  demo,
}: {
  collectionId: string;
  items: ItemView[];
  demo: boolean;
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
              <ItemCard item={item} demo={demo} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
