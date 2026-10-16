/**
 * Express app for the Streamable HTTP transport, without `listen`.
 * main.ts listens on it (local, Heroku); api/index.js exports it (Vercel).
 */

import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import type { Request, Response } from "express";
import { MCP_PATH } from "./config.js";

// Stateless: a fresh server + transport per request, no session id.
export function createApp(createServer: () => McpServer) {
  const app = createMcpExpressApp({ host: "0.0.0.0" });
  app.use(cors());

  // Liveness probe. Confirms Express is serving, not just that the port is open.
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", transport: "http" });
  });

  app.post(MCP_PATH, async (req: Request, res: Response) => {
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

  // No standalone SSE stream: the SDK would hold a GET open forever even when
  // stateless, which pins a serverless function until it times out.
  app.all(MCP_PATH, (_req: Request, res: Response) => {
    res.set("Allow", "POST").status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed" },
      id: null,
    });
  });

  return app;
}
