import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, Platform, Animated, Alert, ScrollView,
} from 'react-native';
import { shareRideComplete } from '../services/shareService';
import { getRecordings } from '../services/audioService';
import * as Sharing from 'expo-sharing';

export default function CompletionScreen({ navigation, route }) {
  const { pickup, destination, vehicleNumber, userId, duration } = route.params || {};
  const scaleAnim = new Animated.Value(0);
  const [shared, setShared] = useState(false);
  const [recordings, setRecordings] = useState([]);

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1, tension: 50, friction: 6, useNativeDriver: true,
    }).start();

    notifyContacts();
    loadRecordings();
  }, []);

  const notifyContacts = async () => {
    try {
      await shareRideComplete(userId);
      setShared(true);
      console.log('Ride completion SMS sent');
    } catch (error) {
      console.error('Error sending completion SMS:', error.message);
    }
  };

  const loadRecordings = async () => {
    try {
      const list = await getRecordings(userId || 'defaultUser');
      setRecordings(list);
    } catch (error) {
      console.error('Error loading recordings:', error.message);
    }
  };

  const handleShareRecording = async (uri) => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Sharing not available', 'Cannot share files on this device.');
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'audio/m4a',
        dialogTitle: 'Share Emergency Recording',
      });
    } catch (error) {
      console.error('Error sharing recording:', error.message);
      Alert.alert('Error', 'Could not share the recording.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >

        <Animated.View style={[styles.checkCircle, { transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.checkIcon}>✓</Text>
        </Animated.View>

        <Text style={styles.title}>Ride Completed!</Text>
        <Text style={styles.subtitle}>You have arrived safely.</Text>

        {shared && (
          <View style={styles.notifyBanner}>
            <Text style={styles.notifyText}>
              💬 Your trusted contacts have been notified.
            </Text>
          </View>
        )}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Ride Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>📍 From</Text>
            <Text style={styles.summaryValue}>{pickup}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>🏁 To</Text>
            <Text style={styles.summaryValue}>{destination}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>🚘 Vehicle</Text>
            <Text style={[styles.summaryValue, styles.vehicleText]}>{vehicleNumber}</Text>
          </View>
          {duration && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>⏱ Duration</Text>
              <Text style={styles.summaryValue}>{duration}</Text>
            </View>
          )}
        </View>

        {recordings.length > 0 && (
          <View style={styles.recordingsCard}>
            <Text style={styles.recordingsTitle}>🎙 Emergency Recordings</Text>
            <Text style={styles.recordingsSubtitle}>
              {recordings.length} recording{recordings.length > 1 ? 's' : ''} saved on your device
            </Text>
            {recordings.map((r, i) => (
              <TouchableOpacity
                key={i}
                style={styles.recordingRow}
                onPress={() => handleShareRecording(r.uri)}
                activeOpacity={0.85}
              >
                <View style={styles.recordingInfo}>
                  <Text style={styles.recordingName}>Recording {i + 1}</Text>
                  <Text style={styles.recordingTime}>
                    {new Date(parseInt(r.timestamp)).toLocaleTimeString([], {
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </Text>
                </View>
                <View style={styles.shareTag}>
                  <Text style={styles.shareTagText}>Share</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => navigation.navigate('Home')}
          activeOpacity={0.85}
        >
          <Text style={styles.homeBtnText}>← Back to Home</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f0faf4' },
  container: {
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'android' ? 60 : 40,
    paddingBottom: 30,
  },
  checkCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#4caf50', justifyContent: 'center',
    alignItems: 'center', marginBottom: 24, alignSelf: 'center',
    shadowColor: '#4caf50', shadowOpacity: 0.4,
    shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  checkIcon: { color: '#fff', fontSize: 52, fontWeight: '800' },
  title: { fontSize: 28, fontWeight: '800', color: '#1b5e20', marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#4caf50', marginBottom: 20, textAlign: 'center' },
  notifyBanner: {
    backgroundColor: '#e8f5e9', borderRadius: 12, padding: 12,
    marginBottom: 20, borderWidth: 1, borderColor: '#c8e6c9',
  },
  notifyText: { fontSize: 13, color: '#2e7d32', textAlign: 'center', fontWeight: '600' },
  summaryCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 20,
    marginBottom: 16,
    shadowColor: '#4caf50', shadowOpacity: 0.08,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: '#1b5e20', marginBottom: 16 },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f8f2',
  },
  summaryLabel: { fontSize: 13, color: '#81c784', fontWeight: '600' },
  summaryValue: { fontSize: 13, color: '#2d4a30', fontWeight: '600', flex: 1, textAlign: 'right' },
  vehicleText: { color: '#2e7d32', fontWeight: '800', letterSpacing: 1 },
  recordingsCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: '#ffcdd2',
    shadowColor: '#e53935', shadowOpacity: 0.06,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  recordingsTitle: { fontSize: 15, fontWeight: '700', color: '#c62828', marginBottom: 4 },
  recordingsSubtitle: { fontSize: 12, color: '#e57373', marginBottom: 12 },
  recordingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#ffebee',
  },
  recordingInfo: { flex: 1 },
  recordingName: { fontSize: 14, fontWeight: '600', color: '#3a1a2e' },
  recordingTime: { fontSize: 12, color: '#888', marginTop: 2 },
  shareTag: {
    backgroundColor: '#e53935', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  shareTagText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  homeBtn: {
    backgroundColor: '#4caf50', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#4caf50', shadowOpacity: 0.3,
    shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  homeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});