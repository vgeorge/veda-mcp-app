// Env-derived configuration. Everything the server reads from the
// environment (besides PORT, owned by the HTTP transport) resolves here.

export const STAC_ROOT =
  process.env.VEDA_STAC_ROOT ?? "https://dev.openveda.cloud/api/stac";

// titiler raster root. Derived from the STAC root (same origin, /api/raster)
// unless VEDA_RASTER_ROOT is set.
export const RASTER_ROOT =
  process.env.VEDA_RASTER_ROOT ??
  STAC_ROOT.replace(/\/api\/stac\/?$/, "/api/raster");

// Origin of the raster host; the UI resource allowlists it via CSP for img-src.
export const RASTER_HOST = new URL(RASTER_ROOT).origin;

// Fail loud on clearly-wrong config instead of running against a broken catalog.
export function validateConfig(): void {
  if (process.env.VEDA_STAC_ROOT) {
    try {
      new URL(process.env.VEDA_STAC_ROOT);
    } catch {
      console.error(
        `VEDA_STAC_ROOT is not a valid URL: ${process.env.VEDA_STAC_ROOT}`,
      );
      process.exit(1);
    }
  }
  if (
    process.env.MCP_PATH_TOKEN &&
    !/^[A-Za-z0-9_-]+$/.test(process.env.MCP_PATH_TOKEN)
  ) {
    console.error(
      "MCP_PATH_TOKEN must contain only letters, digits, - and _ (it becomes a URL path segment)",
    );
    process.exit(1);
  }
}
