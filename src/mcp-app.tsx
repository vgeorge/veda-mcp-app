// Scaffold UI: renders the placeholder collection list from `veda_catalog_hello`.
import type { App, McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import styles from "./mcp-app.module.css";

interface Collection {
  id: string;
  title: string;
}

function extractCollections(result: CallToolResult): Collection[] {
  const structured = result.structuredContent as { collections?: Collection[] } | undefined;
  return structured?.collections ?? [];
}

function VedaCatalogApp() {
  const [toolResult, setToolResult] = useState<CallToolResult | null>(null);
  const [hostContext, setHostContext] = useState<McpUiHostContext | undefined>();

  const { app, error } = useApp({
    appInfo: { name: "VEDA MCP App", version: "0.1.0" },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolresult = async (result) => setToolResult(result);
      app.onerror = console.error;
      app.onhostcontextchanged = (params) => {
        setHostContext((prev) => ({ ...prev, ...params }));
      };
    },
  });

  useEffect(() => {
    if (app) {
      setHostContext(app.getHostContext());
    }
  }, [app]);

  if (error) return <div><strong>ERROR:</strong> {error.message}</div>;
  if (!app) return <div>Connecting...</div>;

  return <VedaCatalogAppInner app={app} toolResult={toolResult} hostContext={hostContext} />;
}

interface VedaCatalogAppInnerProps {
  app: App;
  toolResult: CallToolResult | null;
  hostContext?: McpUiHostContext;
}
function VedaCatalogAppInner({ app, toolResult, hostContext }: VedaCatalogAppInnerProps) {
  const [collections, setCollections] = useState<Collection[]>([]);

  useEffect(() => {
    if (toolResult) {
      setCollections(extractCollections(toolResult));
    }
  }, [toolResult]);

  const handleRefresh = useCallback(async () => {
    try {
      const result = await app.callServerTool({ name: "veda_catalog_hello", arguments: {} });
      setCollections(extractCollections(result));
    } catch (e) {
      console.error(e);
    }
  }, [app]);

  return (
    <main
      className={styles.main}
      style={{
        paddingTop: hostContext?.safeAreaInsets?.top,
        paddingRight: hostContext?.safeAreaInsets?.right,
        paddingBottom: hostContext?.safeAreaInsets?.bottom,
        paddingLeft: hostContext?.safeAreaInsets?.left,
      }}
    >
      <h1>VEDA MCP App</h1>
      <p className={styles.notice}>Scaffold placeholder. STAC search and map coming soon.</p>

      <div className={styles.action}>
        {collections.length === 0 ? (
          <p>No collections yet.</p>
        ) : (
          <ul className={styles.list}>
            {collections.map((c) => (
              <li key={c.id}>
                <span className={styles.collectionId}>{c.id}</span>
                <div>{c.title}</div>
              </li>
            ))}
          </ul>
        )}
        <button onClick={handleRefresh}>Load collections</button>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <VedaCatalogApp />
  </StrictMode>,
);
