import * as Location from "expo-location";
import { updateLiveLocation } from "./firebaseService";
import { detectDeviation } from "./deviationService";

let locationSubscription = null;

// 🔥 NEW: store route + user
let currentRoute = [];
let currentUserId = null;

// 🔥 NEW: set route from RideScreen
export const setRouteForTracking = (route, userId) => {
  currentRoute = route;
  currentUserId = userId;
};

// Permission
const requestPermissions = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Location permission denied.");
  }
};

// Get current location
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

// 🔥 START TRACKING (UPDATED)
export const startWatchingLocation = async (userId) => {
  await requestPermissions();

  if (locationSubscription) {
    console.warn("Already tracking location");
    return;
  }

  locationSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 3000,
      distanceInterval: 5,
    },
    async (location) => {
      const { latitude, longitude } = location.coords;

      console.log(`📍 Location: ${latitude}, ${longitude}`);

      // Firebase sync
      await updateLiveLocation(userId, latitude, longitude);

      // 🔥 DEVIATION CHECK
      if (currentRoute.length > 0 && currentUserId) {
        await detectDeviation(
          currentUserId,
          { latitude, longitude },
          currentRoute
        );
      }
    }
  );

  console.log("Started tracking 🚀");
};

// Stop tracking
export const stopWatchingLocation = () => {
  if (locationSubscription) {
    locationSubscription.remove();
    locationSubscription = null;
    console.log("Stopped tracking");
  }
};