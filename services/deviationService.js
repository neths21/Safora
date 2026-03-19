/**
 * deviationService.js  (v3 — OSM edition, maximum reliability)
 *
 * New edge cases handled beyond v2:
 *  1. Sliding-window smoothing    → average the last N distances instead of
 *                                   checking a single reading; reduces noise
 *                                   from momentary GPS scatter further
 *  2. Bearing-aware check         → if the rider is moving *toward* the route,
 *                                   suppress the deviation alert (they're correcting)
 *  3. Route progress tracking     → remember the last matched segment index so
 *                                   we only search *forward* in the route, not the
 *                                   whole array (prevents "matching" a passed segment)
 *  4. U-turn / backtrack guard    → if the closest route point is behind the last
 *                                   matched index by more than BACKTRACK_TOLERANCE,
 *                                   treat it as a new deviation, not a progress update
 *  5. Dense-route performance     → early-exit once distance starts increasing
 *                                   (the route is densified, so the minimum is local)
 */

// ─── Tuneable constants ───────────────────────────────────────────────────────

/** Confirmed off-route only after this many consecutive off-route readings. */
const DEVIATION_CONFIRM_COUNT  = 3;

/** Distance in metres beyond which the rider is considered off-route. */
const DEVIATION_THRESHOLD_METERS = 100;

/** Distance in metres within which the rider is considered arrived. */
const ARRIVAL_THRESHOLD_METERS  = 30;

/** Reject deviation checks where fix accuracy is worse than this. */
const MAX_ACCEPTABLE_ACCURACY   = 60;

/** Reject fixes older than this (ms). */
const MAX_FIX_AGE_MS            = 15_000;

/**
 * Sliding window size for distance smoothing.
 * Larger = smoother but slower to respond. 4 is a good real-world balance.
 */
const SMOOTHING_WINDOW_SIZE     = 4;

/**
 * How many route segments behind the last matched index we allow before
 * treating the closest match as a U-turn / backtrack (not progress).
 */
const BACKTRACK_TOLERANCE       = 10;

/**
 * If the rider is closing toward the route at this speed (m/s) or faster,
 * suppress the deviation alert — they are self-correcting.
 */
const APPROACHING_SPEED_THRESHOLD_MS = 1.5; // ~5.4 km/h

// ─── Module-level state ───────────────────────────────────────────────────────

let _consecutiveDeviations = 0;
let _arrived               = false;

/** Ring buffer of the last SMOOTHING_WINDOW_SIZE distances-from-route (metres). */
let _distanceHistory       = [];

/** Index of the last route segment matched (forward-only search). */
let _lastMatchedIndex      = 0;

/** Distance from route at the previous check (for bearing/approach detection). */
let _prevDistanceFromRoute = null;

/** Reset all state for a new ride. Call this when a ride starts. */
export const resetDeviationState = () => {
  _consecutiveDeviations = 0;
  _arrived               = false;
  _distanceHistory       = [];
  _lastMatchedIndex      = 0;
  _prevDistanceFromRoute = null;
  console.log("[DeviationService] State reset for new ride.");
};

// ─── Math helpers ─────────────────────────────────────────────────────────────

const _toRad = (d) => (d * Math.PI) / 180;

