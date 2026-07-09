// Renders VEDA STAC results from the search_collections / list_items / run_demo tools.
import type { App, McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "@teamimpact/veda-ui-blocks/default.css";
import { parseView, type View } from "../view-contract";
import { CollectionsView, ItemsView } from "./views";
import styles from "./mcp-app.module.css";

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
  const [view, setView] = useState<View | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!toolResult) return;
    try {
      setView(parseView(toolResult.structuredContent));
      setError(null);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [toolResult]);

  const call = useCallback(
    async (name: string, args: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      try {
        const result = await app.callServerTool({ name, arguments: args });
        setView(parseView(result.structuredContent));
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [app],
  );

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

      <div className={styles.toolbar}>
        <button onClick={() => call("run_demo", {})} disabled={busy}>
          Run demo
        </button>
        <button onClick={() => call("search_collections", {})} disabled={busy}>
          Browse collections
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {view?.kind === "collections" && (
        <CollectionsView collections={view.collections} busy={busy} onOpen={(id) => call("list_items", { collectionId: id })} />
      )}
      {view?.kind === "items" && (
        <ItemsView collectionId={view.collectionId} items={view.items} demo={view.demo ?? false} />
      )}
      {!view && !error && <p className={styles.notice}>Run the demo or browse collections to start.</p>}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <VedaCatalogApp />
  </StrictMode>,
);
