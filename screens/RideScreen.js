import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, Platform, Alert, Animated, ScrollView,
} from 'react-native';

import { startRide, stopRide } from '../services/rideService';
import RideMapView from './RideMapView';
import { geocodeAddress } from '../services/geocodingService';
import { fetchRoute } from '../services/routeService';
import { detectDeviation } from '../services/deviationService';
import { getCurrentLocation } from '../services/locationService';

export default function RideScreen({ navigation, route }) {
  const { pickup, destination, vehicleNumber, startTime, startDate, userId } = route.params;

  const [elapsedTime, setElapsedTime] = useState(0);
  const [rideStarted, setRideStarted] = useState(false);

  const [pickupCoords, setPickupCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);

  const [routeLine, setRouteLine] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // 💓 Animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // ⏱ Timer
  useEffect(() => {
    const interval = setInterval(() => setElapsedTime((p) => p + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // 🚗 Start ride
  useEffect(() => {
    handleStartRide();
  }, []);

  const handleStartRide = async () => {
    try {
      await startRide(userId, destination);
      setRideStarted(true);
    } catch (error) {
      Alert.alert('Error', 'Could not start ride');
    }
  };

  // 📍 Geocode + Route
  useEffect(() => {
    const convertAddresses = async () => {
      try {
        const pickupC = await geocodeAddress(pickup);
        const destC = await geocodeAddress(destination);

        setPickupCoords(pickupC);
        setDestinationCoords(destC);

        const route = await fetchRoute(pickupC, destC);
        setRouteLine(route);

      } catch (e) {
        console.error(e);
        Alert.alert('Error', 'Could not find location');
      }
    };

    convertAddresses();
  }, []);

  // 🚨 Live tracking + deviation detection
  useEffect(() => {
    if (!routeLine.length) return;

    const interval = setInterval(async () => {
      try {
        const location = await getCurrentLocation();
        setCurrentLocation(location);

        const result = await detectDeviation(userId, location, routeLine);

        if (result.deviated) {
          Alert.alert('⚠️ Off Route', 'You are deviating!');
        }

      } catch (error) {
        console.log(error);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [routeLine]);

  const handleEndRide = () => {
    Alert.alert('End Ride', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Ride',
        onPress: async () => {
          await stopRide(userId);
          navigation.navigate('Completion', {
            pickup,
            destination,
            vehicleNumber,
            userId,
            duration: formatTime(elapsedTime),
          });
        },
      },
    ]);
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: rideStarted ? '#4caf50' : '#ffa000' }]} />
            <Text style={[styles.statusText, { color: rideStarted ? '#4caf50' : '#ffa000' }]}>
              {rideStarted ? 'Ride In Progress' : 'Starting ride...'}
            </Text>
          </View>
          <Text style={styles.headerTitle}>🚗 Ride Tracker</Text>
          <Text style={styles.headerDate}>{startDate}</Text>
        </View>

        {pickupCoords && destinationCoords && (
          <View style={styles.mapContainer}>
            <RideMapView
              pickup={pickupCoords}
              destination={destinationCoords}
              routeLine={routeLine}
              currentLocation={currentLocation}
            />
          </View>
        )}

        <View style={styles.timerCard}>
          <Text style={styles.timerLabel}>Duration</Text>
          <Text style={styles.timerValue}>{formatTime(elapsedTime)}</Text>
          <Text style={styles.timerSub}>Started at {startTime}</Text>
        </View>

        <Animated.View style={{ transform: [{ scale: pulseAnim }], marginBottom: 14 }}>
          <TouchableOpacity
            style={styles.sosBtn}
            onPress={() => navigation.navigate('Emergency', {
              vehicleNumber, pickup, destination, userId,
            })}
          >
            <Text style={styles.sosBtnText}>🚨 SOS EMERGENCY</Text>
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity style={styles.endBtn} onPress={handleEndRide}>
          <Text style={styles.endBtnText}>✓ End Ride Safely</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9f0f5' },

  container: {
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'android' ? 48 : 20,
    paddingBottom: 30
  },

  header: { marginBottom: 12 },

  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },

  statusDot: { width: 9, height: 9, borderRadius: 5, marginRight: 8 },

  statusText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },

  headerTitle: { fontSize: 26, fontWeight: '800', color: '#3a1a2e' },

  headerDate: { fontSize: 13, color: '#a06080', marginTop: 2 },

  mapContainer: {
    height: 180,
    borderRadius: 15,
    overflow: 'hidden',
    marginBottom: 12,
  },

  timerCard: {
    backgroundColor: '#c0136e',
    borderRadius: 18,
    paddingVertical: 22,
    alignItems: 'center',
    marginBottom: 16,
  },

  timerLabel: {
    color: '#f8c0dc',
    fontSize: 12,
    fontWeight: '600',
  },

  timerValue: {
    color: '#fff',
    fontSize: 52,
    fontWeight: '800',
  },

  timerSub: {
    color: '#f8c0dc',
    fontSize: 12,
    marginTop: 4
  },

  sosBtn: {
    backgroundColor: '#d32f2f',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },

  sosBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },

  endBtn: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e91e8c',
  },

  endBtnText: {
    color: '#e91e8c',
    fontSize: 16,
    fontWeight: '700'
  },
});