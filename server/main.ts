#!/usr/bin/env node
/**
 * Entry point for running the MCP server.
 * Run compiled: node dist/server/main.js [--stdio]
 * Or from source: tsx server/main.ts [--stdio]
 * Pass --stdio for stdio transport (used by Claude Desktop); otherwise HTTP.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createApp } from "./app.js";
import { MCP_PATH, RASTER_ROOT, STAC_ROOT, validateConfig } from "./config.js";
import { createServer } from "./server.js";

// Streamable HTTP transport as a long-lived process (local, Heroku).
export async function startStreamableHTTPServer(
  createServer: () => McpServer,
): Promise<void> {
  const port = parseInt(process.env.PORT ?? "3001", 10);

  const httpServer = createApp(createServer).listen(port, (err) => {
    if (err) {
      console.error("Failed to start server:", err);
      process.exit(1);
    }
    console.log("VEDA UI MCP (HTTP transport)");
    console.log(`  port:        ${port}`);
    console.log(`  stac root:   ${STAC_ROOT}`);
    console.log(`  raster root: ${RASTER_ROOT}`);
    console.log(`  endpoints:   http://localhost:${port}${MCP_PATH} (POST, MCP)`);
    console.log(`               http://localhost:${port}/health (GET, liveness)`);
  });

  const shutdown = () => {
    console.log("\nShutting down...");
    httpServer.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// Stdio transport (used by Claude Desktop / Claude Code).
export async function startStdioServer(
  createServer: () => McpServer,
): Promise<void> {
  await createServer().connect(new StdioServerTransport());
}

async function main() {
  validateConfig();
  if (process.argv.includes("--stdio")) {
    await startStdioServer(createServer);
  } else {
    await startStreamableHTTPServer(createServer);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
