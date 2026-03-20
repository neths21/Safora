// services/shareService.js

import * as SMS from 'expo-sms';
import { getTrustedContacts } from './firebaseService';

// ─── HELPER ───────────────────────────────────────────────

// Fetches trusted contact phone numbers for a user
const getContactNumbers = async (userId) => {
  try {
    const contacts = await getTrustedContacts(userId);
    return contacts.map(contact => contact.phone);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return [];
  }
};

// ─── RIDE STARTED ─────────────────────────────────────────

// Call this when ride starts
// Person 1 calls this from RideScreen.js after startRide()
export const shareRideStarted = async (userId, destination) => {
  try {
    const isAvailable = await SMS.isAvailableAsync();
    if (!isAvailable) {
      console.log('SMS not available on this device');
      return false;
    }

    const numbers = await getContactNumbers(userId);
    if (numbers.length === 0) {
      console.log('No trusted contacts found');
      return false;
    }

    const message =
      `SAFORA ALERT: I have started a ride to ${destination}. ` +
      `I will share updates with you. Stay tuned.`;

    await SMS.sendSMSAsync(numbers, message);
    console.log('Ride started SMS sent');
    return true;
  } catch (error) {
    console.error('Error sharing ride start:', error);
    throw error;
  }
};

// ─── EMERGENCY ALERT ──────────────────────────────────────

// Call this when SOS is triggered
// Called automatically by emergencyService.js
export const shareEmergencyAlert = async (userId, latitude, longitude) => {
  try {
    const isAvailable = await SMS.isAvailableAsync();
    if (!isAvailable) {
      console.log('SMS not available on this device');
      return false;
    }

    const numbers = await getContactNumbers(userId);
    if (numbers.length === 0) {
      console.log('No trusted contacts found');
      return false;
    }

    const locationLink =
      `https://maps.google.com/?q=${latitude},${longitude}`;

    const message =
      `SAFORA SOS ALERT: I need help! ` +
      `My current location: ${locationLink} ` +
      `Please contact me immediately or call emergency services.`;

    await SMS.sendSMSAsync(numbers, message);
    console.log('Emergency SMS sent');
    return true;
  } catch (error) {
    console.error('Error sharing emergency alert:', error);
    throw error;
  }
};

// ─── RIDE COMPLETED ───────────────────────────────────────

// Call this when ride ends safely
// Person 1 calls this from CompletionScreen.js
export const shareRideComplete = async (userId) => {
  try {
    const isAvailable = await SMS.isAvailableAsync();
    if (!isAvailable) {
      console.log('SMS not available on this device');
      return false;
    }

    const numbers = await getContactNumbers(userId);
    if (numbers.length === 0) {
      console.log('No trusted contacts found');
      return false;
    }

    const message =
      `SAFORA UPDATE: I have reached my destination safely. ` +
      `My ride is now complete. Thank you for watching over me.`;

    await SMS.sendSMSAsync(numbers, message);
    console.log('Ride complete SMS sent');
    return true;
  } catch (error) {
    console.error('Error sharing ride completion:', error);
    throw error;
  }
};