// Dashboard Render resolution (see CONTEXT.md): turn a collection's `renders`
// metadata into map-layer config, guarding against the render params that
// break the map component. Split from the STAC client so the mappability
// rules live in one place.
import { z } from "zod";
import {
  fetchJson,
  ItemSchema,
  ItemsResponseSchema,
  parseEach,
  STAC_ROOT,
} from "./stac.js";

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
