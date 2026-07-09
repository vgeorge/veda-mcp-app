# veda-mcp-app

MCP App (Apps SDK) for interacting with a VEDA STAC catalog from inside an
MCP-enabled host such as Claude Desktop.

An MCP App is an MCP server that registers a **tool** linked to an interactive
**UI resource** (a single-file React bundle). When the host calls the tool, it
renders the UI and passes the tool result to it.

## Status

Scaffold only. Wired hello-world proving the `tool -> resource -> UI` loop:

- Tool `veda_catalog_hello` returns a static list of mock VEDA STAC collections.
- React UI renders that list.

### Planned

- Real STAC catalog search tool.
- Raster map in the UI via `@teamimpact/veda-ui-blocks` (will require CSP config
  for STAC/tile network requests).

## Tech

- `@modelcontextprotocol/ext-apps` + `@modelcontextprotocol/sdk`
- React 19
- Vite + `vite-plugin-singlefile` (bundles the UI into one HTML file)
- `tsx` (dev) / compiled `node` (production) to run the TypeScript server
- npm

## Quick start (clone and go)

```bash
git clone <repo-url> veda-mcp-app
cd veda-mcp-app
npm install          # auto-builds dist/ (via the "prepare" script)
npm run setup:claude # registers the server with Claude Desktop + Claude Code
```

Then restart Claude Desktop (Claude Code picks it up on next launch), open a
chat, and ask it to call the VEDA catalog tool.

`npm install` runs the `prepare` script, which builds:

- `dist/mcp-app.html` — the bundled UI resource (served at runtime).
- `dist/main.js` + `dist/server.js` — the compiled server, run with plain
  `node dist/main.js --stdio` (no tsx). This is what the Claude hosts launch.

After any code change: `npm run build`, then restart the host.

## `setup:claude`

`npm run setup:claude` computes absolute paths and registers the server so no
manual config editing is needed. It:

- Merges an entry into Claude Desktop's `claude_desktop_config.json` (per-OS
  path), leaving any other servers untouched.
- Runs `claude mcp add ... -s user` for Claude Code (skipped if the `claude` CLI
  is not installed).

Flags:

- `--print` — dry run; show what would change without writing.
- `--remove` — unregister from both hosts.
- `--desktop-only` / `--code-only` — target a single host.

The generated command uses the **absolute** path to the node that ran the setup
script plus the absolute `dist/main.js` path (this build of Claude Desktop
ignores the config `cwd` field). If you switch node versions, re-run
`npm run setup:claude`.

## Other scripts

- `npm start` — build, then run the server over HTTP
  (`http://localhost:3001/mcp`) for manual testing outside a host.
- `npm run serve:stdio` — run over stdio from source (via tsx).
- `npm run dev` — watch-rebuild the UI and run the HTTP server.

## Manual host config

Prefer `setup:claude`, but the equivalent manual entry is:

```json
{
  "mcpServers": {
    "veda-mcp-app": {
      "command": "node",
      "args": [
        "/absolute/path/to/veda-mcp-app/dist/main.js",
        "--stdio"
      ]
    }
  }
}
```
