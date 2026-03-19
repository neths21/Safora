/**
 * routeService.js  (v3 — OpenStreetMap / OSRM edition)
 *
 * 100% free, no API key required.
 *
 * APIs used:
 *  • OSRM Demo Server  https://router.project-osrm.org
 *    (or self-hosted — change OSRM_BASE_URL)
 *  • OpenRouteService  https://openrouteservice.org  (free-tier fallback)
 *    Requires a free API key if you want the ORS fallback.
 *
 * Edge cases handled:
 *  1. No API key needed       → OSRM is fully open; ORS fallback uses free tier
 *  2. Network failure         → exponential-backoff retry (3 attempts)
 *  3. OSRM server timeout     → hard per-request timeout + fallback to ORS
 *  4. Sparse polyline         → coordinate interpolation fills gaps > 30 m
 *                               (critical for accurate deviation detection on curves)
 *  5. Route too short         → guard against same-point or <10 m routes
 *  6. Malformed OSRM response → defensive parsing at every level
 *  7. In-memory cache         → skip API call for repeated origin/dest pairs
 *  8. Multi-profile support   → driving (default), cycling, walking
 *  9. ORS polyline format     → ORS returns [lng, lat] pairs; we normalise to
 *                               { latitude, longitude } consistently
 */

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * OSRM public demo server — free, no key needed.
 * For production: spin up your own OSRM instance or use a paid tier.
 * Docker: https://hub.docker.com/r/osrm/osrm-backend
 */
const OSRM_BASE_URL = "https://router.project-osrm.org";

/**
 * OpenRouteService fallback (free tier: 2 000 req/day).
 * Sign up at https://openrouteservice.org/dev/#/signup
 * Leave blank ("") to disable the ORS fallback entirely.
 */
const ORS_API_KEY = process.env.ORS_API_KEY || "";

/** OSRM profile strings */
const OSRM_PROFILES = {
  driving: "driving",
  cycling: "cycling",
  walking: "foot",
};

/** ORS profile strings */
const ORS_PROFILES = {
  driving: "driving-car",
  cycling: "cycling-regular",
  walking: "foot-walking",
};

// ─── Tuneable constants ───────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS         = 10_000;
const MAX_RETRIES              = 3;
const RETRY_BASE_DELAY_MS      = 1_000;

/**
 * Maximum gap between consecutive route points before we interpolate.
 * OSRM returns dense geometry by default, but on long straight segments
 * you can still get 40–80 m gaps. Interpolating to ≤30 m means the
 * point-to-segment deviation check is accurate even on wide roads.
 */
const MAX_SEGMENT_GAP_METERS   = 30;

// ─── In-memory cache ─────────────────────────────────────────────────────────

const _routeCache = new Map();

const _cacheKey = (origin, dest, profile) =>
  `${profile}:${origin.latitude.toFixed(5)},${origin.longitude.toFixed(5)}` +
  `→${dest.latitude.toFixed(5)},${dest.longitude.toFixed(5)}`;

// ─── Math helpers ─────────────────────────────────────────────────────────────

const _toRad = (d) => (d * Math.PI) / 180;

const _haversine = (a, b) => {
  const R = 6_371_000;
  const dLat = _toRad(b.latitude - a.latitude);
  const dLng = _toRad(b.longitude - a.longitude);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(_toRad(a.latitude)) * Math.cos(_toRad(b.latitude)) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

/**
 * Linear interpolation between two lat/lng points.
 * Inserts intermediate points so no segment exceeds MAX_SEGMENT_GAP_METERS.
 *
 * Why this matters: if two waypoints are 80 m apart, a rider at the midpoint
 * could appear "100 m off-route" with a naïve point-only Haversine check.
 * Dense interpolation eliminates this false-positive entirely.
 */
const _interpolateSegment = (a, b) => {
  const dist = _haversine(a, b);
  if (dist <= MAX_SEGMENT_GAP_METERS) return []; // No interpolation needed

  const steps = Math.ceil(dist / MAX_SEGMENT_GAP_METERS);
  const pts   = [];

  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    pts.push({
      latitude:  a.latitude  + t * (b.latitude  - a.latitude),
      longitude: a.longitude + t * (b.longitude - a.longitude),
    });
  }

  return pts;
};

/**
 * Walk the coordinate array and densify any segments that exceed the gap limit.
 */
const _densifyRoute = (coords) => {
  if (coords.length < 2) return coords;

  const dense = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    const interpolated = _interpolateSegment(coords[i - 1], coords[i]);
    dense.push(...interpolated, coords[i]);
  }

  return dense;
};

