// Adapters mapping view-contract types onto veda-ui-blocks cards.
import { CardDetailed, Tag } from "@teamimpact/veda-ui-blocks";
import type { SyntheticEvent } from "react";
import type { CollectionView, ItemView } from "../view-contract";
import styles from "./mcp-app.module.css";

function coverageLine(collection: CollectionView): string | null {
  if (!collection.temporal) return null;
  return `${collection.temporal.start ?? "open"} to ${collection.temporal.end ?? "open"}`;
}

// Neutral gray swapped in when a thumbnail URL fails to load (dev catalog
// thumbnails are spotty), so cards never show a broken-image icon.
const FALLBACK_SRC =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" preserveAspectRatio="none"><rect width="96" height="96" fill="#dfe1e2"/></svg>',
  );

function swapToFallback(e: SyntheticEvent<HTMLImageElement>) {
  if (e.currentTarget.src !== FALLBACK_SRC) e.currentTarget.src = FALLBACK_SRC;
}

// Neutral placeholder when a card has no image (the image prop is required).
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

interface CollectionCardProps {
  collection: CollectionView;
  busy: boolean;
  onPick: (collection: CollectionView) => void;
}

// STAC-Browser-style tile: cover image on top, title, truncated description,
// temporal coverage tag, and a pick action that advances the chat.
export function CollectionCard({ collection, busy, onPick }: CollectionCardProps) {
  const coverage = coverageLine(collection);
  return (
    <CardDetailed
      className={styles.collectionCard}
      imagePosition="top"
      image={
        collection.thumbnailHref ? (
          <img
            src={collection.thumbnailHref}
            alt=""
            loading="lazy"
            onError={swapToFallback}
          />
        ) : (
          PLACEHOLDER
        )
      }
      title={collection.title}
      description={collection.description ?? collection.id}
      tags={coverage ? [<Tag key="coverage">{coverage}</Tag>] : undefined}
      callToAction={{
        label: "Pick this dataset",
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
      image={
        item.previewHref ? (
          <img src={item.previewHref} alt={item.id} loading="lazy" />
        ) : (
          PLACEHOLDER
        )
      }
      title={item.id}
      description={`${item.start ?? "?"} → ${item.end ?? "?"}`}
    />
  );
}
