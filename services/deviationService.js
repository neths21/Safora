/**
 * deviationService.js
 * Detects when a user deviates from their planned route.
 *
 * Strategy:
 *   - Compute the shortest distance from the user's current point
 *     to each segment of the route polyline.
 *   - If min distance > DEVIATION_THRESHOLD_METERS → trigger SOS.
 *
 * Uses the Haversine formula for accurate earth-surface distances.
 */

import { triggerSOS } from "./emergencyService"; // Teammate's function

// Distance in meters beyond which a deviation is flagged
const DEVIATION_THRESHOLD_METERS = 100;

// Prevent SOS from firing repeatedly within a short window
let lastSOSTriggerTime = null;
const SOS_COOLDOWN_MS = 30000; // 30 seconds

// ─────────────────────────────────────────────
// Haversine Helpers
// ─────────────────────────────────────────────

/**
 * toRadians
 * Converts degrees to radians.
 * @param {number} deg
 * @returns {number}
 */
const toRadians = (deg) => (deg * Math.PI) / 180;

/**
 * haversineDistance
 * Calculates the straight-line distance between two GPS coordinates in meters.
 *
 * @param {{ latitude: number, longitude: number }} pointA
 * @param {{ latitude: number, longitude: number }} pointB
 * @returns {number} Distance in meters
 */
const haversineDistance = (pointA, pointB) => {
  const R = 6371000; // Earth's radius in meters

  const dLat = toRadians(pointB.latitude - pointA.latitude);
  const dLng = toRadians(pointB.longitude - pointA.longitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(pointA.latitude)) *
      Math.cos(toRadians(pointB.latitude)) *
      Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// ─────────────────────────────────────────────
// Segment Distance Calculation
// ─────────────────────────────────────────────

/**
 * pointToSegmentDistance
 * Calculates the shortest distance (in meters) from a point to a line segment
 * defined by two endpoints (segA → segB).
 *
 * Projects the point onto the segment and clamps to endpoints if outside.
 *
 * @param {{ latitude: number, longitude: number }} point
 * @param {{ latitude: number, longitude: number }} segA  - Segment start
 * @param {{ latitude: number, longitude: number }} segB  - Segment end
 * @returns {number} Distance in meters
 */
const pointToSegmentDistance = (point, segA, segB) => {
  // Work in flat coordinate space (approximate, fine for short distances)
  const px = point.longitude;
  const py = point.latitude;
  const ax = segA.longitude;
  const ay = segA.latitude;
  const bx = segB.longitude;
  const by = segB.latitude;

  const dx = bx - ax;
  const dy = by - ay;
  const segLenSq = dx * dx + dy * dy;

  let t = 0;
  if (segLenSq !== 0) {
    // Parametric projection of point onto segment line
    t = ((px - ax) * dx + (py - ay) * dy) / segLenSq;
    t = Math.max(0, Math.min(1, t)); // Clamp to [0, 1]
  }

  // Closest point on segment
  const closestPoint = {
    latitude: ay + t * dy,
    longitude: ax + t * dx,
  };

  return haversineDistance(point, closestPoint);
};

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * calculateDistance
 * Finds the minimum distance (in meters) from a GPS point to the full route polyline.
 * Iterates over every segment of the route and returns the shortest distance found.
 *
 * @param {{ latitude: number, longitude: number }} point         - User's current location
 * @param {Array<{ latitude: number, longitude: number }>} routeLine - Ordered route waypoints
 * @returns {number} Minimum distance in meters from point to route
 */
export const calculateDistance = (point, routeLine) => {
  if (!routeLine || routeLine.length < 2) {
    console.warn("[DeviationService] Route line has fewer than 2 points. Cannot compute distance.");
    return Infinity;
  }

  let minDistance = Infinity;

  // Iterate over consecutive pairs of waypoints (segments)
  for (let i = 0; i < routeLine.length - 1; i++) {
    const dist = pointToSegmentDistance(point, routeLine[i], routeLine[i + 1]);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }

  return minDistance;
};

/**
 * detectDeviation
 * Compares the user's current location against the planned route.
 * If deviation exceeds DEVIATION_THRESHOLD_METERS, triggers SOS.
 *
 * Includes cooldown logic to prevent SOS spam.
 *
 * @param {string} userId                                            - Current user ID
 * @param {{ latitude: number, longitude: number }} currentLocation  - User's GPS position
 * @param {Array<{ latitude: number, longitude: number }>} routeLine - Planned route polyline
 * @returns {Promise<{ deviated: boolean, distanceFromRoute: number }>}
 */
export const detectDeviation = async (userId, currentLocation, routeLine) => {
  if (!currentLocation || !routeLine || routeLine.length < 2) {
    console.warn("[DeviationService] Insufficient data for deviation check.");
    return { deviated: false, distanceFromRoute: 0 };
  }

  const distanceFromRoute = calculateDistance(currentLocation, routeLine);

  console.log(`[DeviationService] Distance from route: ${distanceFromRoute.toFixed(1)}m`);

  const deviated = distanceFromRoute > DEVIATION_THRESHOLD_METERS;

  if (deviated) {
    const now = Date.now();
    const cooldownElapsed =
      !lastSOSTriggerTime || now - lastSOSTriggerTime > SOS_COOLDOWN_MS;

    if (cooldownElapsed) {
      lastSOSTriggerTime = now;
      console.warn(
        `[DeviationService] ⚠️ DEVIATION DETECTED! ${distanceFromRoute.toFixed(1)}m from route. Triggering SOS.`
      );

      // Trigger SOS via teammate's emergencyService
      await triggerSOS(
        userId,
        currentLocation.latitude,
        currentLocation.longitude
      );
    } else {
      console.log("[DeviationService] Deviation detected, but SOS is on cooldown.");
    }
  }

  return { deviated, distanceFromRoute };
};

/**
 * resetSOSCooldown
 * Manually resets the SOS cooldown — useful for testing or after a ride restart.
 */
export const resetSOSCooldown = () => {
  lastSOSTriggerTime = null;
  console.log("[DeviationService] SOS cooldown reset.");
};