// Server-side client for the VEDA STAC API.
// No MCP deps so it stays unit-testable. Uses the global fetch (Node 18+).
import { z } from "zod";

export const STAC_ROOT =
  process.env.VEDA_STAC_ROOT ?? "https://dev.openveda.cloud/api/stac";

// titiler raster root serving item preview PNGs. Derived from the STAC root
// (same origin, /api/raster) unless VEDA_RASTER_ROOT is set.
export const RASTER_ROOT =
  process.env.VEDA_RASTER_ROOT ??
  STAC_ROOT.replace(/\/api\/stac\/?$/, "/api/raster");

// Origin of the raster host; the UI resource allowlists it via CSP for img-src.
export const RASTER_HOST = new URL(RASTER_ROOT).origin;

export interface CollectionSummary {
  id: string;
  title: string;
  description: string | null;
  // Temporal coverage dates (YYYY-MM-DD); ends null = open, whole field null =
  // no temporal extent declared.
  temporal: { start: string | null; end: string | null } | null;
  // Browser-loadable cover image from the collection's `assets.thumbnail`.
  thumbnailHref: string | null;
}

export interface ItemSummary {
  id: string;
  start: string | null;
  end: string | null;
  previewHref: string | null;
  cogHref: string | null;
  bbox: number[] | null;
}

export interface ListItemsOptions {
  limit?: number;
  bbox?: number[];
  datetime?: string;
}

// Only the fields we consume. `.passthrough()` keeps parsing lenient against
// the many optional STAC fields we ignore.
const AssetSchema = z.object({ href: z.string().optional() }).passthrough();