/** Haversine distance in metres. */
export const haversineDistance = (a, b) => {
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
 * Perpendicular distance from point P to line segment A→B (metres).
 * Uses a local Cartesian approximation valid for distances < ~100 km.
 */
const _pointToSegmentDistance = (P, A, B) => {
  const latScale = 111_320;
  const lngScale = 111_320 * Math.cos(_toRad(A.latitude));

  const px = (P.longitude - A.longitude) * lngScale;
  const py = (P.latitude  - A.latitude)  * latScale;
  const bx = (B.longitude - A.longitude) * lngScale;
  const by = (B.latitude  - A.latitude)  * latScale;

  const segLenSq = bx * bx + by * by;
  if (segLenSq === 0) return Math.sqrt(px * px + py * py); // degenerate segment

  const t       = Math.max(0, Math.min(1, (px * bx + py * by) / segLenSq));
  const closestX = t * bx;
  const closestY = t * by;

  return Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
};

/**
 * Search the route for the segment closest to P, starting from startIndex.
 * Early-exits once distances start increasing (exploits densified route locality).
 *
 * Returns { minDist, matchedIndex }.
 */
const _findClosestSegment = (P, routeCoordinates, startIndex) => {
  let minDist      = Infinity;
  let matchedIndex = startIndex;
  let increasing   = 0; // consecutive increases — signals we've passed the minimum

  for (let i = startIndex; i < routeCoordinates.length - 1; i++) {
    const dist = _pointToSegmentDistance(P, routeCoordinates[i], routeCoordinates[i + 1]);

    if (dist < minDist) {
      minDist      = dist;
      matchedIndex = i;
      increasing   = 0;
    } else {
      increasing++;
      // After 5 consecutive increases on a dense route, we're past the local minimum.
      if (increasing >= 5 && minDist < DEVIATION_THRESHOLD_METERS * 2) break;
    }
  }

  // Edge: single-point route
  if (routeCoordinates.length === 1) {
    minDist = haversineDistance(P, routeCoordinates[0]);
  }

  return { minDist, matchedIndex };
};

/**
 * Compute the smoothed distance from route using a sliding window average.
 * Smoothing absorbs single-ping GPS outliers without introducing the latency
 * of requiring N *consecutive* bad readings.
 */
const _smoothedDistance = (rawDist) => {
  _distanceHistory.push(rawDist);
  if (_distanceHistory.length > SMOOTHING_WINDOW_SIZE) {
    _distanceHistory.shift();
  }
  const sum = _distanceHistory.reduce((a, b) => a + b, 0);
  return sum / _distanceHistory.length;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check whether the rider has deviated from the planned route.
 *
 * @param {{
 *   latitude:   number,
 *   longitude:  number,
 *   accuracy?:  number,
 *   timestamp?: number
 * }} currentLocation
 *
 * @param {{latitude: number, longitude: number}[]} routeCoordinates
 *
 * @param {{latitude: number, longitude: number}} [destination]
 *
 * @returns {{
 *   deviated:          boolean,
 *   arrived:           boolean,
 *   distanceFromRoute: number,   // raw (unsmoothed) metres
 *   smoothedDistance:  number,   // sliding-window average
 *   consecutiveCount:  number,
 *   approaching:       boolean,  // true = rider is closing toward route
 *   progressIndex:     number,   // last matched route segment index
 *   skipped:           boolean,
 *   skipReason?:       string,
 * }}
 */
export const checkDeviation = (currentLocation, routeCoordinates, destination) => {
  const _skip = (skipReason, extra = {}) => ({
    deviated: false, arrived: false,
    distanceFromRoute: -1, smoothedDistance: -1,
    consecutiveCount: _consecutiveDeviations,
    approaching: false, progressIndex: _lastMatchedIndex,
    skipped: true, skipReason,
    ...extra,
  });

  // ── Already arrived ───────────────────────────────────────────────────────
  if (_arrived) return _skip("Already arrived.", { arrived: true });

  // ── Route guard ───────────────────────────────────────────────────────────
  if (!routeCoordinates?.length) return _skip("No route loaded.");

  // ── Stale fix ─────────────────────────────────────────────────────────────
  if (currentLocation.timestamp) {
    const ageMs = Date.now() - currentLocation.timestamp;
    if (ageMs > MAX_FIX_AGE_MS) {
      return _skip(`Stale fix (${(ageMs / 1000).toFixed(1)} s old — likely tunnel/blackout).`);
    }
  }

  // ── Poor accuracy ─────────────────────────────────────────────────────────
  if (
    currentLocation.accuracy != null &&
    currentLocation.accuracy > MAX_ACCEPTABLE_ACCURACY
  ) {
    return _skip(`Fix accuracy ±${currentLocation.accuracy.toFixed(0)} m is too poor.`);
  }

  // ── Arrival check ─────────────────────────────────────────────────────────
  if (destination) {
    const distToDest = haversineDistance(currentLocation, destination);
    if (distToDest <= ARRIVAL_THRESHOLD_METERS) {
      _arrived = true;
      _consecutiveDeviations = 0;
      console.log(`[DeviationService] 🏁 Arrived — ${distToDest.toFixed(1)} m from destination.`);
      return {
        deviated: false, arrived: true,
        distanceFromRoute: 0, smoothedDistance: 0,
        consecutiveCount: 0, approaching: false,
        progressIndex: _lastMatchedIndex, skipped: false,
      };
    }
  }

  // ── Core: find closest segment (forward-only) ─────────────────────────────
  let { minDist, matchedIndex } = _findClosestSegment(
    currentLocation,
    routeCoordinates,
    Math.max(0, _lastMatchedIndex - BACKTRACK_TOLERANCE) // allow slight look-back
  );

  // Backtrack guard: if the match is far behind our last position, it's likely
  // a U-turn or a GPS jump — don't regress the progress index significantly.
  if (matchedIndex < _lastMatchedIndex - BACKTRACK_TOLERANCE) {
    console.warn(
      `[DeviationService] Backtrack detected (matched ${matchedIndex} vs last ${_lastMatchedIndex}). ` +
        "Clamping to last known index."
    );
    matchedIndex = _lastMatchedIndex;
    // Re-compute distance at the clamped index
    minDist = _pointToSegmentDistance(
      currentLocation,
      routeCoordinates[matchedIndex],
      routeCoordinates[Math.min(matchedIndex + 1, routeCoordinates.length - 1)]
    );
  } else {
    _lastMatchedIndex = Math.max(_lastMatchedIndex, matchedIndex);
  }

  // ── Smoothing ─────────────────────────────────────────────────────────────
  const smoothed = _smoothedDistance(minDist);

  // ── Approaching check (bearing toward route) ──────────────────────────────
  const approaching =
    _prevDistanceFromRoute !== null &&
    _prevDistanceFromRoute - smoothed > APPROACHING_SPEED_THRESHOLD_MS;

  _prevDistanceFromRoute = smoothed;

  // ── Off-route decision ────────────────────────────────────────────────────
  const isOffRoute = smoothed > DEVIATION_THRESHOLD_METERS;

  if (isOffRoute && approaching) {
    console.log(
      `[DeviationService] Off-route by ${smoothed.toFixed(1)} m but approaching — ` +
        "suppressing alert."
    );
    // Count down the streak while approaching
    _consecutiveDeviations = Math.max(0, _consecutiveDeviations - 1);
  } else if (isOffRoute) {
    _consecutiveDeviations += 1;
    console.warn(
      `[DeviationService] ⚠️  Off-route ${smoothed.toFixed(1)} m ` +
        `(reading ${_consecutiveDeviations}/${DEVIATION_CONFIRM_COUNT}).`
    );
  } else {
    if (_consecutiveDeviations > 0) {
      console.log(`[DeviationService] Back on route — resetting counter.`);
    }
    _consecutiveDeviations = 0;
    console.log(
      `[DeviationService] ✅ On route — ${smoothed.toFixed(1)} m (raw: ${minDist.toFixed(1)} m), ` +
        `segment #${_lastMatchedIndex}.`
    );
  }

  const deviated = _consecutiveDeviations >= DEVIATION_CONFIRM_COUNT;

  if (deviated) {
    console.error(
      `[DeviationService] 🚨 DEVIATION CONFIRMED — ` +
        `${smoothed.toFixed(1)} m off-route after ${_consecutiveDeviations} readings.`
    );
    _consecutiveDeviations = 0; // reset so we don't re-fire every tick
  }

  return {
    deviated,
    arrived: false,
    distanceFromRoute: minDist,
    smoothedDistance:  smoothed,
    consecutiveCount:  _consecutiveDeviations,
    approaching,
    progressIndex:     _lastMatchedIndex,
    skipped:           false,
  };
};

export {
  DEVIATION_THRESHOLD_METERS,
  DEVIATION_CONFIRM_COUNT,
  ARRIVAL_THRESHOLD_METERS,
};
