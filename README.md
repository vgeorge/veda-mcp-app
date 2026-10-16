# veda-mcp-app

MCP App for the VEDA STAC catalog: tools that render interactive widgets
(collection picker, raster map) inline in Claude or ChatGPT.

- [ARCHITECTURE.md](ARCHITECTURE.md) — MCP concepts and how this repo maps onto them
- [CONTEXT.md](CONTEXT.md) — domain glossary

## Tools

- `search_collections(query?, limit?)` — search/list collections; renders the
  picker, clicking a card announces the pick in the chat.
- `show_map(collectionId, datetime)` — single-layer raster map over a date
  range (`YYYY-MM-DD` or `YYYY-MM-DD/YYYY-MM-DD`, clamped to the collection's
  temporal extent). Non-mappable collections are rejected with a corrective
  error.
- `compare_map(leftCollectionId, leftDatetime, rightCollectionId, rightDatetime)`
  — swipe-compare; same collection twice = before/after.
- `run_demo()` — map of `no2-monthly-diff` for 2020-2021. Ask the host to
  "run a demo of the VEDA MCP app".

## Quick start

```bash
npm install          # auto-builds dist/ (prepare script)
npm run setup:claude # register with Claude Desktop + Claude Code
```

Restart Claude Desktop, then ask it to "run a demo of the VEDA MCP app".

## Local development

Prerequisites: Node 22. No credentials — the server reads the public VEDA
catalog (`https://dev.openveda.cloud/api/stac`, override with `VEDA_STAC_ROOT`).

```bash
npm start            # build + serve over HTTP (http://localhost:3001/mcp)
npm run serve:stdio  # stdio from source (Claude Desktop / Claude Code)
npm run dev          # watch UI bundles + restart server on change
npm test             # unit tests (vitest)
npm run build        # typecheck + UI bundles + server -> dist/
```

`npm run serve` and `npm run start:prod` load env vars from `.env` when it
exists (gitignored), e.g. `MCP_PATH_TOKEN=<token>`.

To run the compiled output exactly as production does:
`npm run build`, then `npm run start:prod`.

To verify the widgets end-to-end without Claude, use `basic-host` (the
reference host in the [ext-apps repo](https://github.com/modelcontextprotocol/ext-apps),
`examples/basic-host`): it expects this server at `http://localhost:3001/mcp`
and renders the widgets in a sandboxed iframe with debug panels.

## Deployment

HTTP-first: `POST /mcp` (Streamable HTTP, stateless: a fresh server per
request, no session) + `GET /health`. Other methods on `/mcp` return 405 (no
standalone SSE stream). The Express app is built in `server/app.ts`; it runs
as a serverless function or a long-lived process.

Env vars (all optional):

- `MCP_PATH_TOKEN` — shared-secret path segment: endpoint moves to
  `/mcp/<token>`, bare `/mcp` 404s. Letters/digits/`-`/`_` only. Required
  for any public deploy: it is the only access gate.
- `VEDA_STAC_ROOT` / `VEDA_RASTER_ROOT` — catalog/titiler roots.

### Vercel

Vercel's Git integration deploys: push to `main` redeploys production, PRs
get preview deployments (behind Vercel's default protection). GitHub Actions
(`.github/workflows/ci.yml`) only typechecks, tests and builds.

- `api/index.js` exports the Express app as one function; `vercel.json`
  rewrites every path to it, runs `npm run build`, and ships `dist/*.html`
  (the view bundles read at request time) via `includeFiles`.
- `engines.node: 22.x` pins the runtime.

One-time setup (dashboard): import the repo, set `MCP_PATH_TOKEN`
(`openssl rand -hex 16`) for Production, make sure Deployment Protection
does not cover Production.

Verify: `curl https://<domain>/health` → `{"status":"ok","transport":"http"}`.
The connector URL is `https://<domain>/mcp/<token>`.

### Heroku (alternative)

`Procfile` runs `npm run start:prod`.

```bash
heroku create <app-name>
heroku config:set MCP_PATH_TOKEN=$(openssl rand -hex 16)
git push heroku main
```

Use a Basic dyno (Eco dynos sleep; a cold start mid-demo takes ~10-30 s).

### Connecting

The connector URL has the shape `https://<domain>/mcp/<token>`.

- **claude.ai / Claude Desktop**: Settings → Connectors → Add custom
  connector → paste the connector URL. No auth (the token in the URL is the
  gate). Widgets render inline.
- **Claude Code**:
  `claude mcp add --transport http veda https://<domain>/mcp/<token>`
- **ChatGPT**: Settings → Connectors → Create new connector → MCP server URL
  = the connector URL, auth: none.

Local-only fallback (no deploy needed, Claude Desktop / Claude Code):

```bash
git clone https://github.com/vgeorge/veda-mcp-app
cd veda-mcp-app
npm install
npm run setup:claude
```

Restart Claude Desktop, then ask it to "run a demo of the VEDA MCP app".

### Troubleshooting

- **500 / function crash on Vercel** — check the function logs; config
  validation errors print the reason. On Heroku, `heroku logs --tail`: if
  the `VEDA MCP App (HTTP transport)` banner is absent, boot failed.
- **404 on `/mcp`** — expected when `MCP_PATH_TOKEN` is set; use
  `/mcp/<token>`.
- **First request slow** — cold start (Vercel function or Heroku Eco dyno).
- **HTTPS required** — Claude and ChatGPT only connect to `https://`
  endpoints.
- **Tool answers "cannot be mapped" / "unknown collection"** — corrective by
  design; the model retries with a valid collection.

## Scripts

- `npm run setup:claude` — register with local Claude hosts (idempotent).
  Flags: `--print`, `--remove`, `--desktop-only`, `--code-only`.
- `npm test` / `npm run build` / `npm start` / `npm run dev` — see above.
