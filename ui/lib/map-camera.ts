// Rough camera fit for a collection's spatial extent in the ~425px panel:
// zoom so the bbox's larger dimension fills the view (global -> zoom 0).
export function viewStateFromBbox(bbox: number[] | null) {
  if (!bbox || bbox.length < 4) return undefined;
  const [west, south, east, north] = bbox;
  const span = Math.max(east - west, (north - south) * 2, 1);
  return {
    longitude: (west + east) / 2,
    latitude: (south + north) / 2,
    zoom: Math.max(0, Math.min(8, Math.log2(360 / span))),
  };
}
