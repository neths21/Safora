import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, Platform, Animated, Linking, Alert, ScrollView,
} from 'react-native';
import { triggerSOS, resolveEmergency } from '../services/emergencyService';
import { isRecording } from '../services/audioService';
import * as Location from 'expo-location';
import * as Sharing from 'expo-sharing';
import SafetyTipsModal from '../components/SafetyTipsModal';

export default function EmergencyScreen({ navigation, route }) {
  const { vehicleNumber, pickup, destination, userId } = route.params || {};
  const alertAnim = useRef(new Animated.Value(0)).current;
  const [recording, setRecording] = useState(false);
  const [sosTriggered, setSosTriggered] = useState(false);
  const [showSafetyTips, setShowSafetyTips] = useState(false);
  const [recordingUri, setRecordingUri] = useState(null);

  useEffect(() => {
    Animated.timing(alertAnim, {
      toValue: 1, duration: 400, useNativeDriver: true
    }).start();

    triggerSOSOnLoad();

    const interval = setInterval(() => {
      setRecording(isRecording());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const triggerSOSOnLoad = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
      await triggerSOS(userId || 'defaultUser', latitude, longitude);
      setSosTriggered(true);
      setShowSafetyTips(true);
      console.log('SOS triggered from EmergencyScreen');
    } catch (error) {
      console.error('Error triggering SOS:', error.message);
      setSosTriggered(true);
      setShowSafetyTips(true);
    }
  };

  const handleBack = async () => {
    Alert.alert(
      'Are you safe?',
      'Going back will resolve the emergency and stop recording.',
      [
        { text: 'Stay here', style: 'cancel' },
        {
          text: 'Yes, I am safe',
          onPress: async () => {
            try {
              const uri = await resolveEmergency(userId || 'defaultUser');
              if (uri) {
                setRecordingUri(uri);
                Alert.alert(
                  'Recording Saved',
                  'Emergency audio has been saved to your device. Share it now?',
                  [
                    {
                      text: 'Share Now',
                      onPress: async () => {
                        try {
                          await Sharing.shareAsync(uri);
                        } catch (e) {
                          console.error('Error sharing:', e.message);
                        }
                        navigation.goBack();
                      },
                    },
                    {
                      text: 'Later',
                      onPress: () => navigation.goBack(),
                    },
                  ]
                );
              } else {
                navigation.goBack();
              }
            } catch (error) {
              console.error('Error resolving emergency:', error.message);
              navigation.goBack();
            }
          },
        },
      ]
    );
  };

  const callNumber = (number, name) => {
    Alert.alert(`Call ${name}`, `Call ${name} at ${number}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Call Now',
        onPress: () => Linking.openURL(`tel:${number}`).catch(() =>
          Alert.alert('Error', 'Unable to make call. Please dial manually.')
        ),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        <Animated.View style={[styles.alertBanner, { opacity: alertAnim }]}>
          <Text style={styles.alertIcon}>🚨</Text>
          <View>
            <Text style={styles.alertTitle}>SOS ACTIVATED</Text>
            <Text style={styles.alertSubtitle}>
              {sosTriggered ? 'Emergency Alert Sent' : 'Sending alert...'}
            </Text>
          </View>
        </Animated.View>

        {recording && (
          <View style={styles.recordingBanner}>
            <Text style={styles.recordingDot}>●</Text>
            <Text style={styles.recordingText}>Recording in progress</Text>
          </View>
        )}

        <View style={styles.messageCard}>
          <Text style={styles.messageTitle}>⚠️  Stay Calm</Text>
          <Text style={styles.messageText}>
            Your emergency alert has been triggered. Use the options below to contact emergency services immediately.
          </Text>
        </View>

        {vehicleNumber && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>📋  Share This With Authorities</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Vehicle No:</Text>
              <Text style={styles.infoValue}>{vehicleNumber}</Text>
            </View>
            {pickup && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Boarded at:</Text>
                <Text style={styles.infoValue}>{pickup}</Text>
              </View>
            )}
            {destination && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Going to:</Text>
                <Text style={styles.infoValue}>{destination}</Text>
              </View>
            )}
          </View>
        )}

        <Text style={styles.sectionTitle}>📞  Emergency Helplines</Text>

        <TouchableOpacity style={[styles.callBtn, styles.womenBtn]} onPress={() => callNumber('1091', 'Women Helpline')} activeOpacity={0.85}>
          <View style={styles.callBtnLeft}>
            <Text style={styles.callBtnIcon}>👩</Text>
            <View>
              <Text style={styles.callBtnTitle}>Women Helpline</Text>
              <Text style={styles.callBtnNumber}>1091</Text>
            </View>
          </View>
          <View style={styles.callTag}>
            <Text style={styles.callTagText}>CALL</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.callBtn, styles.policeBtn]} onPress={() => callNumber('100', 'Police')} activeOpacity={0.85}>
          <View style={styles.callBtnLeft}>
            <Text style={styles.callBtnIcon}>👮</Text>
            <View>
              <Text style={styles.callBtnTitle}>Police</Text>
              <Text style={styles.callBtnNumber}>100</Text>
            </View>
          </View>
          <View style={[styles.callTag, { backgroundColor: '#1565c0' }]}>
            <Text style={styles.callTagText}>CALL</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.callBtn, styles.ambulanceBtn]} onPress={() => callNumber('108', 'Ambulance')} activeOpacity={0.85}>
          <View style={styles.callBtnLeft}>
            <Text style={styles.callBtnIcon}>🚑</Text>
            <View>
              <Text style={styles.callBtnTitle}>Ambulance</Text>
              <Text style={styles.callBtnNumber}>108</Text>
            </View>
          </View>
          <View style={[styles.callTag, { backgroundColor: '#2e7d32' }]}>
            <Text style={styles.callTagText}>CALL</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.85}>
          <Text style={styles.backBtnText}>← I am Safe</Text>
        </TouchableOpacity>

      </ScrollView>

      <SafetyTipsModal
        visible={showSafetyTips}
        onClose={() => setShowSafetyTips(false)}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff5f5' },
  container: { paddingHorizontal: 22, paddingTop: Platform.OS === 'android' ? 48 : 20, paddingBottom: 40 },
  alertBanner: {
    backgroundColor: '#d32f2f', borderRadius: 16, padding: 18,
    flexDirection: 'row', alignItems: 'center', marginBottom: 16,
    shadowColor: '#d32f2f', shadowOpacity: 0.4, shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  alertIcon: { fontSize: 36, marginRight: 14 },
  alertTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  alertSubtitle: { color: '#ffcdd2', fontSize: 13, marginTop: 2 },
  recordingBanner: {
    backgroundColor: '#ffebee', borderRadius: 10, padding: 10,
    flexDirection: 'row', alignItems: 'center', marginBottom: 12,
    borderWidth: 1, borderColor: '#ef9a9a',
  },
  recordingDot: { color: '#d32f2f', fontSize: 16, marginRight: 8 },
  recordingText: { color: '#d32f2f', fontWeight: '700', fontSize: 13 },
  messageCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14,
    borderLeftWidth: 4, borderLeftColor: '#e53935',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  messageTitle: { fontSize: 15, fontWeight: '700', color: '#3a1a2e', marginBottom: 6 },
  messageText: { fontSize: 13.5, color: '#6b4050', lineHeight: 20 },
  infoCard: {
    backgroundColor: '#fff3e0', borderRadius: 14, padding: 16,
    marginBottom: 20, borderWidth: 1, borderColor: '#ffe0b2',
  },
  infoTitle: { fontSize: 13, fontWeight: '700', color: '#e65100', marginBottom: 10 },
  infoRow: { flexDirection: 'row', marginBottom: 6 },
  infoLabel: { fontSize: 13, color: '#a06040', fontWeight: '600', width: 90 },
  infoValue: { fontSize: 13, color: '#3a1a2e', fontWeight: '700', flex: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#3a1a2e', marginBottom: 12 },
  callBtn: {
    borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12, backgroundColor: '#fff',
    shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  womenBtn: { borderWidth: 2, borderColor: '#e91e8c', shadowColor: '#e91e8c' },
  policeBtn: { borderWidth: 2, borderColor: '#1565c0', shadowColor: '#1565c0' },
  ambulanceBtn: { borderWidth: 2, borderColor: '#2e7d32', shadowColor: '#2e7d32' },
  callBtnLeft: { flexDirection: 'row', alignItems: 'center' },
  callBtnIcon: { fontSize: 30, marginRight: 14 },
  callBtnTitle: { fontSize: 16, fontWeight: '700', color: '#3a1a2e' },
  callBtnNumber: { fontSize: 22, fontWeight: '900', color: '#c0136e', letterSpacing: 1 },
  callTag: { backgroundColor: '#e91e8c', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  callTagText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 1 },
  backBtn: {
    marginTop: 10, alignItems: 'center', paddingVertical: 14,
    borderRadius: 12, borderWidth: 1.5, borderColor: '#f0c0d0', backgroundColor: '#fff',
  },
  backBtnText: { color: '#c0136e', fontWeight: '700', fontSize: 15 },
});