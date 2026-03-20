/**
 * useLocationTracking.js
 * Custom React hook that manages location tracking lifecycle.
 * Automatically starts when a ride is active and stops when it ends.
 *
 * Returns:
 *   - currentLocation: { latitude, longitude } | null
 *   - isTracking: boolean
 *   - error: string | null
 */

import { useState, useEffect, useRef, useCallback } from "react";
import * as Location from "expo-location";
import { isRideActive, getActiveRideId } from "../services/rideService";       // Teammate's functions
import { updateLiveLocation } from "../services/firebaseService";               // Teammate's function
import { startWatchingLocation, stopWatchingLocation } from "../services/locationService";

/**
 * Polls ride status every N milliseconds to react to ride start/end.
 */
const RIDE_POLL_INTERVAL_MS = 4000;

const useLocationTracking = () => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState(null);

  // Refs to persist values across renders without triggering re-renders
  const ridePollerRef = useRef(null);
  const locationSubscriptionRef = useRef(null);
  const activeRideIdRef = useRef(null);

  /**
   * startTracking
   * Begins watching the user's GPS position and sets tracking state.
   */
  const startTracking = useCallback(async (userId) => {
    try {
      // Request permissions before watching
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Location permission denied.");
        return;
      }

      // Avoid duplicate subscriptions
      if (locationSubscriptionRef.current) return;

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        async (location) => {
          const { latitude, longitude } = location.coords;

          // Update local state so UI can react
          setCurrentLocation({ latitude, longitude });

          // Sync to Firebase via teammate's service
          await updateLiveLocation(userId, latitude, longitude);
        }
      );

      locationSubscriptionRef.current = subscription;
      setIsTracking(true);
      setError(null);
      console.log("[useLocationTracking] Tracking started for ride:", userId);
    } catch (err) {
      console.error("[useLocationTracking] Failed to start tracking:", err);
      setError(err.message);
    }
  }, []);

  /**
   * stopTracking
   * Removes the GPS watcher and resets state.
   */
  const stopTracking = useCallback(() => {
    if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = null;
    }

    setIsTracking(false);
    activeRideIdRef.current = null;
    console.log("[useLocationTracking] Tracking stopped.");
  }, []);

  useEffect(() => {
    /**
     * Poll ride status at a regular interval.
     * Start tracking when ride becomes active; stop when it ends.
     */
    const pollRideStatus = async () => {
      try {
        const rideActive = await isRideActive();

        if (rideActive && !isTracking) {
          // Ride just started — begin tracking
          const rideId = await getActiveRideId();
          activeRideIdRef.current = rideId;
          await startTracking(rideId);
        } else if (!rideActive && isTracking) {
          // Ride just ended — stop tracking
          stopTracking();
        }
      } catch (err) {
        console.error("[useLocationTracking] Ride status poll error:", err);
        setError(err.message);
      }
    };

    // Run once immediately, then on an interval
    pollRideStatus();
    ridePollerRef.current = setInterval(pollRideStatus, RIDE_POLL_INTERVAL_MS);

    // Cleanup on unmount
    return () => {
      clearInterval(ridePollerRef.current);
      stopTracking();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    currentLocation,  // { latitude, longitude } | null
    isTracking,       // boolean — whether GPS watch is active
    error,            // string | null — last error message
  };
};

export default useLocationTracking;