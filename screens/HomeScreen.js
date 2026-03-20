import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, SafeAreaView, Platform,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import * as Location from "expo-location";

import { shareRideStarted } from '../services/shareService';
import { saveTrustedContact, getTrustedContacts } from '../services/firebaseService';

// Hardcoded userId for now — will be replaced with real auth later
const USER_ID = 'testUser123';

export default function HomeScreen({ navigation }) {
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contacts, setContacts] = useState([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      const list = await getTrustedContacts(USER_ID);
      setContacts(list);
    } catch (error) {
      console.error('Error loading contacts:', error.message);
    }
  };

  const fetchCurrentLocation = async () => {
    try {
      setLoadingLocation(true);

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        console.log("Permission denied");
        setLoadingLocation(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;

      const address = await Location.reverseGeocodeAsync({ latitude, longitude });

      if (address.length > 0) {
        const place = address[0];
        const formatted = `${place.name || ""} ${place.street || ""}, ${place.city || ""}`;
        setPickup(formatted.trim());
      }

      setLoadingLocation(false);
    } catch (error) {
      console.log("Location fetch failed:", error);
      setLoadingLocation(false);
    }
  };

  const handleAddContact = async () => {
    if (!contactName.trim() || !contactPhone.trim()) {
      Alert.alert('Missing Details', 'Please enter both name and phone number.');
      return;
    }
    try {
      await saveTrustedContact(USER_ID, contactName.trim(), contactPhone.trim());
      Alert.alert('Success', `${contactName} added as trusted contact.`);
      setContactName('');
      setContactPhone('');
      setShowAddContact(false);
      loadContacts();
    } catch (error) {
      Alert.alert('Error', 'Could not save contact. Try again.');
    }
  };

  const handleStartRide = async () => {
    if (!pickup.trim() || !destination.trim() || !vehicleNumber.trim()) {
      Alert.alert('Missing Details', 'Please fill in all fields before starting the ride.');
      return;
    }
    if (contacts.length === 0) {
      Alert.alert(
        'No Trusted Contacts',
        'Please add at least one trusted contact before starting a ride.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      await shareRideStarted(USER_ID, destination.trim());
    } catch (error) {
      console.error('Error sharing ride start:', error.message);
    }

    navigation.navigate('Ride', {
      pickup,
      destination,
      vehicleNumber,
      userId: USER_ID,
      startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      startDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoIcon}>🛡️</Text>
          </View>
          <Text style={styles.appName}>SAFORA</Text>
          <Text style={styles.tagline}>Your safety, our priority</Text>
        </View>

        {/* Trusted Contacts Section */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>Trusted Contacts</Text>
            <TouchableOpacity onPress={() => setShowAddContact(!showAddContact)}>
              <Text style={styles.addContactBtn}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {contacts.length === 0 && (
            <Text style={styles.noContactText}>
              No trusted contacts yet. Add one before starting a ride.
            </Text>
          )}

          {contacts.map((c) => (
            <View key={c.id} style={styles.contactRow}>
              <Text style={styles.contactName}>{c.name}</Text>
              <Text style={styles.contactPhone}>{c.phone}</Text>
            </View>
          ))}

          {showAddContact && (
            <View style={styles.addContactForm}>
              <TextInput
                style={styles.input}
                placeholder="Contact name"
                placeholderTextColor="#bbb"
                value={contactName}
                onChangeText={setContactName}
              />
              <TextInput
                style={styles.input}
                placeholder="Phone number e.g. +919791453638"
                placeholderTextColor="#bbb"
                value={contactPhone}
                onChangeText={setContactPhone}
                keyboardType="phone-pad"
              />
              <TouchableOpacity style={styles.saveContactBtn} onPress={handleAddContact}>
                <Text style={styles.saveContactBtnText}>Save Contact</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Ride Details Section */}
        <View style={[styles.card, { marginTop: 16 }]}>
          <Text style={styles.cardTitle}>Start a Safe Ride</Text>

          {/* Pickup */}
          <Text style={styles.label}>📍 Pickup Location</Text>
          <TextInput
            style={styles.input}
            placeholder={loadingLocation ? "Fetching current location..." : "Enter your pickup location"}
            placeholderTextColor="#bbb"
            value={pickup}
            onChangeText={setPickup}
          />

          {/* ✅ IMPROVED: Live Location Button */}
          <TouchableOpacity
            onPress={fetchCurrentLocation}
            style={[styles.locationBtn, loadingLocation && styles.locationBtnLoading]}
            activeOpacity={0.75}
            disabled={loadingLocation}
          >
            <Ionicons
              name={loadingLocation ? "sync" : "location-sharp"}
              size={15}
              color={loadingLocation ? "#c880a8" : "#e91e8c"}
            />
            <Text style={[styles.locationBtnText, loadingLocation && styles.locationBtnTextLoading]}>
              {loadingLocation ? "Fetching location..." : "Use current location"}
            </Text>
          </TouchableOpacity>

          {/* Destination */}
          <Text style={styles.label}>🏁 Destination</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your destination"
            placeholderTextColor="#bbb"
            value={destination}
            onChangeText={setDestination}
          />

          <View style={styles.divider} />

          {/* Vehicle */}
          <Text style={styles.label}>🚗 Vehicle Number</Text>
          <TextInput
            style={[styles.input, styles.vehicleInput]}
            placeholder="e.g. TN 01 AB 1234"
            placeholderTextColor="#bbb"
            value={vehicleNumber}
            onChangeText={(t) => setVehicleNumber(t.toUpperCase())}
            autoCapitalize="characters"
          />

          <TouchableOpacity style={styles.startBtn} onPress={handleStartRide} activeOpacity={0.85}>
            <Text style={styles.startBtnText}>🚀 Start Ride</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.safetyNote}>
          <Text style={styles.safetyIcon}>💜</Text>
          <Text style={styles.safetyText}>
            Your ride is monitored for your safety. SOS is one tap away at all times.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9f0f5' },
  container: { paddingHorizontal: 22, paddingTop: Platform.OS === 'android' ? 48 : 20, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 28 },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#e91e8c', shadowOpacity: 0.2, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 6, marginBottom: 12,
  },
  logoIcon: { fontSize: 34 },
  appName: { fontSize: 30, fontWeight: '800', color: '#c0136e', letterSpacing: 1 },
  tagline: { fontSize: 13, color: '#a06080', marginTop: 4 },
  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 22,
    shadowColor: '#c0136e', shadowOpacity: 0.08, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#3a1a2e' },
  addContactBtn: { fontSize: 14, fontWeight: '700', color: '#e91e8c' },
  noContactText: { fontSize: 13, color: '#bbb', marginBottom: 8, fontStyle: 'italic' },
  contactRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5e4ee',
  },
  contactName: { fontSize: 14, fontWeight: '600', color: '#3a1a2e' },
  contactPhone: { fontSize: 13, color: '#a06080' },
  addContactForm: { marginTop: 12 },
  saveContactBtn: {
    backgroundColor: '#e91e8c', borderRadius: 10, paddingVertical: 12,
    alignItems: 'center', marginTop: 4,
  },
  saveContactBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#7a3a60', marginBottom: 8, marginTop: 6 },
  input: {
    borderWidth: 1.5, borderColor: '#f0d0e4', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13, fontSize: 15,
    color: '#2d1a24', backgroundColor: '#fef8fb', marginBottom: 10,
  },
  vehicleInput: { fontWeight: '700', letterSpacing: 2, fontSize: 16 },
  divider: { borderTopWidth: 1, borderColor: '#f5e4ee', marginVertical: 10 },
  startBtn: {
    backgroundColor: '#e91e8c', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 10,
    shadowColor: '#e91e8c', shadowOpacity: 0.35, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  startBtnText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  safetyNote: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff0f7',
    borderRadius: 14, padding: 16, marginTop: 20,
    borderWidth: 1, borderColor: '#f8d0e8',
  },
  safetyIcon: { fontSize: 20, marginRight: 10 },
  safetyText: { flex: 1, fontSize: 12.5, color: '#a06080', lineHeight: 18 },

  // ✅ NEW: Location button styles
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    backgroundColor: '#fef0f7',
    borderWidth: 1.5,
    borderColor: '#e91e8c',
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  locationBtnLoading: {
    borderColor: '#e8b4d0',
    backgroundColor: '#fdf5f9',
  },
  locationBtnText: {
    color: '#c0136e',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  locationBtnTextLoading: {
    color: '#c880a8',
  },
});
