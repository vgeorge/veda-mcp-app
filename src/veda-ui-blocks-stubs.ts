// Build-time stub for veda-ui-blocks' map/query/carousel dependencies.
// The package's flat dist/index.js imports maplibre-gl, react-map-gl,
// @tanstack/react-query, @developmentseed/stac-react, embla-carousel-react and
// (dynamically) mapbox-gl-compare at module scope, which drags ~1 MB of map JS
// into the bundle even though this app only renders card components. Vite
// aliases those modules here (see vite.config.ts). Rendering a map component
// with these stubs would break — remove the alias for the map iteration.
export default {};
export const Layer = undefined;
export const Map = undefined;
export const NavigationControl = undefined;
export const Source = undefined;
export const useControl = undefined;
export const useQuery = undefined;
export const StacApiProvider = undefined;
export const useCollection = undefined;
