import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  getMapConfig,
  listItems,
  MapConfigError,
  RASTER_HOST,
  RASTER_ROOT,
  searchCollections,
  STAC_ROOT,
  type CollectionSummary,
  type ItemSummary,
} from "./stac.js";
import {
  CollectionsViewSchema,
  CompareViewSchema,
  encodeViewResult,
  ItemsViewSchema,
  MapViewSchema,
  type View,
} from "./view-contract.js";

// One resource per step view; each tool's `_meta.ui.resourceUri` picks the
// view the host renders inline for that tool's result.
const PICKER_URI = "ui://veda-mcp-app/picker";
const ITEMS_URI = "ui://veda-mcp-app/items";
const MAP_URI = "ui://veda-mcp-app/map";

// Origins the map iframe fetches from at runtime: the STAC/raster APIs (map
// layer + tiles) and the Carto basemap (style.json on the apex host;
// tiles.json/sprite/glyphs on the tiles host; vector tiles sharded over
// tiles-a..tiles-d).
const MAP_CONNECT_DOMAINS = [
  ...new Set([new URL(STAC_ROOT).origin, RASTER_HOST]),
  "https://basemaps.cartocdn.com",
  "https://tiles.basemaps.cartocdn.com",
  "https://tiles-a.basemaps.cartocdn.com",
  "https://tiles-b.basemaps.cartocdn.com",
  "https://tiles-c.basemaps.cartocdn.com",
  "https://tiles-d.basemaps.cartocdn.com",
];

// Works both from source (server.ts) and compiled (dist/server.js)
const DIST_DIR = import.meta.filename.endsWith(".ts")
  ? path.join(import.meta.dirname, "dist")
  : import.meta.dirname;

// Demo dataset: an NO2 collection whose renders metadata is consistent with
// its items, so the veda-ui-blocks map can actually tile it ("no2-monthly"
// declares a "no2" asset its items don't have — see getMapConfig's guard).
const DEMO_COLLECTION = "no2-monthly-diff";

function coverage(c: CollectionSummary): string {
  if (!c.temporal) return "";
  return ` (${c.temporal.start ?? "open"} to ${c.temporal.end ?? "open"})`;
}

function collectionsResult(collections: CollectionSummary[]): CallToolResult {
  const text = collections.length
    ? collections.map((c) => `- ${c.id}: ${c.title}${coverage(c)}`).join("\n") +
      "\n\nThe user can click a collection card to pick a dataset."
    : "No matching collections.";
  return encodeViewResult(`VEDA STAC collections:\n${text}`, {
    kind: "collections",
    collections,
  });
}

function itemsResult(collectionId: string, items: ItemSummary[]): CallToolResult {
  const text = items.length
    ? items.map((i) => `- ${i.id} (${i.start ?? "?"} to ${i.end ?? "?"})`).join("\n")
    : "No items found.";
  return encodeViewResult(`Items in ${collectionId}:\n${text}`, {
    kind: "items",
    collectionId,
    items,
  });
}

async function mapResult(
  collectionId: string,
  datetime: string,
  demo = false,
): Promise<CallToolResult> {
  let config;
  try {
    config = await getMapConfig(collectionId, datetime);
  } catch (e) {
    if (e instanceof MapConfigError) {
      return { content: [{ type: "text", text: e.message }], isError: true };
    }
    throw e;
  }
  const view: View = {
    kind: "map",
    ...config,
    stacRoot: STAC_ROOT,
    rasterRoot: RASTER_ROOT,
    demo,
  };
  return encodeViewResult(
    `Map of ${config.collectionTitle} (${config.collectionId}), ${config.dateRange.from} to ${config.dateRange.to}.`,
    view,
  );
}

// Resolve each side with the same getMapConfig the single-layer map uses; the
// two calls are independent so they run in parallel. A MapConfigError on either
// side surfaces that side's corrective message — the agent only fixes the bad
// side. bbox comes from the left side for the initial camera.
async function compareResult(
  leftCollectionId: string,
  leftDatetime: string,
  rightCollectionId: string,
  rightDatetime: string,
): Promise<CallToolResult> {
  let left, right;
  try {
    [left, right] = await Promise.all([
      getMapConfig(leftCollectionId, leftDatetime),
      getMapConfig(rightCollectionId, rightDatetime),
    ]);
  } catch (e) {
    if (e instanceof MapConfigError) {
      return { content: [{ type: "text", text: e.message }], isError: true };
    }
    throw e;
  }
  const view: View = {
    kind: "compare",
    left: {
      collectionId: left.collectionId,
      collectionTitle: left.collectionTitle,
      renderKey: left.renderKey,
      dateRange: left.dateRange,
    },
    right: {
      collectionId: right.collectionId,
      collectionTitle: right.collectionTitle,
      renderKey: right.renderKey,
      dateRange: right.dateRange,
    },
    bbox: left.bbox,
    stacRoot: STAC_ROOT,
    rasterRoot: RASTER_ROOT,
  };
  return encodeViewResult(
    `Comparing ${left.collectionTitle} (${left.dateRange.from}–${left.dateRange.to}) vs ${right.collectionTitle} (${right.dateRange.from}–${right.dateRange.to}).`,
    view,
  );
}

// Subset of McpUiResourceCsp we use (the type isn't re-exported from the
// package's /server subpath under node16 resolution).
interface ViewCsp {
  resourceDomains?: string[];
  connectDomains?: string[];
}

