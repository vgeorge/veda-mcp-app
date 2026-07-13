// Shared fetch mocks + STAC fixtures for the stac and dashboard-render suites.
import { vi } from "vitest";

export function mockFetch(payload: unknown, ok = true, status = 200) {
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
export function mockFetchRoutes(routes: Record<string, unknown>) {
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

export const COLLECTION_META = {
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

export const MAP_COLLECTION_META = {
  ...COLLECTION_META,
  extent: {
    spatial: { bbox: [[-180, -90, 180, 90]] },
    temporal: { interval: [["2016-01-01 00:00:00+00", "2023-12-31 00:00:00+00"]] },
  },
};

// A collection whose dashboard render names an asset that IS present on items
// (unlike no2, which names "no2" but items only expose cog_default).
export const RGB_COLLECTION_META = {
  id: "rgb-col",
  renders: { dashboard: { assets: ["rgb"], bidx: [1, 2, 3], rescale: [[0, 255]] } },
};

export const RGB_ITEMS = {
  type: "FeatureCollection",
  features: [
    {
      id: "rgb-scene-1",
      properties: { start_datetime: "2024-01-01T00:00:00Z", end_datetime: "2024-01-02T00:00:00Z" },
      assets: { rgb: { href: "s3://bucket/rgb-scene-1.tif" } },
    },
  ],
};

export const ITEMS = {
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
