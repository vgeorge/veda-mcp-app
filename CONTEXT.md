# Domain glossary

Terms used consistently across code, tests, and reviews. When a module is
named after a concept, that concept belongs here.

- **Collection** — a VEDA STAC dataset (e.g. `no2-monthly`). Summarized on the
  wire as id + title.
- **Item** — a dated scene inside a Collection, carrying a raster preview and
  a COG asset.
- **Dashboard Render** — a Collection's `renders.dashboard` styling params
  (asset, bidx, rescale, colormap) used to build item previews via the titiler
  raster API. Resolution rule: use the render's named asset when the item
  exposes it, else fall back to `cog_default`.
- **View** — what the UI renders: a discriminated union
  (`collections` | `items`) carried in tool results' `structuredContent`.
- **View Contract** (`view-contract.ts`) — the single declaration of the View
  wire shape, shared by server (write side, compile-time via inferred types)
  and UI (read side, runtime via `parseView`). Unknown keys are stripped so an
  older UI tolerates a newer server; a non-conforming payload throws and is
  shown in the UI error banner.
