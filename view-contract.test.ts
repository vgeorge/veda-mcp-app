import { describe, expect, it } from "vitest";
import {
  encodeViewResult,
  parseCollectionsView,
  parseMapResourceView,
  parseMapView,
  recoverView,
  type View,
} from "./view-contract.js";

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
    expect(() => parseCollectionsView(MAP)).toThrow(
      /Unexpected result from server/,
    );
  });

  it("strips unknown keys so an older UI tolerates a newer server", () => {
    const view = parseCollectionsView({
      kind: "collections",
      collections: [{ ...COLLECTION, futureField: "ignored" }],
      futureTopLevel: 42,
    });
    expect(view).toEqual({ kind: "collections", collections: [COLLECTION] });
  });

  it("throws on a missing required field, naming the path", () => {
    expect(() => parseCollectionsView({ kind: "collections" })).toThrow(
      /collections/,
    );
  });

  it("throws on absent structuredContent", () => {
    expect(() => parseCollectionsView(undefined)).toThrow(
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
    const view: View = { kind: "collections", collections: [COLLECTION] };
    const result = encodeViewResult("VEDA STAC collections", view);
    expect(result.structuredContent).toBe(view);
    // Exactly two text blocks, in order: the model reads block 0, hosts that
    // strip structuredContent recover the view from block 1.
    expect(result.content).toEqual([
      { type: "text", text: "VEDA STAC collections" },
      { type: "text", text: JSON.stringify(view) },
    ]);
  });
});

describe("recoverView", () => {
  const parse = parseCollectionsView;
  const view = { kind: "collections", collections: [COLLECTION] };

  it("recovers from structuredContent when present", () => {
    const r = recoverView({ structuredContent: view, content: [] }, parse);
    expect(r.view).toEqual(view);
  });

  it("surfaces the contract error for a non-conforming structuredContent", () => {
    const r = recoverView({ structuredContent: { kind: "collections" } }, parse);
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
