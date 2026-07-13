#!/usr/bin/env node
/**
 * Entry point for running the MCP server.
 * Run compiled: node dist/server/main.js [--stdio]
 * Or from source: tsx server/main.ts [--stdio]
 * Pass --stdio for stdio transport (used by Claude Desktop); otherwise HTTP.
 */

import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import type { Request, Response } from "express";
import { RASTER_ROOT, STAC_ROOT, validateConfig } from "./config.js";
import { createServer } from "./server.js";

// Streamable HTTP transport (stateless: a fresh server per request).
export async function startStreamableHTTPServer(
  createServer: () => McpServer,
): Promise<void> {
  const port = parseInt(process.env.PORT ?? "3001", 10);

  // Optional shared-secret path segment: with MCP_PATH_TOKEN=abc the endpoint
  // becomes /mcp/abc, so only people given the full URL can reach the server.
  const pathToken = process.env.MCP_PATH_TOKEN;
  const mcpPath = pathToken ? `/mcp/${pathToken}` : "/mcp";

  const app = createMcpExpressApp({ host: "0.0.0.0" });
  app.use(cors());

  // Liveness probe (e.g. Railway healthcheck). Confirms Express is serving, not
  // just that the port is open.
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", transport: "http" });
  });

  app.all(mcpPath, async (req: Request, res: Response) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("MCP error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  const httpServer = app.listen(port, (err) => {
    if (err) {
      console.error("Failed to start server:", err);
      process.exit(1);
    }
    console.log("VEDA MCP App (HTTP transport)");
    console.log(`  port:        ${port}`);
    console.log(`  stac root:   ${STAC_ROOT}`);
    console.log(`  raster root: ${RASTER_ROOT}`);
    console.log(`  endpoints:   http://localhost:${port}${mcpPath} (POST, MCP)`);
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
