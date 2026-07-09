// Shared plumbing for the step-view entries: connect to the host, parse the
// tool result for THIS view, surface contract drift as an error string.
import type { App, McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import { useEffect, useState } from "react";

export interface ViewResult<T> {
  app: App | null;
  view: T | null;
  error: string | null;
  // Summary of the last raw tool result as delivered by the host, for
  // debugging host-specific delivery differences from inside the sandbox.
  debug: string | null;
  connecting: boolean;
  hostContext?: McpUiHostContext;
}

interface RawToolResult {
  isError?: boolean;
  structuredContent?: unknown;
  content?: { type: string; text?: string }[];
  _meta?: unknown;
}

function summarizeResult(result: RawToolResult): string {
  const sc = result.structuredContent;
  return JSON.stringify(
    {
      resultKeys: Object.keys(result),
      isError: result.isError ?? false,
      structuredContent:
        sc === undefined
          ? "undefined"
          : `${typeof sc}${sc && typeof sc === "object" ? ` keys=[${Object.keys(sc).join(",")}]` : ""}`,
      meta: result._meta ?? null,
      contentBlocks: (result.content ?? []).map((c) => ({
        ...c,
        text: c.text === undefined ? undefined : `(${c.text.length} chars) ${c.text.slice(0, 300)}`,
      })),
    },
    null,
    1,
  );
}

export function useViewResult<T>(
  appName: string,
  parse: (structuredContent: unknown) => T,
): ViewResult<T> {
  const [view, setView] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<string | null>(null);
  const [hostContext, setHostContext] = useState<McpUiHostContext | undefined>();

  const { app, error: connectError } = useApp({
    appInfo: { name: appName, version: "0.1.0" },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolresult = async (result) => {
        setDebug(summarizeResult(result as RawToolResult));
        // A failed tool call has no structuredContent but the host may still
        // mount this view for it: surface the tool's error text instead of a
        // contract-parse error.
        if (result.structuredContent === undefined) {
          // Some hosts (Claude Desktop) strip structuredContent from the
          // delivered result; check whether any text block carries the view
          // as JSON before giving up.
          for (const block of result.content ?? []) {
            if (block.type !== "text") continue;
            try {
              const view = parse(JSON.parse(block.text));
              setView(view);
              setError(null);
              return;
            } catch {
              // Not this block — keep looking.
            }
          }
          const text = result.content?.find((c) => c.type === "text")?.text;
          setError(
            result.isError
              ? (text ?? "The tool call failed.")
              : "The server returned no view data.",
          );
          return;
        }
        try {
          setView(parse(result.structuredContent));
          setError(null);
        } catch (e) {
          console.error(e);
          setError(e instanceof Error ? e.message : String(e));
        }
      };
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

  return {
    app: app ?? null,
    view,
    error: error ?? connectError?.message ?? null,
    debug,
    connecting: !app && !connectError,
    hostContext,
  };
}

// Inline padding for the host's safe-area insets.
export function safeAreaStyle(hostContext?: McpUiHostContext) {
  return {
    paddingTop: hostContext?.safeAreaInsets?.top,
    paddingRight: hostContext?.safeAreaInsets?.right,
    paddingBottom: hostContext?.safeAreaInsets?.bottom,
    paddingLeft: hostContext?.safeAreaInsets?.left,
  };
}
