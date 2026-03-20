
/**
 * locationService.js
 * Handles GPS location tracking using expo-location.
 * Responsibilities:
 *   - Get one-time current location
 *   - Watch position continuously and sync to Firebase
 *   - Stop watching when ride ends
 */

import * as Location from "expo-location";
import { updateLiveLocation } from "./firebaseService"; // Teammate's function

// Holds the subscription object returned by watchPositionAsync
let locationSubscription = null;

/**
 * Requests foreground location permissions from the user.
 * Throws an error if permission is denied.
 */
const requestPermissions = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Location permission denied. Cannot track position.");
  }
};

/**
 * getCurrentLocation
 * Returns the user's current GPS coordinates as a single snapshot.
 *
 * @returns {Promise<{ latitude: number, longitude: number }>}
 */
export const getCurrentLocation = async () => {
  await requestPermissions();

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
};

/**
 * startWatchingLocation
 * Continuously watches the user's position every ~3-5 seconds.
 * On each update, calls updateLiveLocation to sync to Firebase.
 *
 * @param {string} userId - The ID of the current user
 */
export const startWatchingLocation = async (userId) => {
  await requestPermissions();

  // Prevent duplicate subscriptions
  if (locationSubscription) {
    console.warn("[LocationService] Already watching location. Skipping.");
    return;
  }

  locationSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 3000,      // Update every 3 seconds
      distanceInterval: 5,     // Or if moved at least 5 meters
    },
    async (location) => {
      const { latitude, longitude } = location.coords;

      console.log(`[LocationService] Position update → lat: ${latitude}, lng: ${longitude}`);

      // Sync live location to Firebase (teammate's function)
      await updateLiveLocation(userId, latitude, longitude);
    }
  );

  console.log("[LocationService] Started watching location for user:", userId);
};

/**
 * stopWatchingLocation
 * Removes the location watcher and cleans up the subscription.
 */
export const stopWatchingLocation = () => {
  if (locationSubscription) {
    locationSubscription.remove();
    locationSubscription = null;
    console.log("[LocationService] Stopped watching location.");
  } else {
    console.warn("[LocationService] No active location subscription to stop.");
  }
};