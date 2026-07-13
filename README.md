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

## Local Development

Prerequisites: Node 22 (matches `@types/node`). No STAC credentials needed — the
server reads the public VEDA catalog.

```bash
npm install          # installs deps, runs patch-package, builds dist/ (prepare)
npm start            # build + serve over HTTP (http://localhost:3001/mcp)
npm run serve:stdio  # stdio from source (Claude Desktop / Claude Code)
npm run dev          # watch UI bundles + restart server on change
npm test             # unit tests (vitest)
```

`npm start` rebuilds every launch — for iterative work use `npm run dev`. To run
the compiled output exactly as production does: `npm run build && npm run start:prod`.

## Deployment (Heroku)

The server is HTTP-first: `POST /mcp` (Streamable HTTP, stateless) + `GET
/health` (liveness). It needs a long-lived process — not serverless (MCP
streaming responses).

Heroku pieces already in the repo:

- `Procfile` — `web: npm run start:prod` (`node dist/main.js`; the buildpack's
  `npm ci` + `build` script produce `dist/`).
- `package.json` `engines.node: 22.x` — pins the runtime Heroku installs.

Deploy from this repo's root:

```bash
heroku create <app-name>
heroku config:set MCP_PATH_TOKEN=$(openssl rand -hex 16)
git push heroku main
```

Use a **Basic dyno** (Eco dynos sleep after 30 min idle — a cold start
mid-demo takes ~10-30 s). Keep it at **1 dyno**.

Environment variables — none required. Optional:

- `MCP_PATH_TOKEN` — shared-secret path segment. When set, the MCP endpoint
  moves from `/mcp` to `/mcp/<token>` and the bare `/mcp` 404s. Only people
  given the full URL can reach the server; rotate by changing the var. Letters,
  digits, `-`, `_` only (validated at boot). Recommended for any public deploy.
- `VEDA_STAC_ROOT` — STAC catalog root (defaults to the dev catalog
  `https://dev.openveda.cloud/api/stac`).
- `VEDA_RASTER_ROOT` — titiler raster root (derived from the STAC root if
  unset).

Verify:

```bash
curl https://<app-name>.herokuapp.com/health
# -> {"status":"ok","transport":"http"}
```

The connector URL is `https://<app-name>.herokuapp.com/mcp/<token>` (or `/mcp`
if `MCP_PATH_TOKEN` is unset).

### Connecting from claude.ai / Claude Desktop (custom connector)

Settings → Connectors → Add custom connector → paste the connector URL → Add.
No auth (the token in the URL is the gate). Works on all plans (Free: one
custom connector) across claude.ai web, Desktop, and mobile — requests
originate from Anthropic's servers, so nothing is installed locally. MCP App
widgets (picker, items, map) render inline.

**Claude Code:**

```bash
claude mcp add --transport http veda https://<app-name>.herokuapp.com/mcp/<token>
```

Then ask Claude to "run a demo of the VEDA MCP app".

### Connecting from ChatGPT

Add a custom Connector pointing at the MCP HTTPS endpoint:

1. ChatGPT → Settings → Connectors → Create new connector.
2. Set the MCP server URL to the connector URL above.
3. Auth: none.
4. Enable the connector; ChatGPT discovers `search_collections`, `list_items`,
   `show_map`, `compare_map`, `run_demo`.

### Troubleshooting

- **502 / connection refused after deploy** — check `heroku logs --tail`. Most
  common: startup crash. Look for the `VEDA MCP App (HTTP transport)` banner;
  if it's absent, the process exited before listening.
- **404 on `/mcp`** — expected when `MCP_PATH_TOKEN` is set; the endpoint is
  `/mcp/<token>`. Check `heroku config:get MCP_PATH_TOKEN`.
- **Boot exit: `MCP_PATH_TOKEN must contain only...`** — the token has
  URL-unsafe characters; regenerate with `openssl rand -hex 16`.
- **First request hangs ~30 s** — Eco dyno waking from sleep. Upgrade to Basic
  for demos.
- **Wrong `PORT`** — the server reads `process.env.PORT` (Heroku sets it). The
  3001 default only applies when `PORT` is unset.
- **Bound to localhost** — not an issue here: `createMcpExpressApp({ host:
  "0.0.0.0" })`. If you ever see ECONNREFUSED externally, verify the host.
- **Invalid `VEDA_STAC_ROOT`** — if set to a non-URL, the server exits at boot
  with `VEDA_STAC_ROOT is not a valid URL: ...` (validateConfig).
- **HTTPS required** — Claude and ChatGPT only connect to `https://` MCP
  endpoints. Use the Heroku domain, not the raw `http://localhost` URL.
- **Deployed but tools 500** — the `/mcp` handler returns JSON-RPC errors;
  check the catalog is reachable from the dyno (outbound to `VEDA_STAC_ROOT`).
  Tools that depend on a mappable render return corrective text errors, not
  500s.
- **Slow deploys** — the `prepare` script builds during install and the
  buildpack runs `build` again afterward; the build runs twice. Harmless.

## Scripts

- `npm run setup:claude` — register the server with local Claude hosts (absolute
  paths, idempotent). Flags: `--print`, `--remove`, `--desktop-only`,
  `--code-only`. Re-run after switching node versions.
- `npm test` — run unit tests (`vitest`).
- `npm run build` — typecheck + build UI + compile server to `dist/`.
- `npm start` — run over HTTP (`http://localhost:3001/mcp`) for manual testing.
- `npm run serve:stdio` / `npm run dev` — stdio from source / watch mode.
