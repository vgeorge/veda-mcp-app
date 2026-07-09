import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  listItems,
  RASTER_HOST,
  searchCollections,
  type CollectionSummary,
  type ItemSummary,
} from "./stac.js";

// Works both from source (server.ts) and compiled (dist/server.js)
const DIST_DIR = import.meta.filename.endsWith(".ts")
  ? path.join(import.meta.dirname, "dist")
  : import.meta.dirname;

const DEMO_COLLECTION = "no2-monthly";

function collectionsResult(collections: CollectionSummary[]): CallToolResult {
  const text = collections.length
    ? collections.map((c) => `- ${c.id}: ${c.title}`).join("\n")
    : "No matching collections.";
  return {
    content: [{ type: "text", text: `VEDA STAC collections:\n${text}` }],
    structuredContent: { kind: "collections", collections },
  };
}

function itemsResult(
  collectionId: string,
  items: ItemSummary[],
  demo = false,
): CallToolResult {
  const text = items.length
    ? items.map((i) => `- ${i.id} (${i.start ?? "?"} to ${i.end ?? "?"})`).join("\n")
    : "No items found.";
  return {
    content: [{ type: "text", text: `Items in ${collectionId}:\n${text}` }],
    structuredContent: { kind: "items", collectionId, demo, items },
  };
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "VEDA MCP App",
    version: "0.1.0",
  });

  // Tools and resource are tied together by this URI (each tool's `_meta.ui`
  // points the host at the resource to render).
  const resourceUri = "ui://veda-mcp-app/main";

  registerAppTool(server,
    "search_collections",
    {
      title: "Search VEDA collections",
      description:
        "Search the VEDA STAC catalog for collections (datasets). Optional case-insensitive substring query over id/title/description; empty query lists collections.",
      inputSchema: {
        query: z.string().optional().describe("Substring to match against collection id/title/description"),
        limit: z.number().int().min(1).max(50).optional().describe("Max collections to return (default 10)"),
      },
      _meta: { ui: { resourceUri } },
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
      _meta: { ui: { resourceUri } },
    },
    async ({ collectionId, limit, bbox, datetime }): Promise<CallToolResult> => {
      const items = await listItems(collectionId, { limit, bbox, datetime });
      return itemsResult(collectionId, items);
    },
  );

  registerAppTool(server,
    "run_demo",
    {
      title: "Run VEDA MCP app demo",
      description:
        `Run a demo of the VEDA MCP app: fetches recent items from the "${DEMO_COLLECTION}" (Nitrogen Dioxide) collection and renders them with raster previews. Use when asked to "run a demo".`,
      inputSchema: {},
      _meta: { ui: { resourceUri } },
    },
    async (): Promise<CallToolResult> => {
      const items = await listItems(DEMO_COLLECTION, { limit: 6 });
      return itemsResult(DEMO_COLLECTION, items, true);
    },
  );

  // Serves the bundled single-file UI. The content item's `_meta.ui.csp`
  // allowlists the raster host so item preview images can load.
  registerAppResource(server,
    resourceUri,
    resourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.readFile(path.join(DIST_DIR, "mcp-app.html"), "utf-8");
      return {
        contents: [{
          uri: resourceUri,
          mimeType: RESOURCE_MIME_TYPE,
          text: html,
          _meta: { ui: { csp: { resourceDomains: [RASTER_HOST] } } },
        }],
      };
    },
  );

  return server;
}
