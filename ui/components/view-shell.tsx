// Common frame around every step view: connecting gate, error banner,
// waiting notice, and the debug panel — so each view file only renders its
// actual content.
import type { McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import type { ReactNode } from "react";
import type { ViewResult } from "../hooks/use-view-result";
import styles from "../styles/views.module.css";

// Collapsed dump of what the host actually delivered to ontoolresult, for
// debugging delivery differences between hosts from inside the sandbox.
function DebugDetails({ debug }: { debug: string | null }) {
  if (!debug) return null;
  return (
    <details className={styles.debug}>
      <summary>Debug: last tool result</summary>
      <pre>{debug}</pre>
    </details>
  );
}

// Inline padding for the host's safe-area insets.
function safeAreaStyle(hostContext?: McpUiHostContext) {
  return {
    paddingTop: hostContext?.safeAreaInsets?.top,
    paddingRight: hostContext?.safeAreaInsets?.right,
    paddingBottom: hostContext?.safeAreaInsets?.bottom,
    paddingLeft: hostContext?.safeAreaInsets?.left,
  };
}

export function ViewShell<T>({
  result,
  errorOverride,
  children,
}: {
  result: ViewResult<T>;
  // Widget-local error (e.g. a failed sendMessage) shown in place of the
  // host/contract error; does not suppress the debug panel.
  errorOverride?: string | null;
  children: (view: T) => ReactNode;
}) {
  const { view, error, debug, connecting, hostContext } = result;
  if (connecting) return <div>Connecting...</div>;

  const shownError = errorOverride ?? error;
  return (
    <main className={styles.main} style={safeAreaStyle(hostContext)}>
      {shownError && <p className={styles.error}>{shownError}</p>}
      {view && children(view)}
      {!view && !shownError && <p className={styles.notice}>Waiting for results…</p>}
      {error && <DebugDetails debug={debug} />}
    </main>
  );
}
