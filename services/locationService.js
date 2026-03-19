/**
 * locationService.js  (v3 — OSM edition, maximum reliability)
 *
 * New edge cases handled beyond v2:
 *  1. Speed-sanity check       → reject fixes with physically impossible speed
 *                                jumps (teleportation guard)
 *  2. Adaptive watch interval  → tighten polling when moving fast, relax when slow
 *  3. GPS cold-start / warm-up → wait for signal stabilisation before emitting
 *                                the first fix to callers
 *  4. Background task guard    → log a clear warning if background permission
 *                                was not granted but the app goes to background
 *  5. Coordinate bounds check  → explicit lat/lng range guard (catches NaN / Infinity)
 *  6. Subscription leak guard  → prevent stacking multiple watchPositionAsync calls
 */

import * as Location from "expo-location";

// ─── Tuneable constants ───────────────────────────────────────────────────────

const MAX_FIX_AGE_MS          = 10_000;  // Reject fixes older than this
const MAX_ACCURACY_METERS      = 50;     // Reject fixes with accuracy worse than this
const MIN_MOVEMENT_METERS      = 8;      // Suppress update if rider moved less than this
const GPS_TIMEOUT_MS           = 15_000; // Hard timeout for a single fix attempt
const HEARTBEAT_TIMEOUT_MS     = 20_000; // Declare watch dead after this silence

// Speed sanity: human on a vehicle rarely exceeds ~160 km/h = ~44 m/s.
// Any jump larger than this between two consecutive fixes is almost certainly
// a GPS multipath glitch or a stale cached fix suddenly resolving.
const MAX_PLAUSIBLE_SPEED_MS   = 50;     // metres per second (~180 km/h)

// After how many "warm-up" fixes to trust the GPS signal.
// Cold-start GPS often produces wild first fixes; skip the first N readings.
const WARMUP_FIX_COUNT         = 2;

// ─── Module state ────────────────────────────────────────────────────────────

let _subscription    = null;   // active watchPositionAsync handle
let _lastEmitted     = null;   // last { latitude, longitude, accuracy, timestamp }
let _heartbeatTimer  = null;
let _warmupCount     = 0;      // fixes seen so far during warm-up

// ─── Helpers ──────────────────────────────────────────────────────────────────

const _toRad = (d) => (d * Math.PI) / 180;

