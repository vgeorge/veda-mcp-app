# Domain glossary

Terms used consistently across code, tests, and reviews. When a module is
named after a concept, that concept belongs here.

- **Collection** — a VEDA STAC dataset (e.g. `no2-monthly`). Summarized on the
  wire as id + title + description (nullable) + temporal coverage (nullable
  YYYY-MM-DD start/end, ends null = open) so date ranges can be discussed
  without another tool call + thumbnail href (nullable; the collection's
  `assets.thumbnail` cover image, http(s) only).
- **Item** — a dated scene inside a Collection, carrying a raster preview and
  a COG asset.
- **Dashboard Render** — a Collection's `renders.dashboard` styling params
  (asset, bidx, rescale, colormap) used to build item previews via the titiler
  raster API. Resolution rule: use the render's named asset when the item
  exposes it, else fall back to `cog_default`.
- **View** — one step of the chat flow, carried in a tool result's
  `structuredContent` (`collections` | `items` | `map`). Each view is its own
  single-file bundle and MCP resource with a CSP scoped to what it loads; each
  tool's `_meta.ui.resourceUri` selects its view. There is no app-like widget:
  no toolbar, no widget-local navigation — interactions advance the chat.
- **Picker** — the collections view. Clicking a card calls `app.sendMessage`
  with a user-role message ("I picked the dataset ... (id: ...)") so the model
  drives the next step; if the host rejects the message, an error banner tells
  the user to type the pick instead.
- **Map View** — a single-layer raster map of a Collection over a date range,
  rendered by veda-ui-blocks `StacSingleLayerMap`. Carries the collection, the
  render key (the `renders` entry the map component styles itself from), the
  date range (clamped server-side to the Collection's temporal extent), the
  spatial extent for the initial camera, and the STAC/raster API roots the
  iframe should call. A Collection is *mappable* only when its render params
  are titiler-serializable and its render asset exists on the items
  (`getMapConfig` guards both).
- **Compare View** — a swipe-compare of two raster layers (same Collection + two
  date ranges for a before/after, or two Collections for cross-dataset),
  rendered by veda-ui-blocks `StacCompareMap`. Each side is resolved
  independently via `getMapConfig`; the map resource renders both this and the
  Map View, dispatched by the `kind` field (`"compare"` vs `"map"`). The left
  side's spatial extent sets the initial camera.
- **View Contract** (`view-contract.ts`) — the single declaration of the View
  wire shape AND its carriage, shared by server (write side, compile-time via
  inferred types) and UI (read side, runtime via `parseView`). Unknown keys
  are stripped so an older UI tolerates a newer server; a non-conforming
  payload throws and is shown in the UI error banner. The wire round-trip
  lives here too: `encodeViewResult` emits the view as structuredContent plus
  a duplicate JSON text block (Claude Desktop strips structuredContent), and
  `recoverView` reads it back, trying structuredContent then text blocks.
