// Adapters mapping view-contract types onto veda-ui-blocks cards.
import { CardCTA, CardDetailed, Tag } from "@teamimpact/veda-ui-blocks";
import type { CollectionView, ItemView } from "../view-contract";
import styles from "./mcp-app.module.css";

interface CollectionCardProps {
  collection: CollectionView;
  busy: boolean;
  onOpen: (collectionId: string) => void;
}

export function CollectionCard({ collection, busy, onOpen }: CollectionCardProps) {
  return (
    <CardCTA
      as="button"
      type="button"
      className={styles.collectionCard}
      title={collection.title}
      titleAs="h3"
      description={collection.description ?? collection.id}
      onClick={() => onOpen(collection.id)}
      disabled={busy}
    />
  );
}

// Neutral placeholder for the rare item without a preview (image is required).
const PLACEHOLDER = (
  <svg
    viewBox="0 0 96 96"
    preserveAspectRatio="none"
    role="img"
    aria-label="No preview available"
  >
    <rect width="96" height="96" fill="#dfe1e2" />
  </svg>
);

interface ItemCardProps {
  item: ItemView;
  demo: boolean;
}

export function ItemCard({ item, demo }: ItemCardProps) {
  return (
    <CardDetailed
      className={styles.itemCard}
      imagePosition="left"
      image={
        item.previewHref ? (
          <img src={item.previewHref} alt={item.id} loading="lazy" />
        ) : (
          PLACEHOLDER
        )
      }
      title={item.id}
      description={`${item.start ?? "?"} → ${item.end ?? "?"}`}
      tagPrimary={demo ? <Tag variant="solid">Demo</Tag> : undefined}
    />
  );
}
