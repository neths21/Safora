/**
 * useLocationTracking.js (FIXED - FORCE GPS)
 * Temporarily bypasses ride logic to ensure GPS works.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import * as Location from "expo-location";
import { updateLiveLocation } from "../services/firebaseService";

const useLocationTracking = () => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState(null);

  const locationSubscriptionRef = useRef(null);

  /**
   * startTracking
   */
  const startTracking = useCallback(async (userId) => {
    try {
      console.log("Requesting location permission...");

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setError("Location permission denied.");
        return;
      }

      console.log("Permission granted ✅");

      if (locationSubscriptionRef.current) return;

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        async (location) => {
          const { latitude, longitude } = location.coords;

          console.log("📍 Location:", latitude, longitude);

          setCurrentLocation({ latitude, longitude });

          // Optional: comment this if backend not ready
          try {
            await updateLiveLocation(userId, latitude, longitude);
          } catch (e) {
            console.log("Firebase update skipped:", e.message);
          }
        }
      );

      locationSubscriptionRef.current = subscription;
      setIsTracking(true);
      setError(null);

      console.log("Tracking started 🚀");
    } catch (err) {
      console.error("Tracking error:", err);
      setError(err.message);
    }
  }, []);

  /**
   * stopTracking
   */
  const stopTracking = useCallback(() => {
    if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = null;
    }

    setIsTracking(false);
    console.log("Tracking stopped");
  }, []);

  /**
   * 🔥 FORCE GPS ON MOUNT
   */
  useEffect(() => {
    const init = async () => {
      console.log("FORCING GPS START...");
      await startTracking("test-user");
    };

    init();

    return () => {
      stopTracking();
    };
  }, []);

  return {
    currentLocation,
    isTracking,
    error,
  };
};

export default useLocationTracking;