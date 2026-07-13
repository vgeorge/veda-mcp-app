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

// Exported so server.ts can declare them as tool outputSchema (hosts may gate
// structuredContent delivery to the widget on a declared schema).
export const CollectionsViewSchema = z.object({
  kind: z.literal("collections"),
  collections: z.array(CollectionViewSchema),
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
export type CollectionsView = z.infer<typeof CollectionsViewSchema>;
export type MapView = z.infer<typeof MapViewSchema>;
export type CompareView = z.infer<typeof CompareViewSchema>;

// Union used by the server to type tool results at compile time. Each view
// entry only ever parses its own variant (the map resource parses both map and
// compare — see parseMapResourceView).
export type View = CollectionsView | MapView | CompareView;

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

// ---------------------------------------------------------------------------
// Wire carriage: how a View travels inside a tool result. Encode and decode
// live together so the host-compat invariant below is declared (and tested)
// in one place.

// Structural subset of the SDK's CallToolResult, declared here so the UI
// bundles never import the server SDK.
export interface WireToolResult {
  isError?: boolean;
  structuredContent?: unknown;
  content?: { type: string; text?: string }[];
}

// Build a tool result carrying the view both as structuredContent (the channel
// conformant hosts like basic-host deliver to the widget) AND as a JSON text
// content block. Claude Desktop strips structuredContent before handing the
// result to the widget sandbox and substitutes a placeholder text block, but
// it passes content text blocks through intact — so the widget recovers the
// view by JSON-parsing the text blocks (see recoverView). The model also sees
// this JSON block, which is acceptable.
export function encodeViewResult(humanText: string, view: View) {
  return {
    content: [
      { type: "text" as const, text: humanText },
      { type: "text" as const, text: JSON.stringify(view) },
    ],
    structuredContent: view,
  };
}

export type RecoveredView<T> =
  | { view: T; error?: undefined }
  | { view?: undefined; error: string };

// Recover the view from a tool result as delivered by the host: try
// structuredContent, then JSON-parse text blocks (the Claude Desktop path).
// A result with no recoverable view yields the tool's error text (or a
// generic message) for the UI error banner.
export function recoverView<T>(
  result: WireToolResult,
  parse: (structuredContent: unknown) => T,
): RecoveredView<T> {
  if (result.structuredContent === undefined) {
    for (const block of result.content ?? []) {
      if (block.type !== "text" || block.text === undefined) continue;
      try {
        return { view: parse(JSON.parse(block.text)) };
      } catch {
        // Not this block — keep looking.
      }
    }
    const text = result.content?.find((c) => c.type === "text")?.text;
    return {
      error: result.isError
        ? (text ?? "The tool call failed.")
        : "The server returned no view data.",
    };
  }
  try {
    return { view: parse(result.structuredContent) };
  } catch (e) {
    console.error(e);
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
