// services/emergencyService.js

import { saveEmergencyEvent } from './firebaseService';
import { startRecording, stopRecording } from './audioService';
import { shareEmergencyAlert } from './shareService';
import { getActiveRideId } from './rideService';

let emergencyActive = false;

// ─── TRIGGER SOS ──────────────────────────────────────────

// Call this when SOS button is pressed or voice trigger detected
// Person 1 calls this from EmergencyScreen.js or SOSButton.js
export const triggerSOS = async (userId, latitude, longitude) => {
  try {
    emergencyActive = true;
    const rideId = getActiveRideId();

    // Save emergency event to Firebase
    await saveEmergencyEvent(userId, rideId, latitude, longitude);

    // Start audio recording immediately
    await startRecording();

    // Send alert to trusted contacts with live location
    await shareEmergencyAlert(userId, latitude, longitude);

    console.log('SOS triggered successfully');
    return true;
  } catch (error) {
    console.error('Error triggering SOS:', error);
    throw error;
  }
};

// ─── RESOLVE EMERGENCY ────────────────────────────────────

// Call this when user confirms they are safe
// Person 1 calls this from EmergencyScreen.js
export const resolveEmergency = async (userId) => {
  try {
    emergencyActive = false;

    // Stop audio recording and save it
    const recordingUri = await stopRecording(userId);

    console.log('Emergency resolved. Recording saved at:', recordingUri);
    return recordingUri;
  } catch (error) {
    console.error('Error resolving emergency:', error);
    throw error;
  }
};

// ─── FAKE CALL ────────────────────────────────────────────

// Triggers a fake incoming call UI
// Person 1 calls this from FakeCallModal.js
export const triggerFakeCall = () => {
  try {
    // Person 1 handles the UI — we just signal that it should show
    console.log('Fake call triggered');
    return true;
  } catch (error) {
    console.error('Error triggering fake call:', error);
    throw error;
  }
};

// ─── HELPERS ──────────────────────────────────────────────

// Check if emergency is currently active
// Useful for Person 1 to show/hide emergency UI
export const isEmergencyActive = () => emergencyActive;