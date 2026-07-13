// Adapters mapping view-contract types onto veda-ui-blocks cards.
import { CardDetailed, Tag } from "@teamimpact/veda-ui-blocks";
import type { CollectionView, ItemView } from "../../view-contract";
import styles from "../styles/views.module.css";
import { CardMedia } from "./card-media";

function coverageLine(c: {
  temporal: { start: string | null; end: string | null } | null;
}): string | null {
  if (!c.temporal) return null;
  return `${c.temporal.start ?? "open"} – ${c.temporal.end ?? "open"}`;
}

interface CollectionCardProps {
  collection: CollectionView;
  busy: boolean;
  onPick: (collection: CollectionView) => void;
}

// STAC-Browser-style tile: cover image on top with a coverage badge, title,
// truncated description, and a pick action pinned to the card foot.
export function CollectionCard({ collection, busy, onPick }: CollectionCardProps) {
  const coverage = coverageLine(collection);
  return (
    <CardDetailed
      className={styles.collectionCard}
      imagePosition="top"
      image={<CardMedia id={collection.id} href={collection.thumbnailHref} />}
      title={collection.title}
      description={collection.description ?? collection.id}
      tagPrimary={coverage ? <Tag>{coverage}</Tag> : undefined}
      callToAction={{
        label: "Select",
        as: "button",
        type: "button",
        variant: "button",
        onClick: () => onPick(collection),
        disabled: busy,
      }}
    />
  );
}

interface ItemCardProps {
  item: ItemView;
}

export function ItemCard({ item }: ItemCardProps) {
  return (
    <CardDetailed
      className={styles.itemCard}
      imagePosition="left"
      image={<CardMedia id={item.id} href={item.previewHref} />}
      title={item.id}
      description={`${item.start ?? "?"} → ${item.end ?? "?"}`}
    />
  );
}
