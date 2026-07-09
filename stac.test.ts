import { afterEach, describe, expect, it, vi } from "vitest";
import { getMapConfig, listItems, MapConfigError, searchCollections, _resetCaches } from "./stac.js";

function mockFetch(payload: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok,
      status,
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    })),
  );
}

// Dispatch different payloads based on the request URL (for multi-fetch calls).
function mockFetchRoutes(routes: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      for (const [key, payload] of Object.entries(routes)) {
        if (url.includes(key)) {
          return { ok: true, status: 200, json: async () => payload, text: async () => JSON.stringify(payload) };
        }
      }
      return { ok: false, status: 404, json: async () => ({}), text: async () => "" };
    }),
  );
}

const COLLECTIONS = {
  collections: [
    {
      id: "no2-monthly",
      title: "NO2",
      description: "Nitrogen dioxide",
      extent: {
        temporal: { interval: [["2016-01-01 00:00:00+00", "2023-12-31 00:00:00+00"]] },
      },
      assets: {
        thumbnail: { href: "https://thumbnails.openveda.cloud/no2--dataset-cover.jpg" },
      },
    },
    {
      id: "nightlights-hd-monthly",
      title: "Nightlights",
      extent: { temporal: { interval: [["2020-01-01T00:00:00Z", null]] } },
    },
    { id: "hls-swir", title: "HLS SWIR" },
    { id: "geos-cf-ana", title: null }, // live catalog has explicit null titles
    { title: "missing id" }, // malformed: no id
  ],
};

const COLLECTION_META = {
  id: "no2-monthly",
  title: "NO2",
  renders: {
    dashboard: {
      assets: ["no2"],
      bidx: [1],
      rescale: [[0, 15000000000000000]],
      colormap_name: "rdbu_r",
      color_formula: "gamma r 1.05",
      resampling: "bilinear",
    },
  },
};

// A collection whose dashboard render names an asset that IS present on items
// (unlike no2, which names "no2" but items only expose cog_default).
const RGB_COLLECTION_META = {
  id: "rgb-col",
  renders: { dashboard: { assets: ["rgb"], bidx: [1, 2, 3], rescale: [[0, 255]] } },
};

const RGB_ITEMS = {
  type: "FeatureCollection",
  features: [
    {
      id: "rgb-scene-1",
      properties: { start_datetime: "2024-01-01T00:00:00Z", end_datetime: "2024-01-02T00:00:00Z" },
      assets: { rgb: { href: "s3://bucket/rgb-scene-1.tif" } },
    },
  ],
};

const ITEMS = {
  type: "FeatureCollection",
  features: [
    {
      id: "OMI_202312",
      bbox: [-180, -90, 180, 90],
      properties: {
        datetime: null,
        start_datetime: "2023-12-01T00:00:00Z",
        end_datetime: "2023-12-31T00:00:00Z",
      },
      assets: {
        cog_default: { href: "s3://veda-data-store-staging/no2-monthly/OMI_202312.tif" },
      },
    },
    { properties: {} }, // malformed: no id
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
  _resetCaches();
});

describe("searchCollections", () => {
  it("returns all collections (skipping malformed) when no query", async () => {
    mockFetch(COLLECTIONS);
    const result = await searchCollections();
    expect(result.map((c) => c.id)).toEqual([
      "no2-monthly",
      "nightlights-hd-monthly",
      "hls-swir",
      "geos-cf-ana",
    ]);
  });

  it("filters by case-insensitive substring on id/title/description", async () => {
    mockFetch(COLLECTIONS);
    const result = await searchCollections("nitrogen");
    expect(result).toEqual([
      {
        id: "no2-monthly",
        title: "NO2",
        description: "Nitrogen dioxide",
        temporal: { start: "2016-01-01", end: "2023-12-31" },
        thumbnailHref: "https://thumbnails.openveda.cloud/no2--dataset-cover.jpg",
      },
    ]);
  });

  it("ignores non-http thumbnail hrefs", async () => {
    mockFetch({
      collections: [
        { id: "s3-thumb", title: "S3", assets: { thumbnail: { href: "s3://bucket/cover.jpg" } } },
      ],
    });
    const result = await searchCollections("s3-thumb");
    expect(result[0].thumbnailHref).toBeNull();
  });

  it("maps an open-ended temporal extent to a null end", async () => {
    mockFetch(COLLECTIONS);
    const result = await searchCollections("nightlights");
    expect(result[0].temporal).toEqual({ start: "2020-01-01", end: null });
  });

  it("caps results to the limit", async () => {
    mockFetch(COLLECTIONS);
    const result = await searchCollections(undefined, 2);
    expect(result).toHaveLength(2);
  });

  it("falls back to id when title is absent", async () => {
    mockFetch(COLLECTIONS);
    const result = await searchCollections("hls");
    expect(result).toEqual([
      { id: "hls-swir", title: "HLS SWIR", description: null, temporal: null, thumbnailHref: null },
    ]);
  });

  it("keeps collections with an explicit null title, falling back to id", async () => {
    mockFetch(COLLECTIONS);
    const result = await searchCollections("geos-cf");
    expect(result).toEqual([
      { id: "geos-cf-ana", title: "geos-cf-ana", description: null, temporal: null, thumbnailHref: null },
    ]);
  });
});

