# Architecture

How this app works, for someone who hasn't built an MCP server before.
Domain terms (Collection, View, Picker, ...) are defined in [CONTEXT.md](CONTEXT.md).

## MCP server basics

An MCP server exposes capabilities to an AI host (Claude, ChatGPT, ...):

- **Tools** — functions the model can call. Each has a name, a description
  (the model reads it to decide when to call), a Zod input schema, and a
  handler returning a `CallToolResult` (content blocks + optional
  `structuredContent`). Registered in `server/server.ts`.
- **Resources** — URI-addressed content the host fetches (here: the view
  HTML bundles, served from `dist/`).

Transports (`server/main.ts`):

- **stdio** — the host launches the server as a subprocess (Claude
  Desktop/Code, local). `--stdio` flag.
- **Streamable HTTP** — remote hosts (claude.ai, ChatGPT) POST to `/mcp`.
  Stateless: a fresh `McpServer` per request, so it scales on one dyno and
  survives restarts.

## What makes it an MCP App

An MCP App adds an interactive widget to a tool result:

1. The tool declares `_meta.ui.resourceUri` pointing at an HTML resource.
2. The host fetches that resource and renders it in a **sandboxed iframe**
   next to the chat, with a CSP built from the resource's `_meta.ui.csp`.
3. The widget talks to the host over postMessage via the ext-apps SDK
   (`useApp`): it receives the tool result through `app.ontoolresult` and can
   post a user message into the conversation with `app.sendMessage`.

Design rule here: **interactions advance the chat**. The picker card's
Select button sends "I picked the dataset ... (id: ...)" as a user message;
the model reads it and drives the next step. No widget-local navigation.

Each view is its own single-file bundle (vite + singlefile plugin, one
`INPUT` html entry per build) and its own resource with a CSP scoped to what
it actually loads (thumbnails host for the picker, raster + basemap hosts
for the map).

## The wire contract

`view-contract.ts` (repo root — the one module both sides import) declares
the View shapes (Zod schemas: `collections` | `items` | `map` | `compare`)
and the carriage:

- `encodeViewResult(text, view)` — server side. Emits the view as
  `structuredContent` **plus a duplicate JSON text block**, because Claude
  Desktop strips `structuredContent` before the widget sees it.
- `recoverView(result, parse)` — widget side. Tries `structuredContent`,
  then JSON-parses text blocks; returns the view or an error string for the
  widget's error banner.

Unknown keys are stripped (an older UI tolerates a newer server); a
non-conforming payload fails loudly. The round-trip (encode → strip →
recover) is unit-tested in `view-contract.test.ts` — the contract is the
test surface.

## Repo map

```
view-contract.ts        View shapes + wire encode/decode (shared seam)
picker.html/items.html/map.html   vite entries (script src -> ui/views/*)
server/
  main.ts               transport bootstrap (stdio | HTTP), config validation
  server.ts             tool + resource registrations, CSP per view
  stac.ts               STAC catalog client: fetch/cache collections, items, previews
  dashboard-render.ts   render metadata -> map config, mappability guards
ui/
  views/picker.tsx      one file per tool widget: entry + view component
  views/items.tsx
  views/map.tsx         single-layer + swipe-compare maps (veda-ui-blocks)
  use-view-result.tsx   shared plumbing: useApp hook wrapper, DebugDetails
  cards.tsx             card adapters for collections/items
  veda-ui-blocks-stubs.ts  build stubs so picker/items skip the map stack
```

Data flow: tool call → STAC client (`server/stac.ts`, live catalog at
`dev.openveda.cloud`) → View → `encodeViewResult` → host → iframe →
`recoverView` → React render.

Build (`npm run build`): typecheck, then three vite single-file builds
(INPUT env var selects the entry; non-map entries stub the heavy map deps),
then `tsc -p tsconfig.server.json` → `dist/server/`.

## Verifying changes

- `npm test` — STAC client, dashboard-render guards, wire round-trip.
- End-to-end widget behavior needs a real MCP Apps host: use the
  `veda-mcp-app-happy-path` skill (basic-host + Chrome DevTools MCP) —
  run_demo map render, picker cards, card click → sendMessage.
