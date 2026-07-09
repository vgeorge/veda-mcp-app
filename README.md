# veda-mcp-app

MCP App (Apps SDK) for a VEDA STAC catalog: an MCP server that registers a tool
linked to an interactive single-file React UI resource, rendered in a host like
Claude Desktop.

Scaffold status: the `veda_catalog_hello` tool returns mock STAC collections and
the UI renders them. Real STAC search and a `veda-ui-blocks` raster map come
later.

## Quick start

```bash
npm install          # auto-builds dist/ (prepare script)
npm run setup:claude # register with Claude Desktop + Claude Code
```

Restart Claude Desktop (Claude Code picks it up on next launch), then ask it to
call the VEDA catalog tool. Rebuild with `npm run build` after code changes.

## Scripts

- `npm run setup:claude` — register the server with local Claude hosts (absolute
  paths, idempotent). Flags: `--print`, `--remove`, `--desktop-only`,
  `--code-only`. Re-run after switching node versions.
- `npm run build` — typecheck + build UI + compile server to `dist/`.
- `npm start` — run over HTTP (`http://localhost:3001/mcp`) for manual testing.
- `npm run serve:stdio` / `npm run dev` — stdio from source / watch mode.