describe("listItems", () => {
  it("maps dates and builds a styled titiler preview, skipping malformed items", async () => {
    mockFetchRoutes({
      "/items?": ITEMS,
      "/collections/no2-monthly": COLLECTION_META,
    });
    const result = await listItems("no2-monthly");
    expect(result).toEqual([
      {
        id: "OMI_202312",
        start: "2023-12-01T00:00:00Z",
        end: "2023-12-31T00:00:00Z",
        previewHref:
          "https://dev.openveda.cloud/api/raster/collections/no2-monthly/items/OMI_202312/preview.png?assets=cog_default&bidx=1&rescale=0%2C15000000000000000&colormap_name=rdbu_r&color_formula=gamma+r+1.05&resampling=bilinear",
        cogHref: "s3://veda-data-store-staging/no2-monthly/OMI_202312.tif",
        bbox: [-180, -90, 180, 90],
      },
    ]);
  });

  it("uses the render's named asset when the item exposes it (forwards bidx)", async () => {
    mockFetchRoutes({
      "/items?": RGB_ITEMS,
      "/collections/rgb-col": RGB_COLLECTION_META,
    });
    const result = await listItems("rgb-col");
    expect(result[0].previewHref).toBe(
      "https://dev.openveda.cloud/api/raster/collections/rgb-col/items/rgb-scene-1/preview.png?assets=rgb&bidx=1&bidx=2&bidx=3&rescale=0%2C255",
    );
  });

  it("falls back to a plain cog_default preview when the collection has no renders", async () => {
    mockFetchRoutes({
      "/items?": ITEMS,
      "/collections/no2-monthly": { id: "no2-monthly" },
    });
    const result = await listItems("no2-monthly");
    expect(result[0].previewHref).toBe(
      "https://dev.openveda.cloud/api/raster/collections/no2-monthly/items/OMI_202312/preview.png?assets=cog_default",
    );
  });

  it("forwards bbox and datetime to the items request", async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ITEMS,
      text: async () => JSON.stringify(ITEMS),
    }));
    vi.stubGlobal("fetch", fetchFn);
    await listItems("no2-monthly", {
      limit: 3,
      bbox: [-100, 20, -90, 30],
      datetime: "2023-01-01T00:00:00Z/2023-12-31T00:00:00Z",
    });
    const itemsUrl = fetchFn.mock.calls[0][0] as string;
    expect(itemsUrl).toContain("limit=3");
    expect(itemsUrl).toContain("bbox=-100%2C20%2C-90%2C30");
    expect(itemsUrl).toContain("datetime=2023-01-01T00%3A00%3A00Z%2F2023-12-31T00%3A00%3A00Z");
  });

  it("throws on a non-ok items response", async () => {
    mockFetch({ detail: "not found" }, false, 404);
    await expect(listItems("bogus")).rejects.toThrow(/404/);
  });
});

const MAP_COLLECTION_META = {
  ...COLLECTION_META,
  extent: {
    spatial: { bbox: [[-180, -90, 180, 90]] },
    temporal: { interval: [["2016-01-01 00:00:00+00", "2023-12-31 00:00:00+00"]] },
  },
};

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
