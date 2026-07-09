# veda-mcp-app

MCP App (Apps SDK) for a VEDA STAC catalog: an MCP server that registers tools
linked to an interactive single-file React UI resource, rendered in a host like
Claude Desktop.

Searches the live VEDA STAC API (`https://dev.openveda.cloud/api/stac`, override
with `VEDA_STAC_ROOT`) and renders results with `@teamimpact/veda-ui-blocks`
cards — collections as CardCTA, items as CardDetailed with raster preview
thumbnails. A `veda-ui-blocks` raster map (from each item's COG asset) comes later.

## Tools

- `search_collections(query?, limit?)` — search/list VEDA collections (datasets);
  optional case-insensitive substring query.
- `list_items(collectionId, limit?, bbox?, datetime?)` — list items (dated scenes)
  in a collection, each with a raster preview and a COG asset.
- `run_demo()` — happy path: recent `no2-monthly` (Nitrogen Dioxide) items with
  previews. Ask the host to "run a demo of the VEDA MCP app".

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

`preview.html` renders the collections/items views with fixture data outside
the MCP host, for inspecting card layout in a plain browser:

```bash
INPUT=mcp-app.html npx vite --port 3006
# open http://localhost:3006/preview.html
```
