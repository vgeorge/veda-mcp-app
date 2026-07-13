import { afterEach, describe, expect, it, vi } from "vitest";
import { searchCollections, _resetCaches } from "./stac.js";
import { mockFetch } from "./test-helpers.js";

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

describe("fetch failures", () => {
  it("throws on a non-ok collections response", async () => {
    mockFetch({ detail: "not found" }, false, 404);
    await expect(searchCollections()).rejects.toThrow(/404/);
  });
});
