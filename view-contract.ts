// Wire contract for the `structuredContent` payload crossing the server -> UI
// seam. Zod-first: the schemas are the single declaration of the shape; the TS
// types are inferred from them. server.ts types its results against the
// inferred types (compile-time enforcement on the write side); each view entry
// parses with its view's parser (runtime enforcement on the read side).
//
// Unknown keys are stripped (zod default) so an older UI bundle tolerates a
// newer server that added fields.
import { z } from "zod";

const CollectionViewSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  // Temporal coverage (YYYY-MM-DD, ends nullable = open) so the picker can
  // show it and the conversation can settle on a valid date range without
  // another tool call.
  temporal: z
    .object({ start: z.string().nullable(), end: z.string().nullable() })
    .nullable(),
  // The collection's `assets.thumbnail` cover image (thumbnails.openveda.cloud),
  // when present and browser-loadable.
  thumbnailHref: z.string().nullable(),
});

const ItemViewSchema = z.object({
  id: z.string(),
  start: z.string().nullable(),
  end: z.string().nullable(),
  previewHref: z.string().nullable(),
  cogHref: z.string().nullable(),
  bbox: z.array(z.number()).nullable(),
});

// Exported so server.ts can declare them as tool outputSchema (hosts may gate
// structuredContent delivery to the widget on a declared schema).
export const CollectionsViewSchema = z.object({
  kind: z.literal("collections"),
  collections: z.array(CollectionViewSchema),
});


export const ItemsViewSchema = z.object({
  kind: z.literal("items"),
  collectionId: z.string(),
  items: z.array(ItemViewSchema),
});

// One side of a compare map: everything the veda-ui-blocks raster layer needs
// (collectionId + the render key used as collectionAssetId + a date range).
const MapSideSchema = z.object({
  collectionId: z.string(),
  collectionTitle: z.string(),
  renderKey: z.string(),
  dateRange: z.object({ from: z.string(), to: z.string() }),
});

// A single-layer raster map of a collection over a date range. The API roots
// ride the wire so the UI (running in the host iframe) talks to the same
// catalog the server searched. bbox is the collection's spatial extent, used
// only for the initial camera — not an AOI filter.
export const MapViewSchema = z.object({
  kind: z.literal("map"),
  collectionId: z.string(),
  collectionTitle: z.string(),
  renderKey: z.string(),
  dateRange: z.object({ from: z.string(), to: z.string() }),
  bbox: z.array(z.number()).nullable(),
  stacRoot: z.string(),
  rasterRoot: z.string(),
  demo: z.boolean().optional(),
});

// A swipe-compare of two raster layers (same collection + two dates for a
// before/after, or two collections for a cross-dataset compare). The map
// resource renders both this and the single-layer variant, so the two share
// the same resource URI and are parsed by parseMapResourceView below. bbox is
// the LEFT side's extent, used only for the initial camera.
export const CompareViewSchema = z.object({
  kind: z.literal("compare"),
  left: MapSideSchema,
  right: MapSideSchema,
  bbox: z.array(z.number()).nullable(),
  stacRoot: z.string(),
  rasterRoot: z.string(),
});

export type CollectionView = z.infer<typeof CollectionViewSchema>;
export type ItemView = z.infer<typeof ItemViewSchema>;
export type CollectionsView = z.infer<typeof CollectionsViewSchema>;
export type ItemsView = z.infer<typeof ItemsViewSchema>;
export type MapView = z.infer<typeof MapViewSchema>;
export type CompareView = z.infer<typeof CompareViewSchema>;

// Union used by the server to type tool results at compile time. Each view
// entry only ever parses its own variant (the map resource parses both map and
// compare — see parseMapResourceView).
export type View = CollectionsView | ItemsView | MapView | CompareView;

// Parse a tool result's structuredContent against a view schema. Throws on a
// payload that doesn't match the contract so the UI surfaces the drift in its
// error banner instead of rendering an empty view.
function parseWith<T>(schema: z.ZodType<T>, structuredContent: unknown): T {
  const parsed = schema.safeParse(structuredContent);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? ` at ${issue.path.join(".")}` : "";
    throw new Error(
      `Unexpected result from server${where}: ${issue?.message ?? "invalid payload"}`,
    );
  }
  return parsed.data;
}

export function parseCollectionsView(structuredContent: unknown): CollectionsView {
  return parseWith(CollectionsViewSchema, structuredContent);
}

export function parseItemsView(structuredContent: unknown): ItemsView {
  return parseWith(ItemsViewSchema, structuredContent);
}

export function parseMapView(structuredContent: unknown): MapView {
  return parseWith(MapViewSchema, structuredContent);
}

// The map resource renders both the single-layer ("map") and compare variants,
// so the mount parses whichever it receives.
const MapResourceSchema = z.union([MapViewSchema, CompareViewSchema]);
export function parseMapResourceView(
  structuredContent: unknown,
): MapView | CompareView {
  return parseWith(MapResourceSchema, structuredContent);
}
