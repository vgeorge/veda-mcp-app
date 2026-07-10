# veda-mcp-app

MCP App (Apps SDK) for a VEDA STAC catalog: an MCP server that registers tools
linked to an interactive single-file React UI resource, rendered in a host like
Claude Desktop.

Searches the live VEDA STAC API (`https://dev.openveda.cloud/api/stac`, override
with `VEDA_STAC_ROOT`) and renders results with `@teamimpact/veda-ui-blocks`.
The flow is chat-first: each tool has its own step view (separate single-file
bundle + resource, CSP scoped per view) rendered inline in the conversation,
and interactions advance the chat — clicking "Pick this dataset" on a
collection card sends "I picked the dataset ... (id: ...)" into the chat
(`app.sendMessage`) so the model drives the next step (date range, then the
map). Views: collection picker (STAC-Browser-style CardDetailed tiles with
cover thumbnail, temporal coverage tag, truncated description), items
(CardDetailed with raster preview thumbnails), map (`StacSingleLayerMap`,
MapLibre, Carto dark basemap).

## Tools

- `search_collections(query?, limit?)` — search/list VEDA collections (datasets);
  optional case-insensitive substring query. Renders the picker; clicking a
  card announces the pick in the chat.
- `list_items(collectionId, limit?, bbox?, datetime?)` — list items (dated scenes)
  in a collection, each with a raster preview and a COG asset.
- `show_map(collectionId, datetime)` — interactive single-layer raster map of a
  collection over a date range (`YYYY-MM-DD` or `YYYY-MM-DD/YYYY-MM-DD`,
  clamped to the collection's temporal extent). The EIE-style happy path:
  the host resolves "NO2" to a collection via `search_collections`, then calls
  this. Collections whose `renders` metadata can't tile (stale asset names,
  object-valued params) are rejected with a corrective error.
- `compare_map(leftCollectionId, leftDatetime, rightCollectionId, rightDatetime)`
  — swipe-compare of two raster layers. Same `collectionId` with two date ranges
  = before/after (e.g. NO2 2019 vs 2021); two different `collectionId`s =
  cross-dataset. Reuses the map view; a non-mappable side returns a corrective
  error naming that side only.
- `run_demo()` — happy path: map of `no2-monthly-diff` (Nitrogen Dioxide
  difference) for 2020-2021. Ask the host to "run a demo of the VEDA MCP app".

## Quick start

```bash
npm install          # auto-builds dist/ (prepare script)
npm run setup:claude # register with Claude Desktop + Claude Code
```

Restart Claude Desktop (Claude Code picks it up on next launch), then ask it to
"run a demo of the VEDA MCP app". Rebuild with `npm run build` after code changes.

## Scripts

- `npm run setup:claude` — register the server with local Claude hosts (absolute
  paths, idempotent). Flags: `--print`, `--remove`, `--desktop-only`,
  `--code-only`. Re-run after switching node versions.
- `npm test` — run unit tests (`vitest`).
- `npm run build` — typecheck + build UI + compile server to `dist/`.
- `npm start` — run over HTTP (`http://localhost:3001/mcp`) for manual testing.
- `npm run serve:stdio` / `npm run dev` — stdio from source / watch mode.

## UI preview harness

`preview.html` renders the step views (map with live tiles, picker, items)
with fixture data outside the MCP host, for inspecting layout in a plain
browser. `INPUT=map.html` selects the un-stubbed (map-capable) alias set:

```bash
INPUT=map.html npx vite --port 3006
# open http://localhost:3006/preview.html
```