// Serve a bundled single-file view. The content item's `_meta.ui.csp` is
// scoped to what that view actually loads.
function registerViewResource(
  server: McpServer,
  uri: string,
  htmlFile: string,
  csp?: ViewCsp,
): void {
  registerAppResource(server,
    uri,
    uri,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.readFile(path.join(DIST_DIR, htmlFile), "utf-8");
      return {
        contents: [{
          uri,
          mimeType: RESOURCE_MIME_TYPE,
          text: html,
          ...(csp ? { _meta: { ui: { csp } } } : {}),
        }],
      };
    },
  );
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "VEDA MCP App",
    version: "0.1.0",
  });

  registerAppTool(server,
    "search_collections",
    {
      title: "Search VEDA collections",
      description:
        "Search the VEDA STAC catalog for collections (datasets). Optional case-insensitive substring query over id/title/description; empty query lists collections. Renders a picker: the user can click a collection card to announce their pick in the chat.",
      inputSchema: {
        query: z.string().optional().describe("Substring to match against collection id/title/description"),
        limit: z.number().int().min(1).max(50).optional().describe("Max collections to return (default 10)"),
      },
      outputSchema: CollectionsViewSchema.shape,
      _meta: { ui: { resourceUri: PICKER_URI } },
    },
    async ({ query, limit }): Promise<CallToolResult> => {
      const collections = await searchCollections(query, limit);
      return collectionsResult(collections);
    },
  );

  registerAppTool(server,
    "list_items",
    {
      title: "List collection items",
      description:
        "List items (dated scenes) in a VEDA STAC collection. Each item carries a raster preview and a COG asset. Optionally filter by bbox and datetime range.",
      inputSchema: {
        collectionId: z.string().describe("STAC collection id, e.g. no2-monthly"),
        limit: z.number().int().min(1).max(50).optional().describe("Max items to return (default 6)"),
        bbox: z.array(z.number()).length(4).optional().describe("[west, south, east, north]"),
        datetime: z.string().optional().describe("ISO-8601 datetime or range 'start/end'"),
      },
      outputSchema: ItemsViewSchema.shape,
      _meta: { ui: { resourceUri: ITEMS_URI } },
    },
    async ({ collectionId, limit, bbox, datetime }): Promise<CallToolResult> => {
      const items = await listItems(collectionId, { limit, bbox, datetime });
      return itemsResult(collectionId, items);
    },
  );

  registerAppTool(server,
    "show_map",
    {
      title: "Show collection map",
      description:
        "Render an interactive single-layer raster map of a VEDA STAC collection over a date range. Resolve the collection id with search_collections first when the user names a phenomenon (e.g. \"NO2\" -> no2-monthly).",
      inputSchema: {
        collectionId: z.string().describe("STAC collection id, e.g. no2-monthly"),
        datetime: z.string().describe('Date or range: "YYYY-MM-DD" or "YYYY-MM-DD/YYYY-MM-DD"'),
      },
      outputSchema: MapViewSchema.shape,
      _meta: { ui: { resourceUri: MAP_URI } },
    },
    async ({ collectionId, datetime }): Promise<CallToolResult> =>
      mapResult(collectionId, datetime),
  );

  registerAppTool(server,
    "run_demo",
    {
      title: "Run VEDA MCP app demo",
      description:
        `Run a demo of the VEDA MCP app: renders an interactive map of the "${DEMO_COLLECTION}" (Nitrogen Dioxide difference) collection for 2020-2021. Use when asked to "run a demo".`,
      inputSchema: {},
      outputSchema: MapViewSchema.shape,
      _meta: { ui: { resourceUri: MAP_URI } },
    },
    async (): Promise<CallToolResult> =>
      mapResult(DEMO_COLLECTION, "2020-01-01/2021-12-31", true),
  );

  registerAppTool(server,
    "compare_map",
    {
      title: "Compare two collection maps",
      description:
        'Render a swipe-compare of two raster layers side by side. Pass the SAME collectionId with two date ranges for a before/after (e.g. NO2 in 2020 vs 2021), or two different collectionIds for a cross-dataset comparison. Resolve collection ids with search_collections first when the user names a phenomenon (e.g. "NO2" -> no2-monthly).',
      inputSchema: {
        leftCollectionId: z.string().describe("STAC collection id for the left panel"),
        leftDatetime: z.string().describe('Left panel date or range: "YYYY-MM-DD" or "YYYY-MM-DD/YYYY-MM-DD"'),
        rightCollectionId: z.string().describe("STAC collection id for the right panel"),
        rightDatetime: z.string().describe('Right panel date or range: "YYYY-MM-DD" or "YYYY-MM-DD/YYYY-MM-DD"'),
      },
      outputSchema: CompareViewSchema.shape,
      _meta: { ui: { resourceUri: MAP_URI } },
    },
    async ({ leftCollectionId, leftDatetime, rightCollectionId, rightDatetime }): Promise<CallToolResult> =>
      compareResult(leftCollectionId, leftDatetime, rightCollectionId, rightDatetime),
  );

  // Picker cards load collection cover thumbnails (img-src).
  registerViewResource(server, PICKER_URI, "picker.html", {
    resourceDomains: ["https://thumbnails.openveda.cloud"],
  });
  // Items view loads raster preview thumbnails (img-src).
  registerViewResource(server, ITEMS_URI, "items.html", {
    resourceDomains: [RASTER_HOST],
  });
  // Map view fetches the APIs + basemap (connect-src) and tile images.
  registerViewResource(server, MAP_URI, "map.html", {
    resourceDomains: [RASTER_HOST, "https://tiles.basemaps.cartocdn.com"],
    connectDomains: MAP_CONNECT_DOMAINS,
  });

  return server;
}