// title/description are nullish: the live catalog has collections with
// explicit `title: null`, which must not be dropped as malformed.
const CollectionSchema = z
  .object({
    id: z.string(),
    title: z.string().nullish(),
    description: z.string().nullish(),
    extent: z
      .object({
        temporal: z
          .object({ interval: z.array(z.array(z.string().nullable())).optional() })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .nullish(),
    assets: z
      .record(z.string(), AssetSchema)
      .nullish(),
  })
  .passthrough();

const CollectionsResponseSchema = z
  .object({
    collections: z.array(z.unknown()),
    links: z
      .array(z.object({ rel: z.string().optional(), href: z.string().optional() }).passthrough())
      .optional(),
  })
  .passthrough();

const ItemSchema = z
  .object({
    id: z.string(),
    bbox: z.array(z.number()).optional(),
    properties: z
      .object({
        datetime: z.string().nullable().optional(),
        start_datetime: z.string().optional(),
        end_datetime: z.string().optional(),
      })
      .passthrough()
      .optional(),
    assets: z.record(z.string(), AssetSchema).optional(),
  })
  .passthrough();

const ItemsResponseSchema = z
  .object({ features: z.array(z.unknown()) })
  .passthrough();

const CollectionMetaSchema = z
  .object({ renders: z.record(z.string(), z.unknown()).optional() })
  .passthrough();

const MapCollectionSchema = z
  .object({
    id: z.string(),
    title: z.string().nullish(),
    renders: z.record(z.string(), z.unknown()).optional(),
    extent: z
      .object({
        spatial: z
          .object({ bbox: z.array(z.array(z.number())).optional() })
          .passthrough()
          .optional(),
        temporal: z
          .object({ interval: z.array(z.array(z.string().nullable())).optional() })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

// A collection's render definition (subset of fields we use to style previews).
interface RenderParams {
  assets?: string[];
  bidx?: number[];
  rescale?: number[]; // [min, max]
  colormap_name?: string;
  color_formula?: string;
  resampling?: string;
}

// Per-collection cache of the dashboard render params used to style previews.
const renderCache = new Map<string, RenderParams | null>();

// TTL cache for the full collection list (avoids re-fetching ~545 collections
// on every search). Module-level; lives for the process lifetime.
const COLLECTIONS_TTL_MS = 60_000;
let collectionsCache: { at: number; items: ParsedCollection[] } | null = null;

interface ParsedCollection {
  id: string;
  title?: string | null;
  description?: string | null;
  extent?: {
    temporal?: { interval?: (string | null)[][] };
  } | null;
  assets?: Record<string, { href?: string }> | null;
}

// Only http(s) thumbnail hrefs are usable in the picker iframe.
function thumbnailFromAssets(
  assets: ParsedCollection["assets"],
): string | null {
  const href = assets?.thumbnail?.href;
  return href?.startsWith("http") ? href : null;
}

// First temporal interval as YYYY-MM-DD dates; null when absent.
function temporalFromExtent(
  extent: ParsedCollection["extent"],
): CollectionSummary["temporal"] {
  const interval = extent?.temporal?.interval?.[0];
  if (!interval) return null;
  const [start, end] = interval;
  return { start: start?.slice(0, 10) ?? null, end: end?.slice(0, 10) ?? null };
}

// Test-only: clear all caches.
export function _resetCaches(): void {
  renderCache.clear();
  collectionsCache = null;
}

// Fetch the collection metadata for its render params. Null results are cached
// (404, or a collection with no renders) so we don't refetch; transient errors
// (network failure, 5xx) return null for THIS call without caching, so the next
// call retries.
async function getDashboardRender(
  collectionId: string,
): Promise<RenderParams | null> {
  if (renderCache.has(collectionId)) {
    return renderCache.get(collectionId) ?? null;
  }
  let params: RenderParams | null = null;
  let cacheable = true;
  try {
    const data = CollectionMetaSchema.parse(
      await fetchJson(`${STAC_ROOT}/collections/${encodeURIComponent(collectionId)}`),
    );
    const renders = data.renders ?? {};
    const chosen =
      (renders.dashboard as RenderParams | undefined) ??
      (Object.values(renders)[0] as RenderParams | undefined);
    if (chosen) {
      const rescale = Array.isArray(chosen.rescale?.[0])
        ? (chosen.rescale as unknown as number[][])[0]
        : chosen.rescale;
      params = { ...chosen, rescale };
    }
  } catch (e) {
    params = null;
    const status = (e as { status?: number }).status;
    // Network failure (no status) or 5xx are transient — don't pin null.
    if (status === undefined || (typeof status === "number" && status >= 500)) {
      cacheable = false;
    }
  }
  if (cacheable) renderCache.set(collectionId, params);
  return params;
}

// Build a titiler preview URL for an item. The STAC `rendered_preview_dashboard`
// asset href is unreliable on this deployment, so we construct the preview from
// the raster API using the collection's dashboard render params. The render's
// named asset is used when the item actually exposes it; otherwise we fall back
// to `cog_default` (the default COG layer VEDA attaches to most items).
function buildPreviewUrl(
  collectionId: string,
  itemId: string,
  render: RenderParams | null,
  itemAssetKeys: string[],
): string {
  const renderAsset = render?.assets?.[0];
  const asset = renderAsset && itemAssetKeys.includes(renderAsset) ? renderAsset : "cog_default";
  const params = new URLSearchParams({ assets: asset });
  for (const b of render?.bidx ?? []) params.append("bidx", String(b));
  if (render?.rescale && render.rescale.length === 2) {
    params.set("rescale", `${render.rescale[0]},${render.rescale[1]}`);
  }
  if (render?.colormap_name) params.set("colormap_name", render.colormap_name);
  if (render?.color_formula) params.set("color_formula", render.color_formula);
  if (render?.resampling) params.set("resampling", render.resampling);
  return `${RASTER_ROOT}/collections/${encodeURIComponent(collectionId)}/items/${encodeURIComponent(itemId)}/preview.png?${params}`;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    const err = new Error(`STAC request failed (${res.status}) for ${url}: ${body}`);
    (err as { status?: number }).status = res.status;
    throw err;
  }
  return res.json();
}

// Validate each entry; skip (with a warning) rather than failing the whole call.
function parseEach<T>(
  entries: unknown[],
  schema: z.ZodType<T>,
  label: string,
): T[] {
  const out: T[] = [];
  for (const entry of entries) {
    const parsed = schema.safeParse(entry);
    if (parsed.success) {
      out.push(parsed.data);
    } else {
      console.warn(`Skipping malformed STAC ${label}:`, parsed.error.message);
    }
  }
  return out;
}

// Fetch every collection, following the `next` link until exhausted, with a
// TTL cache so repeated searches don't re-fetch the whole catalog.
async function fetchAllCollections(): Promise<ParsedCollection[]> {
  if (collectionsCache && Date.now() - collectionsCache.at < COLLECTIONS_TTL_MS) {
    return collectionsCache.items;
  }
  const out: ParsedCollection[] = [];
  let url: string | undefined = `${STAC_ROOT}/collections?limit=500`;
  while (url) {
    const data = CollectionsResponseSchema.parse(await fetchJson(url));
    out.push(...parseEach(data.collections, CollectionSchema, "collection"));
    url = data.links?.find((l) => l.rel === "next" && l.href)?.href;
  }
  collectionsCache = { at: Date.now(), items: out };
  return out;
}

// The STAC /collections endpoint has no free-text search, so we fetch the list
// (cached) and filter client-side by substring on id/title/description.
export async function searchCollections(
  query?: string,
  limit = 10,
): Promise<CollectionSummary[]> {
  const parsed = await fetchAllCollections();

  const q = query?.trim().toLowerCase();
  const matched = q
    ? parsed.filter((c) =>
        [c.id, c.title, c.description]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q)),
      )
    : parsed;

  return matched.slice(0, limit).map((c) => ({
    id: c.id,
    title: c.title ?? c.id,
    description: c.description ?? null,
    temporal: temporalFromExtent(c.extent),
    thumbnailHref: thumbnailFromAssets(c.assets),
  }));
}

// Everything the map view needs to render a collection as a raster layer.
export interface MapConfig {
  collectionId: string;
  collectionTitle: string;
  renderKey: string;
  dateRange: { from: string; to: string };
  bbox: number[] | null;
}

// Thrown when a map cannot be configured for reasons the caller can correct
// (unknown collection, no renders, dates outside the temporal extent). The
// message is written for the calling agent to self-correct on.
export class MapConfigError extends Error {}

const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

// Accepts "YYYY-MM-DD" or "YYYY-MM-DD/YYYY-MM-DD" (full ISO datetimes are
// truncated to the date). A single date means from == to.
function parseDateInterval(datetime: string): { from: string; to: string } {
  const parts = datetime.split("/");
  if (parts.length > 2 || parts.some((p) => !DATE_RE.test(p.trim()))) {
    throw new MapConfigError(
      `Invalid datetime "${datetime}": use "YYYY-MM-DD" or "YYYY-MM-DD/YYYY-MM-DD".`,
    );
  }
  const dates = parts.map((p) => p.trim().slice(0, 10));
  const [from, to = dates[0]] = dates;
  if (from > to) {
    throw new MapConfigError(`Invalid datetime "${datetime}": start is after end.`);
  }
  return { from, to };
}

// Guard against the two systematic ways a collection's `renders` metadata
// breaks the map component (which forwards render params to titiler verbatim):
// object-valued params that aren't JSON-serializable to a titiler-recognized
// field 500 the tilejson request. `colormap` (a categorical {class: [r,g,b,a]}
// map, e.g. land-cover classes) IS supported — the widget JSON-stringifies
// object values — so it's allowed through; other object params (e.g.
// `asset_bidx`) still aren't, so we fail fast. A render `assets` name absent
// from the actual items (stale metadata, e.g. no2-monthly declares "no2" but
// items only carry "cog_default") 500s every tile. Both errors are masked by
// CloudFront as the STAC Browser page, so failing fast here with a corrective
// message is the only useful signal. The item probe is best-effort: on fetch
// failure the check is skipped rather than blocking the map.
async function assertRenderIsMappable(
  collectionId: string,
  renderKey: string,
  render: unknown,
): Promise<void> {
  const params = (render ?? {}) as Record<string, unknown>;
  // Object params the widget can JSON-encode for titiler. Add more as their
  // titiler support is verified.
  const SERIALIZABLE_OBJECT_PARAMS = new Set(["colormap"]);
  const objectParam = Object.entries(params).find(
    ([k, v]) =>
      !SERIALIZABLE_OBJECT_PARAMS.has(k) &&
      v !== null &&
      typeof v === "object" &&
      !Array.isArray(v),
  );
  if (objectParam) {
    throw new MapConfigError(
      `Collection "${collectionId}" render "${renderKey}" uses the "${objectParam[0]}" parameter, which the map cannot forward to the tile API. Pick a different collection.`,
    );
  }
  const renderAssets = Array.isArray(params.assets)
    ? params.assets.filter((a): a is string => typeof a === "string")
    : [];
  if (renderAssets.length === 0) return;
  let itemAssetKeys: string[];
  try {
    const data = ItemsResponseSchema.parse(
      await fetchJson(
        `${STAC_ROOT}/collections/${encodeURIComponent(collectionId)}/items?limit=1`,
      ),
    );
    const item = parseEach(data.features, ItemSchema, "item")[0];
    if (!item) return;
    itemAssetKeys = Object.keys(item.assets ?? {});
  } catch {
    return;
  }
  if (!renderAssets.some((a) => itemAssetKeys.includes(a))) {
    throw new MapConfigError(
      `Collection "${collectionId}" cannot be mapped: its render expects asset "${renderAssets[0]}" but items only expose ${itemAssetKeys.join(", ") || "no assets"}. Pick a different collection (use search_collections).`,
    );
  }
}

// Resolve a collection into map-layer config: render key (styling lives in the
// collection's `renders`, read by the map component itself), the requested
// date range clamped to the collection's temporal extent, and the spatial
// extent for the initial camera.
export async function getMapConfig(
  collectionId: string,
  datetime: string,
): Promise<MapConfig> {
  const range = parseDateInterval(datetime);

  // A 404, a non-JSON body (this deployment's CDN answers unknown ids with
  // the STAC Browser page and status 200) or a non-collection shape all mean
  // the id is unusable.
  let collection: z.infer<typeof MapCollectionSchema>;
  try {
    collection = MapCollectionSchema.parse(
      await fetchJson(`${STAC_ROOT}/collections/${encodeURIComponent(collectionId)}`),
    );
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 404 || e instanceof SyntaxError || e instanceof z.ZodError) {
      throw new MapConfigError(
        `Unknown collection "${collectionId}". Use search_collections to find a valid collection id.`,
      );
    }
    throw e;
  }

  const renderKeys = Object.keys(collection.renders ?? {});
  const renderKey = renderKeys.includes("dashboard") ? "dashboard" : renderKeys[0];
  if (!renderKey) {
    throw new MapConfigError(
      `Collection "${collectionId}" has no map rendering (no "renders" metadata). Pick a different collection.`,
    );
  }
  await assertRenderIsMappable(collectionId, renderKey, collection.renders?.[renderKey]);

  // Clamp to the temporal extent (dates only; interval bounds may be null =
  // open-ended). Fully outside -> error naming the valid interval.
  const [extStart, extEnd] = collection.extent?.temporal?.interval?.[0] ?? [];
  const min = extStart ? extStart.slice(0, 10) : null;
  const max = extEnd ? extEnd.slice(0, 10) : null;
  if ((max && range.from > max) || (min && range.to < min)) {
    throw new MapConfigError(
      `Collection "${collectionId}" has no data for ${range.from}/${range.to}: its temporal extent is ${min ?? "open"}/${max ?? "open"}.`,
    );
  }
  const from = min && range.from < min ? min : range.from;
  const to = max && range.to > max ? max : range.to;

  return {
    collectionId,
    collectionTitle: collection.title ?? collectionId,
    renderKey,
    dateRange: { from, to },
    bbox: collection.extent?.spatial?.bbox?.[0] ?? null,
  };
}

export async function listItems(
  collectionId: string,
  { limit = 6, bbox, datetime }: ListItemsOptions = {},
): Promise<ItemSummary[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (bbox?.length) params.set("bbox", bbox.join(","));
  if (datetime) params.set("datetime", datetime);

  const data = await fetchJson(
    `${STAC_ROOT}/collections/${encodeURIComponent(collectionId)}/items?${params}`,
  );
  const { features } = ItemsResponseSchema.parse(data);
  const parsed = parseEach(features, ItemSchema, "item");
  const render = await getDashboardRender(collectionId);

  return parsed.map((item) => {
    const props = item.properties ?? {};
    const assetKeys = Object.keys(item.assets ?? {});
    return {
      id: item.id,
      start: props.start_datetime ?? props.datetime ?? null,
      end: props.end_datetime ?? props.datetime ?? null,
      previewHref: buildPreviewUrl(collectionId, item.id, render, assetKeys),
      cogHref: item.assets?.cog_default?.href ?? null,
      bbox: item.bbox ?? null,
    };
  });
}
