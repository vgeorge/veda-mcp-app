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

export const ItemSchema = z
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

export const ItemsResponseSchema = z
  .object({ features: z.array(z.unknown()) })
  .passthrough();

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
  collectionsCache = null;
}

export async function fetchJson(url: string): Promise<unknown> {
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
export function parseEach<T>(
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

