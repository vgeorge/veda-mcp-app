import { describe, expect, it } from "vitest";
import {
  parseCollectionsView,
  parseItemsView,
  parseMapResourceView,
  parseMapView,
} from "./view-contract.js";

const ITEM = {
  id: "OMI_202312",
  start: "2023-12-01T00:00:00Z",
  end: "2023-12-31T00:00:00Z",
  previewHref: "https://dev.openveda.cloud/api/raster/preview.png",
  cogHref: "s3://bucket/OMI_202312.tif",
  bbox: [-180, -90, 180, 90],
};

const COLLECTION = {
  id: "no2-monthly-diff",
  title: "NO2 (Diff)",
  description: "Nitrogen dioxide difference",
  temporal: { start: "2015-01-01", end: "2023-12-31" },
  thumbnailHref: "https://thumbnails.openveda.cloud/no2--dataset-cover.jpg",
};

const MAP = {
  kind: "map",
  collectionId: "no2-monthly-diff",
  collectionTitle: "NO2 (Diff)",
  renderKey: "dashboard",
  dateRange: { from: "2020-01-01", to: "2021-12-31" },
  bbox: [-180, -90, 180, 90],
  stacRoot: "https://dev.openveda.cloud/api/stac",
  rasterRoot: "https://dev.openveda.cloud/api/raster",
  demo: true,
};

describe("parseCollectionsView", () => {
  it("parses collections with temporal coverage (nullable)", () => {
    const view = parseCollectionsView({
      kind: "collections",
      collections: [
        COLLECTION,
        { id: "hls-swir", title: "HLS SWIR", description: null, temporal: null, thumbnailHref: null },
      ],
    });
    expect(view.collections).toEqual([
      COLLECTION,
      { id: "hls-swir", title: "HLS SWIR", description: null, temporal: null, thumbnailHref: null },
    ]);
  });

  it("rejects a different view kind", () => {
    expect(() =>
      parseCollectionsView({ kind: "items", collectionId: "x", items: [] }),
    ).toThrow(/Unexpected result from server/);
  });
});

describe("parseItemsView", () => {
  it("parses an items view", () => {
    const view = parseItemsView({
      kind: "items",
      collectionId: "no2-monthly",
      items: [ITEM],
    });
    expect(view).toEqual({
      kind: "items",
      collectionId: "no2-monthly",
      items: [ITEM],
    });
  });

  it("strips unknown keys so an older UI tolerates a newer server", () => {
    const view = parseItemsView({
      kind: "items",
      collectionId: "no2-monthly",
      items: [{ ...ITEM, futureField: "ignored" }],
      futureTopLevel: 42,
    });
    expect(view).toEqual({
      kind: "items",
      collectionId: "no2-monthly",
      items: [ITEM],
    });
  });

  it("throws on a missing required field, naming the path", () => {
    expect(() => parseItemsView({ kind: "items", items: [ITEM] })).toThrow(
      /collectionId/,
    );
  });

  it("throws on absent structuredContent", () => {
    expect(() => parseItemsView(undefined)).toThrow(
      /Unexpected result from server/,
    );
  });
});

describe("parseMapView", () => {
  it("parses a map view", () => {
    expect(parseMapView(MAP)).toEqual(MAP);
  });

  it("throws on a map view missing its date range", () => {
    const { dateRange: _dateRange, ...withoutRange } = MAP;
    expect(() => parseMapView(withoutRange)).toThrow(/dateRange/);
  });
});

const COMPARE = {
  kind: "compare",
  left: {
    collectionId: "no2-monthly-diff",
    collectionTitle: "NO2 2019",
    renderKey: "dashboard",
    dateRange: { from: "2019-01-01", to: "2019-12-31" },
  },
  right: {
    collectionId: "no2-monthly-diff",
    collectionTitle: "NO2 2021",
    renderKey: "dashboard",
    dateRange: { from: "2021-01-01", to: "2021-12-31" },
  },
  bbox: [-180, -90, 180, 90],
  stacRoot: "https://dev.openveda.cloud/api/stac",
  rasterRoot: "https://dev.openveda.cloud/api/raster",
};

describe("parseMapResourceView", () => {
  it("parses the single-layer (map) variant", () => {
    expect(parseMapResourceView(MAP)).toEqual(MAP);
  });

  it("parses the compare variant", () => {
    expect(parseMapResourceView(COMPARE)).toEqual(COMPARE);
  });

  it("throws on a compare view missing a side", () => {
    const { right: _right, ...withoutRight } = COMPARE;
    expect(() => parseMapResourceView(withoutRight)).toThrow(
      /Unexpected result from server/,
    );
  });
});