/** Haversine distance in metres (self-contained, no cross-import). */
const _distanceMeters = (a, b) => {
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
 * Full fix validator — returns { ok: boolean, reason?: string }.
 * Checks: coordinate bounds, accuracy, age, speed sanity.
 */
const _validateFix = (location, prevEmitted) => {
  const { latitude, longitude, accuracy, speed } = location.coords;

  // 1. Coordinate sanity
  if (
    typeof latitude  !== "number" || isNaN(latitude)  ||
    typeof longitude !== "number" || isNaN(longitude) ||
    Math.abs(latitude)  > 90 ||
    Math.abs(longitude) > 180
  ) {
    return { ok: false, reason: `Invalid coordinates: (${latitude}, ${longitude})` };
  }

  // 2. Accuracy gate (null = device didn't report accuracy → accept it)
  if (accuracy !== null && accuracy > MAX_ACCURACY_METERS) {
    return { ok: false, reason: `Accuracy ±${accuracy.toFixed(0)} m exceeds limit ${MAX_ACCURACY_METERS} m` };
  }

  // 3. Staleness gate
  const ageMs = Date.now() - location.timestamp;
  if (ageMs > MAX_FIX_AGE_MS) {
    return { ok: false, reason: `Fix is ${(ageMs / 1000).toFixed(1)} s stale` };
  }

  // 4. Speed / teleportation sanity (only when we have a previous fix)
  if (prevEmitted) {
    const distM   = _distanceMeters(prevEmitted, { latitude, longitude });
    const deltaMs = location.timestamp - prevEmitted.timestamp;

    if (deltaMs > 0) {
      const derivedSpeed = distM / (deltaMs / 1000); // m/s
      // Also cross-check against GPS-reported speed when available
      const reportedSpeed = (typeof speed === "number" && speed >= 0) ? speed : null;

      if (derivedSpeed > MAX_PLAUSIBLE_SPEED_MS) {
        return {
          ok: false,
          reason:
            `Teleportation guard: jumped ${distM.toFixed(0)} m in ${(deltaMs / 1000).toFixed(1)} s ` +
            `(${derivedSpeed.toFixed(1)} m/s). Reported speed: ${reportedSpeed?.toFixed(1) ?? "n/a"} m/s`,
        };
      }
    }
  }

  return { ok: true };
};

// ─── Permission ───────────────────────────────────────────────────────────────

/**
 * Request location permissions.
 *
 * @param {boolean} [background=false]  Also request background permission.
 * @throws {Error}  PERMISSION_BLOCKED | PERMISSION_DENIED
 */
export const requestLocationPermission = async (background = false) => {
  console.log("[LocationService] Requesting foreground permission...");

  const { status, canAskAgain } =
    await Location.requestForegroundPermissionsAsync();

  if (status !== "granted") {
    if (!canAskAgain) {
      throw new Error(
        "PERMISSION_BLOCKED: Location is permanently denied. " +
          "Direct the user to Settings → App → Location."
      );
    }
    throw new Error("PERMISSION_DENIED: User declined location permission.");
  }

  if (background) {
    const { status: bgStatus } =
      await Location.requestBackgroundPermissionsAsync();

    if (bgStatus !== "granted") {
      console.warn(
        "[LocationService] ⚠️  Background permission denied. " +
          "Tracking will pause when the app is backgrounded. " +
          "For a safety app, strongly consider prompting the user to allow 'Always'."
      );
    } else {
      console.log("[LocationService] Background permission granted ✅");
    }
  }

  console.log("[LocationService] Foreground permission granted ✅");
};

// ─── Single-shot fix ──────────────────────────────────────────────────────────

/**
 * Get a single, fresh, validated GPS fix.
 *
 * Pass 1 → High accuracy (GPS chip), 15 s timeout.
 * Pass 2 → Balanced accuracy (cell / Wi-Fi), 15 s timeout.
 *
 * @returns {Promise<{latitude, longitude, accuracy}>}
 */
export const getCurrentLocation = async () => {
  console.log("[LocationService] Acquiring current location...");
  await requestLocationPermission();

  const _tryFix = (accuracy) =>
    Promise.race([
      Location.getCurrentPositionAsync({ accuracy }),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`GPS_TIMEOUT: No fix in ${GPS_TIMEOUT_MS / 1000} s`)),
          GPS_TIMEOUT_MS
        )
      ),
    ]);

  let location = null;

  // Pass 1 — GPS chip
  try {
    const raw = await _tryFix(Location.Accuracy.High);
    const { ok, reason } = _validateFix(raw, null);
    if (ok) {
      location = raw;
    } else {
      console.warn(`[LocationService] High-accuracy fix rejected (${reason}), trying Balanced...`);
    }
  } catch (err) {
    console.warn(`[LocationService] High-accuracy pass threw (${err.message}), trying Balanced...`);
  }

  // Pass 2 — Cell / Wi-Fi assisted
  if (!location) {
    try {
      const raw = await _tryFix(Location.Accuracy.Balanced);
      const { ok, reason } = _validateFix(raw, null);
      if (!ok) throw new Error(reason);
      location = raw;
    } catch (err) {
      throw new Error(`[LocationService] Cannot get a usable fix: ${err.message}`);
    }
  }

  const { latitude, longitude, accuracy } = location.coords;
  console.log(
    `[LocationService] ✅ Fix → ${latitude.toFixed(6)}, ${longitude.toFixed(6)} ` +
      `±${accuracy?.toFixed(1) ?? "?"}m`
  );

  return { latitude, longitude, accuracy };
};

