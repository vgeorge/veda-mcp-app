// Build-time stub for veda-ui-blocks dependencies not needed by a given view
// entry. The package's flat dist/index.js imports every optional dep at module
// scope, so without a vite alias (see vite.config.ts) they all land in every
// bundle. The map entry stubs only mapbox-gl-compare (StacCompareMap) and
// embla-carousel-react (Carousel); the picker/items entries additionally stub
// the map stack (maplibre-gl, react-map-gl, react-query, stac-react).
// Rendering a component whose deps are stubbed breaks — the entry must not
// mount it.
export default {};
export const Layer = undefined;
export const Map = undefined;
export const NavigationControl = undefined;
export const Source = undefined;
export const useControl = undefined;
export const useQuery = undefined;
export const StacApiProvider = undefined;
export const useCollection = undefined;
