// Adapters mapping view-contract types onto veda-ui-blocks cards.
import { CardDetailed, Tag } from "@teamimpact/veda-ui-blocks";
import type { SyntheticEvent } from "react";
import type { CollectionView, ItemView } from "../view-contract";
import styles from "./mcp-app.module.css";

function coverageLine(c: {
  temporal: { start: string | null; end: string | null } | null;
}): string | null {
  if (!c.temporal) return null;
  return `${c.temporal.start ?? "open"} – ${c.temporal.end ?? "open"}`;
}

// Deterministic hue per id so every card has a stable, distinct accent — used
// for the placeholder tile when a collection has no (usable) thumbnail.
function hueFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

// Tinted "globe" tile shown when no thumbnail loads. Catalog thumbnails are
// sparse (most collections have none) and item previews are unreliable, so
// this designed placeholder replaces the broken-image / flat-gray state.
function placeholderDataUri(hue: number): string {
  const bg = `hsl(${hue}, 50%, 90%)`;
  const fg = `hsl(${hue}, 40%, 50%)`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 18" preserveAspectRatio="xMidYMid slice">` +
    `<rect width="32" height="18" fill="${bg}"/>` +
    `<g fill="none" stroke="${fg}" stroke-width="0.6">` +
    `<circle cx="16" cy="9" r="4.5"/>` +
    `<ellipse cx="16" cy="9" rx="4.5" ry="2"/>` +
    `<ellipse cx="16" cy="9" rx="2" ry="4.5"/>` +
    `<line x1="11.5" y1="9" x2="20.5" y2="9"/>` +
    `</g></svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

// Always an <img>: a real thumbnail when we have one, else the tinted globe.
// onError swaps a 404ing thumbnail for the same globe so cards never show a
// broken-image icon.
function cardMedia(id: string, href: string | null | undefined) {
  const fallback = placeholderDataUri(hueFromId(id));
  const onError = (e: SyntheticEvent<HTMLImageElement>) => {
    if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
  };
  return <img src={href ?? fallback} alt="" loading="lazy" onError={onError} />;
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
      image={cardMedia(collection.id, collection.thumbnailHref)}
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
      image={cardMedia(item.id, item.previewHref)}
      title={item.id}
      description={`${item.start ?? "?"} → ${item.end ?? "?"}`}
    />
  );
}
