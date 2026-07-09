import { describe, expect, it } from "vitest";
import { parseView } from "./view-contract.js";

const ITEM = {
  id: "OMI_202312",
  start: "2023-12-01T00:00:00Z",
  end: "2023-12-31T00:00:00Z",
  previewHref: "https://dev.openveda.cloud/api/raster/preview.png",
  cogHref: "s3://bucket/OMI_202312.tif",
  bbox: [-180, -90, 180, 90],
};

describe("parseView", () => {
  it("parses a collections view", () => {
    const view = parseView({
      kind: "collections",
      collections: [
        { id: "no2-monthly", title: "NO2", description: "Nitrogen dioxide" },
        { id: "hls-swir", title: "HLS SWIR", description: null },
      ],
    });
    expect(view).toEqual({
      kind: "collections",
      collections: [
        { id: "no2-monthly", title: "NO2", description: "Nitrogen dioxide" },
        { id: "hls-swir", title: "HLS SWIR", description: null },
      ],
    });
  });

  it("parses an items view with the demo flag", () => {
    const view = parseView({
      kind: "items",
      collectionId: "no2-monthly",
      demo: true,
      items: [ITEM],
    });
    expect(view).toEqual({
      kind: "items",
      collectionId: "no2-monthly",
      demo: true,
      items: [ITEM],
    });
  });

  it("strips unknown keys so an older UI tolerates a newer server", () => {
    const view = parseView({
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

  it("throws on an unknown kind", () => {
    expect(() => parseView({ kind: "map", tiles: [] })).toThrow(
      /Unexpected result from server/,
    );
  });

  it("throws on a missing required field, naming the path", () => {
    expect(() =>
      parseView({ kind: "items", items: [ITEM] }),
    ).toThrow(/collectionId/);
  });

  it("throws on absent structuredContent", () => {
    expect(() => parseView(undefined)).toThrow(/Unexpected result from server/);
  });
});
