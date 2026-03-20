// services/rideService.js
import { getCurrentLocation } from './locationService';


import {
  saveRide,
  endRide,
  updateLiveLocation,
  clearLiveLocation,
} from './firebaseService';

let activeRideId = null;
let locationInterval = null;

// ─── START RIDE ───────────────────────────────────────────

// Call this when user taps Start Ride
// Person 1 calls this from RideScreen.js
export const startRide = async (userId, destination) => {
  try {
    // Save ride to Firebase and get back the ride ID
    const rideId = await saveRide(userId, destination);
    activeRideId = rideId;

    // Start sending live location every 5 seconds
    locationInterval = setInterval(async () => {
      try {
        // getCurrentLocation comes from Person 2's locationService
        const location = await getCurrentLocation();
        await updateLiveLocation(userId, location.latitude, location.longitude);
      } catch (error) {
        console.error('Error updating location during ride:', error);
      }
    }, 5000);

    return rideId;
  } catch (error) {
    console.error('Error starting ride:', error);
    throw error;
  }
};

// ─── END RIDE ─────────────────────────────────────────────

// Call this when user taps End Ride or ride completes
// Person 1 calls this from RideScreen.js or CompletionScreen.js
export const stopRide = async (userId) => {
  try {
    // Stop the location tracking interval
    if (locationInterval) {
      clearInterval(locationInterval);
      locationInterval = null;
    }

    // Mark ride as completed in Firebase
    if (activeRideId) {
      await endRide(activeRideId);
      await clearLiveLocation(userId);
      activeRideId = null;
    }
  } catch (error) {
    console.error('Error stopping ride:', error);
    throw error;
  }
};

// ─── HELPERS ──────────────────────────────────────────────

// Get the current active ride ID
// Useful for emergency service to know which ride is active
export const getActiveRideId = () => activeRideId;

// Check if a ride is currently active
export const isRideActive = () => activeRideId !== null;