// ─── Network helpers ──────────────────────────────────────────────────────────

const _fetchWithTimeout = (url, options, ms) => {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() =>
    clearTimeout(timer)
  );
};

const _withRetry = async (label, fn) => {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (err.message.startsWith("ROUTE_")) throw err; // logical error — don't retry
      const delay = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      console.warn(
        `[RouteService] ${label} — attempt ${attempt}/${MAX_RETRIES} failed ` +
          `(${err.message}). Retrying in ${delay} ms...`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error(`[RouteService] ${label} failed after ${MAX_RETRIES} attempts: ${lastErr.message}`);
};

// ─── Input validation ─────────────────────────────────────────────────────────

const _validateCoord = (c, label) => {
  if (
    !c ||
    typeof c.latitude  !== "number" || isNaN(c.latitude)  ||
    typeof c.longitude !== "number" || isNaN(c.longitude) ||
    Math.abs(c.latitude)  > 90  ||
    Math.abs(c.longitude) > 180
  ) {
    throw new Error(
      `ROUTE_INVALID_INPUT: "${label}" has invalid coordinates: ${JSON.stringify(c)}`
    );
  }
};

// ─── OSRM fetcher ─────────────────────────────────────────────────────────────

/**
 * Call OSRM Route API.
 *
 * OSRM response geometry format (with overview=full&geometries=geojson):
 *   routes[0].geometry.coordinates  →  [[lng, lat], [lng, lat], ...]
 *
 * Note the [longitude, latitude] ordering — GeoJSON convention, opposite
 * of what the rest of our app uses. We normalise here.
 *
 * @param {{latitude,longitude}} origin
 * @param {{latitude,longitude}} destination
 * @param {string} profile  "driving" | "cycling" | "foot"
 * @returns {Promise<{latitude,longitude}[]>}
 */
const _fetchFromOSRM = async (origin, destination, profile) => {
  // OSRM URL format: /route/v1/{profile}/{lng,lat};{lng,lat}
  const coords =
    `${origin.longitude},${origin.latitude};` +
    `${destination.longitude},${destination.latitude}`;

  const url =
    `${OSRM_BASE_URL}/route/v1/${profile}/${coords}` +
    `?overview=full&geometries=geojson&steps=true`;

  console.log(`[RouteService] Calling OSRM (${profile}): ${url}`);

  const data = await _withRetry("OSRM fetch", async () => {
    let res;
    try {
      res = await _fetchWithTimeout(url, {}, FETCH_TIMEOUT_MS);
    } catch (err) {
      if (err.name === "AbortError") throw new Error("OSRM request timed out.");
      throw new Error(`NETWORK_ERROR: ${err.message}`);
    }
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
    return res.json();
  });

  // OSRM status codes
  if (data.code !== "Ok") {
    const knownCodes = {
      NoRoute:   "ROUTE_ZERO_RESULTS: No route between these points (may be disconnected road network).",
      NoSegment: "ROUTE_NO_SEGMENT: Coordinates could not be snapped to a road.",
      InvalidUrl:"ROUTE_INVALID_INPUT: OSRM rejected the request URL.",
    };
    throw new Error(
      knownCodes[data.code] ||
        `ROUTE_ERROR: OSRM returned code "${data.code}" — ${data.message ?? "no detail"}.`
    );
  }

  if (!data.routes?.length || !data.routes[0].geometry?.coordinates?.length) {
    throw new Error("ROUTE_EMPTY: OSRM returned OK but geometry is empty.");
  }

  // GeoJSON → { latitude, longitude } — note: GeoJSON is [lng, lat]
  const raw = data.routes[0].geometry.coordinates.map(([lng, lat]) => ({
    latitude: lat,
    longitude: lng,
  }));

  console.log(`[RouteService] OSRM returned ${raw.length} raw geometry points.`);
  return raw;
};

// ─── ORS fallback fetcher ─────────────────────────────────────────────────────

/**
 * OpenRouteService fallback — used when OSRM fails and ORS_API_KEY is set.
 *
 * ORS directions v2 response:
 *   features[0].geometry.coordinates  →  [[lng, lat], ...]
 */
const _fetchFromORS = async (origin, destination, profile) => {
  if (!ORS_API_KEY) {
    throw new Error(
      "ROUTE_NO_FALLBACK: OSRM failed and ORS_API_KEY is not set. " +
        "Either self-host OSRM or provide an ORS API key."
    );
  }

  const orsProfile = ORS_PROFILES[profile] ?? ORS_PROFILES.driving;
  const url = `https://api.openrouteservice.org/v2/directions/${orsProfile}/geojson`;

  console.log(`[RouteService] Falling back to OpenRouteService (${orsProfile})...`);

  const body = JSON.stringify({
    coordinates: [
      [origin.longitude,      origin.latitude],
      [destination.longitude, destination.latitude],
    ],
  });

  const data = await _withRetry("ORS fetch", async () => {
    let res;
    try {
      res = await _fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: ORS_API_KEY,
          },
          body,
        },
        FETCH_TIMEOUT_MS
      );
    } catch (err) {
      if (err.name === "AbortError") throw new Error("ORS request timed out.");
      throw new Error(`NETWORK_ERROR: ${err.message}`);
    }

    if (res.status === 403) throw new Error("ROUTE_REQUEST_DENIED: ORS API key invalid or quota exceeded.");
    if (!res.ok) throw new Error(`ORS HTTP ${res.status}`);
    return res.json();
  });

  if (!data.features?.length || !data.features[0].geometry?.coordinates?.length) {
    throw new Error("ROUTE_EMPTY: ORS returned no geometry.");
  }

  // GeoJSON → { latitude, longitude }
  const raw = data.features[0].geometry.coordinates.map(([lng, lat]) => ({
    latitude: lat,
    longitude: lng,
  }));

  console.log(`[RouteService] ORS returned ${raw.length} raw geometry points.`);
  return raw;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch a route using OpenStreetMap / OSRM (primary) with ORS fallback.
 * Returns a densified array of { latitude, longitude } coordinates.
 *
 * No API key required for the primary OSRM path.
 *
 * @param {{latitude: number, longitude: number}} origin
 * @param {{latitude: number, longitude: number}} destination
 * @param {"driving"|"cycling"|"walking"} [profile="driving"]
 * @returns {Promise<{latitude: number, longitude: number}[]>}
 */
