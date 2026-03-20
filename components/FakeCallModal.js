import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Modal,
  StyleSheet, Animated, Vibration,
} from 'react-native';

export default function FakeCallModal({ visible, onAnswer, onDecline }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      // Vibrate like a real call
      Vibration.vibrate([500, 1000, 500, 1000], true);

      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      Vibration.cancel();
    }
    return () => Vibration.cancel();
  }, [visible]);

  const handleAnswer = () => {
    Vibration.cancel();
    onAnswer && onAnswer();
  };

  const handleDecline = () => {
    Vibration.cancel();
    onDecline && onDecline();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.callLabel}>Incoming Call</Text>
          <Animated.View style={[styles.avatarCircle, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={styles.avatarIcon}>👩</Text>
          </Animated.View>
          <Text style={styles.callerName}>Mom</Text>
          <Text style={styles.callerSub}>Mobile</Text>

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.declineBtn} onPress={handleDecline} activeOpacity={0.85}>
              <Text style={styles.declineIcon}>📵</Text>
              <Text style={styles.btnLabel}>Decline</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.answerBtn} onPress={handleAnswer} activeOpacity={0.85}>
              <Text style={styles.answerIcon}>📞</Text>
              <Text style={styles.btnLabel}>Answer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center', alignItems: 'center',
  },
  modal: {
    backgroundColor: '#1a1a2e', borderRadius: 28,
    padding: 36, width: '85%', alignItems: 'center',
  },
  callLabel: { color: '#aaa', fontSize: 14, marginBottom: 20 },
  avatarCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#e91e8c', justifyContent: 'center',
    alignItems: 'center', marginBottom: 16,
  },
  avatarIcon: { fontSize: 44 },
  callerName: { color: '#fff', fontSize: 26, fontWeight: '700', marginBottom: 4 },
  callerSub: { color: '#aaa', fontSize: 13, marginBottom: 36 },
  btnRow: { flexDirection: 'row', gap: 40 },
  declineBtn: {
    backgroundColor: '#d32f2f', width: 64, height: 64,
    borderRadius: 32, justifyContent: 'center', alignItems: 'center',
  },
  answerBtn: {
    backgroundColor: '#4caf50', width: 64, height: 64,
    borderRadius: 32, justifyContent: 'center', alignItems: 'center',
  },
  declineIcon: { fontSize: 26 },
  answerIcon: { fontSize: 26 },
  btnLabel: { color: '#fff', fontSize: 11, marginTop: 4, fontWeight: '600' },
});