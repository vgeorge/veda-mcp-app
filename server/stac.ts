// Server-side client for the VEDA STAC API: collection fetch/cache/search,
// plus the fetch/parse plumbing dashboard-render shares.
// No MCP deps so it stays unit-testable. Uses the global fetch (Node 18+).
import { z } from "zod";
import { STAC_ROOT } from "./config.js";

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

// `extent.temporal` as STAC declares it: a list of [start, end] intervals,
// either end nullable (= open).
export const TemporalExtentSchema = z
  .object({ interval: z.array(z.array(z.string().nullable())).optional() })
  .passthrough();

// First temporal interval as YYYY-MM-DD dates; null when absent.
export function firstDateInterval(
  extent:
    | { temporal?: { interval?: (string | null)[][] } }
    | null
    | undefined,
): CollectionSummary["temporal"] {
  const interval = extent?.temporal?.interval?.[0];
  if (!interval) return null;
  const [start, end] = interval;
  return { start: start?.slice(0, 10) ?? null, end: end?.slice(0, 10) ?? null };
}

// title/description are nullish: the live catalog has collections with
// explicit `title: null`, which must not be dropped as malformed.
const CollectionSchema = z
  .object({
    id: z.string(),
    title: z.string().nullish(),
    description: z.string().nullish(),
    extent: z
      .object({ temporal: TemporalExtentSchema.optional() })
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

// Test-only: clear all caches.
export function _resetCaches(): void {
  collectionsCache = null;
}

// A non-ok STAC response, carrying the HTTP status for callers that branch on
// it (getMapConfig treats 404 as "unknown collection").
export class StacHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    throw new StacHttpError(
      `STAC request failed (${res.status}) for ${url}: ${body}`,
      res.status,
    );
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
    temporal: firstDateInterval(c.extent),
    thumbnailHref: thumbnailFromAssets(c.assets),
  }));
}
