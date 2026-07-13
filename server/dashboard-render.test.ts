import { afterEach, describe, expect, it, vi } from "vitest";
import { getMapConfig, MapConfigError } from "./dashboard-render.js";
import { _resetCaches } from "./stac.js";
import {
  ITEMS,
  MAP_COLLECTION_META,
  mockFetch,
  mockFetchRoutes,
  RGB_COLLECTION_META,
  RGB_ITEMS,
} from "./test-helpers.js";

afterEach(() => {
  vi.unstubAllGlobals();
  _resetCaches();
});

describe("getMapConfig", () => {
  it("resolves the dashboard render, title and extent", async () => {
    mockFetch(MAP_COLLECTION_META);
    const config = await getMapConfig("no2-monthly", "2020-01-01/2021-12-31");
    expect(config).toEqual({
      collectionId: "no2-monthly",
      collectionTitle: "NO2",
      renderKey: "dashboard",
      dateRange: { from: "2020-01-01", to: "2021-12-31" },
      bbox: [-180, -90, 180, 90],
    });
  });

  it("accepts a single date and truncates ISO datetimes", async () => {
    mockFetch(MAP_COLLECTION_META);
    const config = await getMapConfig("no2-monthly", "2020-06-01T00:00:00Z");
    expect(config.dateRange).toEqual({ from: "2020-06-01", to: "2020-06-01" });
  });

  it("falls back to the first render key when there is no dashboard render", async () => {
    mockFetch({ id: "x", renders: { custom: {} } });
    const config = await getMapConfig("x", "2020-01-01");
    expect(config.renderKey).toBe("custom");
  });

  it("clamps the range to the collection's temporal extent", async () => {
    mockFetch(MAP_COLLECTION_META);
    const config = await getMapConfig("no2-monthly", "2010-01-01/2030-01-01");
    expect(config.dateRange).toEqual({ from: "2016-01-01", to: "2023-12-31" });
  });

  it("rejects a range fully outside the temporal extent, naming the valid interval", async () => {
    mockFetch(MAP_COLLECTION_META);
    await expect(getMapConfig("no2-monthly", "2010-01-01/2012-01-01")).rejects.toThrow(
      /2016-01-01\/2023-12-31/,
    );
  });

  it("rejects a render whose asset is absent from the items (stale metadata)", async () => {
    mockFetchRoutes({
      "/items?": ITEMS, // items only expose cog_default
      "/collections/no2-monthly": MAP_COLLECTION_META, // render declares "no2"
    });
    await expect(getMapConfig("no2-monthly", "2020-01-01")).rejects.toThrow(
      /expects asset "no2".*cog_default/,
    );
  });

  it("accepts a render whose asset the items expose", async () => {
    mockFetchRoutes({
      "/items?": RGB_ITEMS,
      "/collections/rgb-col": RGB_COLLECTION_META,
    });
    const config = await getMapConfig("rgb-col", "2024-01-01");
    expect(config.renderKey).toBe("dashboard");
  });

  it("rejects a render with an object-valued parameter (asset_bidx)", async () => {
    mockFetch({
      id: "omi",
      renders: { dashboard: { assets: ["x"], asset_bidx: { x: [1] } } },
    });
    await expect(getMapConfig("omi", "2020-01-01")).rejects.toThrow(/asset_bidx/);
  });

  it("accepts a render with a categorical colormap object (e.g. land cover)", async () => {
    // colormap is a {class: [r,g,b,a]} object; the widget JSON-encodes it for
    // titiler, so it must not be rejected by the object-param guard.
    mockFetch({
      id: "landcover",
      extent: {
        temporal: { interval: [["2001-01-01T00:00:00Z", "2020-12-31T00:00:00Z"]] },
      },
      renders: {
        dashboard: {
          assets: ["cog_default"],
          bidx: [1],
          colormap: { "0": [0, 0, 0, 128], "100": [0, 130, 0, 255] },
          resampling: "nearest",
        },
      },
    });
    const config = await getMapConfig("landcover", "2010-01-01");
    expect(config.renderKey).toBe("dashboard");
  });

  it("skips the item-asset check when the items response is unusable", async () => {
    // The items URL also matches this route, so the probe gets a payload with
    // no `features` and must skip the check instead of failing the map.
    mockFetchRoutes({
      "/collections/no2-monthly": MAP_COLLECTION_META,
    });
    const config = await getMapConfig("no2-monthly", "2020-01-01");
    expect(config.renderKey).toBe("dashboard");
  });

  it("rejects a collection with no renders", async () => {
    mockFetch({ id: "no-renders" });
    await expect(getMapConfig("no-renders", "2020-01-01")).rejects.toBeInstanceOf(
      MapConfigError,
    );
  });

  it("rejects an unknown collection with a search_collections hint", async () => {
    mockFetch({}, false, 404);
    await expect(getMapConfig("bogus", "2020-01-01")).rejects.toThrow(
      /search_collections/,
    );
  });

  it("treats a non-collection 200 response (CDN SPA page) as an unknown collection", async () => {
    mockFetch("<!doctype html><html>STAC Browser</html>");
    await expect(getMapConfig("bogus", "2020-01-01")).rejects.toThrow(
      /search_collections/,
    );
  });

  it("rejects a malformed datetime", async () => {
    await expect(getMapConfig("no2-monthly", "last year")).rejects.toThrow(
      /YYYY-MM-DD/,
    );
  });

  it("rejects a reversed range", async () => {
    await expect(
      getMapConfig("no2-monthly", "2021-01-01/2020-01-01"),
    ).rejects.toThrow(/start is after end/);
  });
});