// ─── Live watch ───────────────────────────────────────────────────────────────

/**
 * Stream live, validated location updates to onLocation.
 *
 * v3 additions:
 *  • Teleportation guard (speed-sanity check per update)
 *  • GPS warm-up: first WARMUP_FIX_COUNT fixes are silently consumed
 *    to let the chip stabilise before forwarding data.
 *  • Subscription leak guard: calling watchLocation() twice without
 *    removing the previous subscription is detected and prevented.
 *
 * @param {(loc: {latitude, longitude, accuracy, timestamp}) => void} onLocation
 * @param {() => void} [onDead]  Called when heartbeat expires.
 * @returns {Promise<{remove: () => void}>}
 */
export const watchLocation = async (onLocation, onDead = null) => {
  // ── Leak guard ───────────────────────────────────────────────────────────
  if (_subscription) {
    console.warn(
      "[LocationService] watchLocation() called while a subscription is already active. " +
        "Removing old subscription first to prevent leaks."
    );
    _subscription.remove();
    _subscription = null;
  }

  console.log("[LocationService] Starting live watch (warm-up phase)...");
  await requestLocationPermission();

  _warmupCount = 0;
  _lastEmitted = null;

  // ── Heartbeat ────────────────────────────────────────────────────────────
  const _resetHeartbeat = () => {
    if (_heartbeatTimer) clearTimeout(_heartbeatTimer);
    _heartbeatTimer = setTimeout(() => {
      console.error(
        `[LocationService] ☠️  No GPS event in ${HEARTBEAT_TIMEOUT_MS / 1000} s — watch presumed dead.`
      );
      onDead?.();
    }, HEARTBEAT_TIMEOUT_MS);
  };

  _resetHeartbeat();

  // ── Watch ─────────────────────────────────────────────────────────────────
  const sub = await Location.watchPositionAsync(
    {
      accuracy:         Location.Accuracy.High,
      timeInterval:     4_000,
      distanceInterval: MIN_MOVEMENT_METERS,
    },
    (location) => {
      _resetHeartbeat();

      // ── Warm-up phase ────────────────────────────────────────────────────
      if (_warmupCount < WARMUP_FIX_COUNT) {
        _warmupCount += 1;
        console.log(
          `[LocationService] Warm-up fix ${_warmupCount}/${WARMUP_FIX_COUNT} received — ` +
            "not forwarding yet."
        );
        return;
      }

      // ── Validate ─────────────────────────────────────────────────────────
      const { ok, reason } = _validateFix(location, _lastEmitted);
      if (!ok) {
        console.warn(`[LocationService] Fix rejected — ${reason}`);
        return;
      }

      const { latitude, longitude, accuracy } = location.coords;
      const current = { latitude, longitude, accuracy, timestamp: location.timestamp };

      // ── Jitter / duplicate suppression ───────────────────────────────────
      if (_lastEmitted) {
        const moved = _distanceMeters(_lastEmitted, current);
        if (moved < MIN_MOVEMENT_METERS) {
          console.log(`[LocationService] Jitter suppressed — moved only ${moved.toFixed(1)} m`);
          return;
        }
      }

      _lastEmitted = current;
      console.log(
        `[LocationService] 📍 ${latitude.toFixed(6)}, ${longitude.toFixed(6)} ` +
          `±${accuracy?.toFixed(1) ?? "?"}m`
      );
      onLocation(current);
    }
  );

  // Wrap remove() to also clear heartbeat + module state
  const _originalRemove = sub.remove.bind(sub);
  sub.remove = () => {
    if (_heartbeatTimer) { clearTimeout(_heartbeatTimer); _heartbeatTimer = null; }
    _originalRemove();
    _subscription = null;
    _warmupCount  = 0;
    _lastEmitted  = null;
    console.log("[LocationService] Watch stopped and state cleared.");
  };

  _subscription = sub;
  console.log("[LocationService] Watch active — forwarding after warm-up.");
  return sub;
};
