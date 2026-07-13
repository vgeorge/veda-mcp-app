import { describe, expect, it } from "vitest";
import {
  encodeViewResult,
  parseCollectionsView,
  parseItemsView,
  parseMapResourceView,
  parseMapView,
  recoverView,
  type View,
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

describe("encodeViewResult", () => {
  it("carries the view as structuredContent plus a duplicate JSON text block", () => {
    const view: View = { kind: "items", collectionId: "no2-monthly", items: [ITEM] };
    const result = encodeViewResult("Items in no2-monthly", view);
    expect(result.structuredContent).toBe(view);
    // Exactly two text blocks, in order: the model reads block 0, hosts that
    // strip structuredContent recover the view from block 1.
    expect(result.content).toEqual([
      { type: "text", text: "Items in no2-monthly" },
      { type: "text", text: JSON.stringify(view) },
    ]);
  });
});

describe("recoverView", () => {
  const parse = parseItemsView;
  const view = { kind: "items", collectionId: "no2-monthly", items: [ITEM] };

  it("recovers from structuredContent when present", () => {
    const r = recoverView({ structuredContent: view, content: [] }, parse);
    expect(r.view).toEqual(view);
  });

  it("surfaces the contract error for a non-conforming structuredContent", () => {
    const r = recoverView({ structuredContent: { kind: "items" } }, parse);
    expect(r.error).toMatch(/Unexpected result from server/);
  });

  it("recovers from a JSON text block when structuredContent is stripped", () => {
    const r = recoverView(
      {
        content: [
          { type: "text", text: "placeholder the host substituted" },
          { type: "text", text: JSON.stringify(view) },
        ],
      },
      parse,
    );
    expect(r.view).toEqual(view);
  });

  it("surfaces the tool's error text for an isError result", () => {
    const r = recoverView(
      { isError: true, content: [{ type: "text", text: "Collection not found." }] },
      parse,
    );
    expect(r.error).toBe("Collection not found.");
  });

  it("reports missing view data for a non-error result with no view", () => {
    const r = recoverView({ content: [{ type: "text", text: "hi" }] }, parse);
    expect(r.error).toBe("The server returned no view data.");
  });
});

describe("wire round-trip with structuredContent stripped (Claude Desktop)", () => {
  const cases: { name: string; view: View; parse: (sc: unknown) => View }[] = [
    {
      name: "collections",
      view: { kind: "collections", collections: [COLLECTION] },
      parse: parseCollectionsView,
    },
    {
      name: "items",
      view: { kind: "items", collectionId: "no2-monthly", items: [ITEM] },
      parse: parseItemsView,
    },
    { name: "map", view: MAP as View, parse: parseMapResourceView },
    { name: "compare", view: COMPARE as View, parse: parseMapResourceView },
  ];

  for (const { name, view, parse } of cases) {
    it(`recovers the ${name} view from the text blocks alone`, () => {
      const { content } = encodeViewResult("human summary", view);
      const r = recoverView({ content }, parse);
      expect(r.view).toEqual(view);
    });
  }
});

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
