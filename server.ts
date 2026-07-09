import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";

// Works both from source (server.ts) and compiled (dist/server.js)
const DIST_DIR = import.meta.filename.endsWith(".ts")
  ? path.join(import.meta.dirname, "dist")
  : import.meta.dirname;

// Placeholder data standing in for a future VEDA STAC catalog search.
// Replace with a real STAC query in a later iteration.
const MOCK_COLLECTIONS = [
  { id: "no2-monthly", title: "Nitrogen Dioxide (NO2) - Monthly" },
  { id: "nightlights-hd-monthly", title: "Black Marble High Definition Nightlights Monthly" },
  { id: "hls-swir-falsecolor-composite", title: "HLS SWIR FalseColor Composite" },
];

export function createServer(): McpServer {
  const server = new McpServer({
    name: "VEDA MCP App",
    version: "0.1.0",
  });

  // Tool + resource are tied together by this URI (the tool's `_meta.ui`
  // points the host at the resource to render).
  const resourceUri = "ui://veda-mcp-app/main";

  registerAppTool(server,
    "veda_catalog_hello",
    {
      title: "VEDA Catalog (placeholder)",
      description: "Scaffold placeholder. Returns a static list of mock VEDA STAC collections. Will be replaced by a real STAC catalog search.",
      inputSchema: {},
      _meta: { ui: { resourceUri } }, // Links this tool to its UI resource
    },
    async (): Promise<CallToolResult> => {
      const structuredContent = { collections: MOCK_COLLECTIONS };
      const text = MOCK_COLLECTIONS.map((c) => `- ${c.id}: ${c.title}`).join("\n");
      // `content` is the text fallback for non-UI hosts; the UI reads
      // `structuredContent` to render the list.
      return {
        content: [{ type: "text", text: `Mock VEDA STAC collections:\n${text}` }],
        structuredContent,
      };
    },
  );

  // Serves the bundled single-file UI.
  registerAppResource(server,
    resourceUri,
    resourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.readFile(path.join(DIST_DIR, "mcp-app.html"), "utf-8");
      return {
        contents: [{ uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
      };
    },
  );

  return server;
}
