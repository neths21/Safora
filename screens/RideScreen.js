import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, Animated, ScrollView, Platform,
  Modal, Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { startRide, stopRide } from '../services/rideService';
import RideMapView from './RideMapView';
import { geocodeAddress } from '../services/geocodingService';
import { fetchRoute } from '../services/routeService';
import { detectDeviation } from '../services/deviationService';
import { getCurrentLocation } from '../services/locationService';
import { useVoiceTrigger } from '../hooks/useVoiceTrigger';
import FakeCallModal from '../components/FakeCallModal';

// ── Deviation Alert Modal ─────────────────────────────────────────
const DeviationModal = ({ visible, onSOS, onCancel }) => (
  <Modal
    transparent
    animationType="fade"
    visible={visible}
    onRequestClose={onCancel}
    statusBarTranslucent
  >
    <View style={modalStyles.overlay}>
      <View style={modalStyles.card}>
        {/* Icon */}
        <View style={modalStyles.iconWrap}>
          <Text style={modalStyles.iconEmoji}>⚠️</Text>
        </View>

        {/* Title */}
        <Text style={modalStyles.title}>Route Deviation Detected!</Text>
        <Text style={modalStyles.subtitle}>
          You appear to be off your planned route.{'\n'}Are you okay?
        </Text>

        {/* Route legend */}
        <View style={modalStyles.legendRow}>
          <View style={[modalStyles.legendDot, { backgroundColor: '#43a047' }]} />
          <Text style={modalStyles.legendText}>Planned Route</Text>
          <View style={[modalStyles.legendDot, { backgroundColor: '#e53935', marginLeft: 16 }]} />
          <Text style={modalStyles.legendText}>Deviated Path</Text>
        </View>

        {/* Buttons */}
        <TouchableOpacity style={modalStyles.sosBtn} onPress={onSOS} activeOpacity={0.85}>
          <Text style={modalStyles.sosBtnIcon}>🚨</Text>
          <Text style={modalStyles.sosBtnText}>SOS — I Need Help</Text>
        </TouchableOpacity>

        <TouchableOpacity style={modalStyles.cancelBtn} onPress={onCancel} activeOpacity={0.85}>
          <Text style={modalStyles.cancelBtnText}>✓  I'm Safe — Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

// ── Vibration pattern: urgent SOS-style ──────────────────────────
// short-short-short-long  (pause in ms between each)
const DEVIATION_VIBRATION = [0, 200, 100, 200, 100, 200, 300, 600];

export default function RideScreen({ navigation, route }) {
  const { pickup, destination, vehicleNumber, startTime, startDate, userId } = route.params;
  const [elapsedTime, setElapsedTime] = useState(0);
  const [rideStarted, setRideStarted] = useState(false);
  const [pickupCoords, setPickupCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [routeLine, setRouteLine] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [showFakeCall, setShowFakeCall] = useState(false);
  const [isDeviated, setIsDeviated] = useState(false);
  const [deviatedLocation, setDeviatedLocation] = useState(null);
  const [showDeviationModal, setShowDeviationModal] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const deviateAnim = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    const interval = setInterval(() => setElapsedTime((p) => p + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    handleStartRide();
  }, []);

  useEffect(() => {
    const convertAddresses = async () => {
      try {
        const pickupC = await geocodeAddress(pickup);
        const destC = await geocodeAddress(destination);
        setPickupCoords(pickupC);
        setDestinationCoords(destC);
        const fetchedRoute = await fetchRoute(pickupC, destC);
        setRouteLine(fetchedRoute);
      } catch (e) {
        console.error('Could not geocode addresses:', e.message);
      }
    };
    convertAddresses();
  }, []);

  useEffect(() => {
    if (!routeLine || routeLine.length === 0) return;
    const interval = setInterval(async () => {
      try {
        const location = await getCurrentLocation();
        setCurrentLocation(location);

        // If deviation is simulated, skip the real deviation check
        if (isDeviated) return;

        const result = await detectDeviation(userId, location, routeLine);
        console.log('Deviation check:', result);
        if (result.deviated) {
          Alert.alert(
            '⚠️ Route Deviation',
            'You seem to be off route. Are you safe?',
            [
              { text: 'Yes, I am Safe', style: 'cancel' },
              {
                text: 'I Need Help',
                style: 'destructive',
                onPress: () => navigation.navigate('Emergency', {
                  vehicleNumber, pickup, destination, userId,
                }),
              },
            ]
          );
        }
      } catch (error) {
        console.error('Deviation error:', error.message);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [routeLine, isDeviated]);

  useVoiceTrigger(
    (transcript) => {
      console.log('SOS triggered by voice:', transcript);
      navigation.navigate('Emergency', {
        vehicleNumber, pickup, destination, userId,
      });
    },
    rideStarted
  );

  // ── Simulate Deviation ────────────────────────────────────────
  const handleSimulateDeviation = async () => {
    try {
      if (isDeviated) {
        // Reset back to normal
        setIsDeviated(false);
        setDeviatedLocation(null);
        setShowDeviationModal(false);
        Vibration.cancel();
        Animated.timing(deviateAnim, { toValue: 0, duration: 300, useNativeDriver: false }).start();
        return;
      }

      // Get actual current location as base, or fall back to pickup
      let base = currentLocation;
      if (!base) {
        try {
          base = await getCurrentLocation();
        } catch {
          base = pickupCoords;
        }
      }

      if (!base) {
        Alert.alert('Not ready', 'Waiting for location data. Please try again shortly.');
        return;
      }

      // Offset the location to simulate going off-route (~1.5 km away)
      const fakeLocation = {
        latitude: base.latitude + 0.015,
        longitude: base.longitude + 0.015,
      };

      setDeviatedLocation(fakeLocation);
      setIsDeviated(true);

      Animated.timing(deviateAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start();

      // Vibrate with urgent pattern
      Vibration.vibrate(DEVIATION_VIBRATION);

      // Show the custom deviation modal
      setShowDeviationModal(true);
    } catch (err) {
      console.error('Simulate deviation error:', err.message);
    }
  };

  // ── Modal handlers ────────────────────────────────────────────
  const handleDeviationSOS = () => {
    Vibration.cancel();
    setShowDeviationModal(false);
    navigation.navigate('Emergency', {
      vehicleNumber, pickup, destination, userId,
    });
  };

  const handleDeviationCancel = () => {
    Vibration.cancel();
    setShowDeviationModal(false);
    // Keep the deviation visually active on the map but stop the alert
  };

  // ── Ride controls ─────────────────────────────────────────────
  const handleStartRide = async () => {
    try {
      await startRide(userId, destination);
      setRideStarted(true);
      console.log('Ride started');
    } catch (error) {
      console.error('Error starting ride:', error.message);
      Alert.alert('Error', 'Could not start ride tracking. Your ride will continue without tracking.');
    }
  };

  const handleEndRide = () => {
    Alert.alert('End Ride', 'Are you sure you want to end this ride?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Ride',
        style: 'destructive',
        onPress: async () => {
          try {
            await stopRide(userId);
            console.log('Ride stopped');
          } catch (error) {
            console.error('Error stopping ride:', error.message);
          }
          navigation.navigate('Completion', {
            pickup, destination, vehicleNumber, userId,
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

  const deviateBtnBg = deviateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#fff8e1', '#fbe9e7'],
  });
  const deviateBtnBorder = deviateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#f9a825', '#e53935'],
  });

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
          <Text style={styles.headerTitle}>🚗  Ride Tracker</Text>
          <Text style={styles.headerDate}>{startDate}</Text>
        </View>

        {rideStarted && (
          <View style={styles.voiceIndicator}>
            <Text style={styles.voiceDot}>🎤</Text>
            <Text style={styles.voiceText}>Listening for "Help" or "SOS"</Text>
          </View>
        )}

        {pickupCoords && destinationCoords && (
          <View style={styles.mapContainer}>
            <RideMapView
              pickup={pickupCoords}
              destination={destinationCoords}
              routeLine={routeLine}
              currentLocation={isDeviated ? deviatedLocation : currentLocation}
              isDeviated={isDeviated}
              deviatedLocation={deviatedLocation}
            />
          </View>
        )}

        {/* Deviation banner shown when simulated */}
        {isDeviated && (
          <View style={styles.deviationBanner}>
            <Text style={styles.deviationBannerIcon}>⚠️</Text>
            <View>
              <Text style={styles.deviationBannerTitle}>Route Deviation Active</Text>
              <Text style={styles.deviationBannerSub}>
                <Text style={{ color: '#43a047', fontWeight: '700' }}>Green</Text> = Planned  ·  <Text style={{ color: '#e53935', fontWeight: '700' }}>Red</Text> = Deviated
              </Text>
            </View>
          </View>
        )}

        <View style={styles.timerCard}>
          <Text style={styles.timerLabel}>Duration</Text>
          <Text style={styles.timerValue}>{formatTime(elapsedTime)}</Text>
          <Text style={styles.timerSub}>Started at {startTime}</Text>
        </View>

        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Ride Details</Text>

          <View style={styles.detailRow}>
            <View style={[styles.iconBox, { backgroundColor: '#e8f5e9' }]}>
              <Text style={styles.icon}>📍</Text>
            </View>
            <View style={styles.detailText}>
              <Text style={styles.detailLabel}>Pickup</Text>
              <Text style={styles.detailValue}>{pickup}</Text>
            </View>
          </View>

          <View style={styles.connector} />

          <View style={styles.detailRow}>
            <View style={[styles.iconBox, { backgroundColor: '#fce4ec' }]}>
              <Text style={styles.icon}>🏁</Text>
            </View>
            <View style={styles.detailText}>
              <Text style={styles.detailLabel}>Destination</Text>
              <Text style={styles.detailValue}>{destination}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={[styles.iconBox, { backgroundColor: '#e8eaf6' }]}>
              <Text style={styles.icon}>🚘</Text>
            </View>
            <View style={styles.detailText}>
              <Text style={styles.detailLabel}>Vehicle Number</Text>
              <Text style={[styles.detailValue, styles.vehicleText]}>{vehicleNumber}</Text>
            </View>
          </View>
        </View>

        {/* Simulate Deviation Button */}
        <Animated.View style={[
          styles.simulateDeviationBtn,
          { backgroundColor: deviateBtnBg, borderColor: deviateBtnBorder },
        ]}>
          <TouchableOpacity onPress={handleSimulateDeviation} activeOpacity={0.82} style={styles.simulateBtnInner}>
            <Text style={styles.simulateDeviationIcon}>{isDeviated ? '✅' : '🗺️'}</Text>
            <View>
              <Text style={[styles.simulateDeviationText, { color: isDeviated ? '#e53935' : '#f57f17' }]}>
                {isDeviated ? 'Reset to Normal Route' : 'Simulate Deviation'}
              </Text>
              <Text style={styles.simulateDeviationSub}>
                {isDeviated ? 'Tap to clear simulated deviation' : 'Test off-route detection on map'}
              </Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity
          style={styles.fakeCallBtn}
          onPress={() => setShowFakeCall(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.fakeCallBtnText}>📞  Fake Call</Text>
        </TouchableOpacity>

        <Animated.View style={{ transform: [{ scale: pulseAnim }], marginBottom: 14 }}>
          <TouchableOpacity
            style={styles.sosBtn}
            onPress={() => navigation.navigate('Emergency', {
              vehicleNumber, pickup, destination, userId,
            })}
            activeOpacity={0.8}
          >
            <Text style={styles.sosBtnIcon}>🚨</Text>
            <Text style={styles.sosBtnText}>SOS  EMERGENCY</Text>
            <Text style={styles.sosBtnSub}>Tap for immediate help</Text>
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity style={styles.endBtn} onPress={handleEndRide} activeOpacity={0.85}>
          <Text style={styles.endBtnText}>✓  End Ride Safely</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Deviation Alert Modal */}
      <DeviationModal
        visible={showDeviationModal}
        onSOS={handleDeviationSOS}
        onCancel={handleDeviationCancel}
      />

      <FakeCallModal
        visible={showFakeCall}
        onAnswer={() => console.log('Fake call answered')}
        onDecline={() => setShowFakeCall(false)}
      />
    </SafeAreaView>
  );
}

// ── Modal Styles ─────────────────────────────────────────────────
const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  iconWrap: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff3e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#ffb74d',
  },
  iconEmoji: { fontSize: 32 },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#b71c1c',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 22,
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#444',
    fontWeight: '600',
  },
  sosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d32f2f',
    borderRadius: 14,
    paddingVertical: 16,
    width: '100%',
    marginBottom: 12,
    gap: 8,
    shadowColor: '#d32f2f',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  sosBtnIcon: { fontSize: 20 },
  sosBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  cancelBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    borderWidth: 1.5,
    borderColor: '#43a047',
  },
  cancelBtnText: {
    color: '#2e7d32',
    fontSize: 15,
    fontWeight: '700',
  },
});

// ── Screen Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9f0f5' },
  container: { paddingHorizontal: 22, paddingTop: Platform.OS === 'android' ? 48 : 20, paddingBottom: 30 },
  header: { marginBottom: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  statusDot: { width: 9, height: 9, borderRadius: 5, marginRight: 8 },
  statusText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#3a1a2e' },
  headerDate: { fontSize: 13, color: '#a06080', marginTop: 2 },
  voiceIndicator: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f3e5f5', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    marginBottom: 12, borderWidth: 1, borderColor: '#e1bee7',
  },
  voiceDot: { fontSize: 14, marginRight: 8 },
  voiceText: { fontSize: 12, color: '#7b1fa2', fontWeight: '600' },
  mapContainer: { height: 180, borderRadius: 15, overflow: 'hidden', marginBottom: 12 },

  // Deviation banner
  deviationBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff3e0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 12, borderWidth: 1.5, borderColor: '#ffb74d',
    gap: 10,
  },
  deviationBannerIcon: { fontSize: 20 },
  deviationBannerTitle: { fontSize: 13, fontWeight: '700', color: '#e65100' },
  deviationBannerSub: { fontSize: 11, color: '#bf360c', marginTop: 2 },

  timerCard: {
    backgroundColor: '#c0136e', borderRadius: 18, paddingVertical: 22,
    alignItems: 'center', marginBottom: 16,
    shadowColor: '#c0136e', shadowOpacity: 0.3, shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 }, elevation: 6,
  },
  timerLabel: { color: '#f8c0dc', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  timerValue: { color: '#fff', fontSize: 52, fontWeight: '800', letterSpacing: 2 },
  timerSub: { color: '#f8c0dc', fontSize: 12, marginTop: 4 },
  detailsCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 16,
    shadowColor: '#c0136e', shadowOpacity: 0.06, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  detailsTitle: { fontSize: 15, fontWeight: '700', color: '#3a1a2e', marginBottom: 16 },
  detailRow: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  icon: { fontSize: 18 },
  detailText: { flex: 1 },
  detailLabel: { fontSize: 11, color: '#a06080', fontWeight: '600', textTransform: 'uppercase' },
  detailValue: { fontSize: 15, color: '#3a1a2e', fontWeight: '600', marginTop: 2 },
  vehicleText: { letterSpacing: 2, color: '#c0136e', fontWeight: '800', fontSize: 16 },
  connector: { width: 2, height: 14, backgroundColor: '#f0d0e4', marginLeft: 19, marginVertical: 4 },
  divider: { borderTopWidth: 1, borderColor: '#f5e4ee', marginVertical: 14 },

  // Simulate deviation button
  simulateDeviationBtn: {
    borderRadius: 14, borderWidth: 1.5,
    marginBottom: 14, overflow: 'hidden',
  },
  simulateBtnInner: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: 16, gap: 12,
  },
  simulateDeviationIcon: { fontSize: 22 },
  simulateDeviationText: { fontSize: 15, fontWeight: '700' },
  simulateDeviationSub: { fontSize: 11, color: '#8d6e63', marginTop: 1 },

  sosBtn: {
    backgroundColor: '#d32f2f', borderRadius: 16, paddingVertical: 18, alignItems: 'center',
    shadowColor: '#d32f2f', shadowOpacity: 0.4, shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 }, elevation: 8, marginBottom: 14,
  },
  sosBtnIcon: { fontSize: 26, marginBottom: 2 },
  sosBtnText: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 2 },
  sosBtnSub: { color: '#ffcdd2', fontSize: 11, marginTop: 2 },
  endBtn: {
    backgroundColor: '#fff', borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', borderWidth: 2, borderColor: '#e91e8c',
  },
  endBtnText: { color: '#e91e8c', fontSize: 16, fontWeight: '700' },
  fakeCallBtn: {
    backgroundColor: '#f9dfe9', borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#d80a9b',
    marginBottom: 14,
  },
  fakeCallBtnText: { color: '#da39a2', fontSize: 15, fontWeight: '700' },
});