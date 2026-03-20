/**
 * routeService.js
 * Fetches driving routes using the free OSRM public API (no API key required).
 * Returns GeoJSON polyline coordinates suitable for react-native-maps Polyline.
 *
 * OSRM Endpoint:
 *   https://router.project-osrm.org/route/v1/driving/{lng},{lat};{lng},{lat}
 *   ?overview=full&geometries=geojson
 */

const OSRM_BASE_URL = "https://router.project-osrm.org/route/v1/driving";

/**
 * fetchRoute
 * Fetches the optimal driving route between two coordinates using OSRM.
 *
 * @param {Object} origin      - { latitude: number, longitude: number }
 * @param {Object} destination - { latitude: number, longitude: number }
 * @returns {Promise<Array<{ latitude: number, longitude: number }>>}
 *          Array of coordinate objects for use with react-native-maps <Polyline>
 */
export const fetchRoute = async (origin, destination) => {
  if (!origin || !destination) {
    throw new Error("[RouteService] Origin and destination are required.");
  }

  // OSRM expects coordinates in {longitude},{latitude} order
  const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const url = `${OSRM_BASE_URL}/${coords}?overview=full&geometries=geojson`;

  console.log("[RouteService] Fetching route from OSRM:", url);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`[RouteService] OSRM request failed with status: ${response.status}`);
  }

  const data = await response.json();

  // Validate response structure
  if (
    !data.routes ||
    data.routes.length === 0 ||
    !data.routes[0].geometry ||
    !data.routes[0].geometry.coordinates
  ) {
    throw new Error("[RouteService] No valid route found in OSRM response.");
  }

  // OSRM GeoJSON coordinates are [longitude, latitude] arrays
  // Convert to { latitude, longitude } objects for react-native-maps
  const rawCoords = data.routes[0].geometry.coordinates;
  const polylineCoords = rawCoords.map(([lng, lat]) => ({
    latitude: lat,
    longitude: lng,
  }));

  console.log(`[RouteService] Route fetched. ${polylineCoords.length} waypoints.`);

  return polylineCoords;
};

/**
 * getRouteSummary
 * Returns distance (km) and duration (min) for a route — useful for UI display.
 *
 * @param {Object} origin
 * @param {Object} destination
 * @returns {Promise<{ distanceKm: number, durationMin: number, polyline: Array }>}
 */
export const getRouteSummary = async (origin, destination) => {
  const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const url = `${OSRM_BASE_URL}/${coords}?overview=full&geometries=geojson`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`[RouteService] OSRM request failed: ${response.status}`);
  }

  const data = await response.json();

  if (!data.routes || data.routes.length === 0) {
    throw new Error("[RouteService] No route found.");
  }

  const route = data.routes[0];
  const distanceKm = (route.distance / 1000).toFixed(2);    // meters → km
  const durationMin = (route.duration / 60).toFixed(1);     // seconds → minutes

  const polyline = route.geometry.coordinates.map(([lng, lat]) => ({
    latitude: lat,
    longitude: lng,
  }));

  return { distanceKm, durationMin, polyline };
};