export const getRoute = async (origin, destination, profile = "driving") => {
  // ── 1. Validate ───────────────────────────────────────────────────────────
  _validateCoord(origin,      "origin");
  _validateCoord(destination, "destination");

  if (_haversine(origin, destination) < 10) {
    throw new Error(
      "ROUTE_INVALID_INPUT: Origin and destination are less than 10 m apart."
    );
  }

  const osrmProfile = OSRM_PROFILES[profile] ?? OSRM_PROFILES.driving;

  // ── 2. Cache check ────────────────────────────────────────────────────────
  const key = _cacheKey(origin, destination, profile);
  if (_routeCache.has(key)) {
    const cached = _routeCache.get(key);
    console.log(
      `[RouteService] Cache hit (${key}) — ${cached.length} points, skipping API.`
    );
    return cached;
  }

  // ── 3. Primary: OSRM ──────────────────────────────────────────────────────
  let rawCoords;
  try {
    rawCoords = await _fetchFromOSRM(origin, destination, osrmProfile);
  } catch (osrmErr) {
    console.error(`[RouteService] OSRM failed: ${osrmErr.message}`);

    // ── 4. Fallback: ORS ───────────────────────────────────────────────────
    console.warn("[RouteService] Attempting ORS fallback...");
    try {
      rawCoords = await _fetchFromORS(origin, destination, profile);
    } catch (orsErr) {
      // Both failed — throw the more informative error
      throw new Error(
        `[RouteService] Both routing providers failed.\n` +
          `  OSRM: ${osrmErr.message}\n` +
          `  ORS:  ${orsErr.message}`
      );
    }
  }

  // ── 5. Densify ────────────────────────────────────────────────────────────
  const dense = _densifyRoute(rawCoords);
  console.log(
    `[RouteService] Route densified: ${rawCoords.length} → ${dense.length} points ` +
      `(gap ≤ ${MAX_SEGMENT_GAP_METERS} m).`
  );

  // ── 6. Cache & return ──────────────────────────────────────────────────────
  _routeCache.set(key, dense);
  console.log(`[RouteService] ✅ Route ready — ${dense.length} points cached.`);

  return dense;
};

/** Clear route cache (call at the start of every new ride). */
export const clearRouteCache = () => {
  _routeCache.clear();
  console.log("[RouteService] Cache cleared.");
};

/**
 * Expose the haversine helper for use in tests / rideMonitor
 * without creating a cross-import from deviationService.
 */
export { _haversine as haversineDistance };
