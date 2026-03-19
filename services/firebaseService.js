// services/firebaseService.js

import { db, realtimeDb, auth } from '../firebaseConfig';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import {
  ref,
  set,
  onValue,
  remove
} from 'firebase/database';

// ─── RIDE FUNCTIONS ───────────────────────────────────────

// Call this when user taps Start Ride
export const saveRide = async (userId, destination) => {
  try {
    const rideRef = await addDoc(collection(db, 'rides'), {
      userId,
      destination,
      status: 'active',
      startTime: serverTimestamp(),
      endTime: null,
    });
    return rideRef.id;
  } catch (error) {
    console.error('Error saving ride:', error);
    throw error;
  }
};

// Call this when user taps End Ride
export const endRide = async (rideId) => {
  try {
    const rideRef = doc(db, 'rides', rideId);
    await updateDoc(rideRef, {
      status: 'completed',
      endTime: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error ending ride:', error);
    throw error;
  }
};

// ─── LIVE LOCATION FUNCTIONS ──────────────────────────────

// Call this continuously during ride to update live location
// Uses Realtime DB because it updates instantly (unlike Firestore)
export const updateLiveLocation = async (userId, latitude, longitude) => {
  try {
    const locationRef = ref(realtimeDb, `liveLocations/${userId}`);
    await set(locationRef, {
      latitude,
      longitude,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Error updating location:', error);
    throw error;
  }
};

// Call this when ride ends to remove live location from DB
export const clearLiveLocation = async (userId) => {
  try {
    const locationRef = ref(realtimeDb, `liveLocations/${userId}`);
    await remove(locationRef);
  } catch (error) {
    console.error('Error clearing location:', error);
    throw error;
  }
};

// ─── EMERGENCY FUNCTIONS ──────────────────────────────────

// Call this when SOS is triggered
export const saveEmergencyEvent = async (userId, rideId, latitude, longitude) => {
  try {
    await addDoc(collection(db, 'emergencies'), {
      userId,
      rideId,
      latitude,
      longitude,
      triggeredAt: serverTimestamp(),
      resolved: false,
    });
  } catch (error) {
    console.error('Error saving emergency:', error);
    throw error;
  }
};

// ─── TRUSTED CONTACT FUNCTIONS ────────────────────────────

// Save a trusted contact for a user
export const saveTrustedContact = async (userId, name, phone) => {
  try {
    await addDoc(collection(db, 'trustedContacts'), {
      userId,
      name,
      phone,
      addedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error saving contact:', error);
    throw error;
  }
};

// Get trusted contacts (Person 1's screens will use this)
export const getTrustedContacts = async (userId) => {
  try {
    const contactsRef = collection(db, 'trustedContacts');
    const snapshot = await getDocs(query(contactsRef, where('userId', '==', userId)));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting contacts:', error);
    throw error;
  }
};