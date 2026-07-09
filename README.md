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
- `tsx` to run the TypeScript server
- pnpm

## Develop

```bash
pnpm install
pnpm build          # typecheck + build single-file UI into dist/mcp-app.html
pnpm serve:stdio    # run the MCP server over stdio
```

`pnpm serve` runs the server over HTTP (default `http://localhost:3001/mcp`)
instead of stdio.

## Inspect in Claude Desktop

Claude Desktop is the primary host for this app (native MCP Apps support, stdio
transport).

1. `pnpm build` (produces `dist/mcp-app.html`, which the server serves as the UI
   resource).
2. Add the server to `claude_desktop_config.json`
   (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

   ```json
   {
     "mcpServers": {
       "veda-mcp-app": {
         "command": "pnpm",
         "args": ["serve:stdio"],
         "cwd": "/absolute/path/to/apps/veda-mcp-app"
       }
     }
   }
   ```

3. Restart Claude Desktop, invoke the tool in a chat, and confirm the React UI
   renders the collection list inline.
