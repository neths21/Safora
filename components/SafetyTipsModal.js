// components/SafetyTipsModal.js

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal,
  StyleSheet, Animated, ScrollView,
} from 'react-native';

const SAFETY_TIPS = [
  {
    icon: '📞',
    title: 'Stay on the phone',
    tip: 'Call a trusted contact and keep the line open. Let them hear what is happening.',
  },
  {
    icon: '📋',
    title: 'Note the vehicle details',
    tip: 'Remember or note the vehicle number, colour, and driver description.',
  },
  {
    icon: '👥',
    title: 'Move to a public place',
    tip: 'If possible, ask the driver to stop near a busy area, petrol station or shop.',
  },
  {
    icon: '🔊',
    title: 'Make noise',
    tip: 'Do not stay silent. Talk loudly or make noise to attract attention around you.',
  },
  {
    icon: '📍',
    title: 'Share your location',
    tip: 'Your live location has been sent to your trusted contacts automatically.',
  },
  {
    icon: '🚨',
    title: 'Emergency numbers',
    tip: 'Women Helpline: 1091 | Police: 100 | Ambulance: 108',
  },
  {
    icon: '🧠',
    title: 'Stay calm',
    tip: 'Take a deep breath. Think clearly. Help is on the way.',
  },
];

// Auto-cycles through tips one by one every few seconds
export default function SafetyTipsModal({ visible, onClose }) {
  const [currentTip, setCurrentTip] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (visible) {
      setCurrentTip(0);
      setShowAll(false);
      animateIn();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || showAll) return;

    // Auto-cycle to next tip every 4 seconds
    const interval = setInterval(() => {
      setCurrentTip(prev => {
        if (prev < SAFETY_TIPS.length - 1) {
          animateIn();
          return prev + 1;
        } else {
          // All tips shown — show full list
          setShowAll(true);
          clearInterval(interval);
          return prev;
        }
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [visible, showAll]);

  const animateIn = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  };

  const tip = SAFETY_TIPS[currentTip];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>

          <View style={styles.header}>
            <Text style={styles.headerIcon}>🛡️</Text>
            <Text style={styles.headerTitle}>Stay Safe</Text>
            <Text style={styles.headerSubtitle}>Help is on the way</Text>
          </View>

          {!showAll ? (
            // Single tip cycling view
            <Animated.View style={[
              styles.tipCard,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}>
              <Text style={styles.tipIcon}>{tip.icon}</Text>
              <Text style={styles.tipTitle}>{tip.title}</Text>
              <Text style={styles.tipText}>{tip.tip}</Text>

              <View style={styles.dotsRow}>
                {SAFETY_TIPS.map((_, i) => (
                  <View
                    key={i}
                    style={[styles.dot, i === currentTip && styles.dotActive]}
                  />
                ))}
              </View>

              <TouchableOpacity
                style={styles.allTipsBtn}
                onPress={() => setShowAll(true)}
              >
                <Text style={styles.allTipsBtnText}>See all tips</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            // Full list view
            <ScrollView
              style={styles.allTipsList}
              showsVerticalScrollIndicator={false}
            >
              {SAFETY_TIPS.map((t, i) => (
                <View key={i} style={styles.allTipRow}>
                  <Text style={styles.allTipIcon}>{t.icon}</Text>
                  <View style={styles.allTipContent}>
                    <Text style={styles.allTipTitle}>{t.title}</Text>
                    <Text style={styles.allTipText}>{t.tip}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.closeBtnText}>I understand — close</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modal: {
    backgroundColor: '#fff', borderRadius: 24,
    padding: 24, width: '100%', maxHeight: '85%',
  },
  header: { alignItems: 'center', marginBottom: 20 },
  headerIcon: { fontSize: 40, marginBottom: 8 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#3a1a2e' },
  headerSubtitle: { fontSize: 13, color: '#e91e8c', marginTop: 4, fontWeight: '600' },
  tipCard: { alignItems: 'center', paddingVertical: 10 },
  tipIcon: { fontSize: 52, marginBottom: 16 },
  tipTitle: { fontSize: 18, fontWeight: '700', color: '#3a1a2e', marginBottom: 10 },
  tipText: {
    fontSize: 14, color: '#7a5060', textAlign: 'center',
    lineHeight: 22, marginBottom: 20, paddingHorizontal: 10,
  },
  dotsRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  dot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: '#f0d0e4',
  },
  dotActive: { backgroundColor: '#e91e8c', width: 18 },
  allTipsBtn: { paddingVertical: 6 },
  allTipsBtnText: { color: '#e91e8c', fontSize: 13, fontWeight: '600' },
  allTipsList: { maxHeight: 340, marginBottom: 8 },
  allTipRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5e4ee',
  },
  allTipIcon: { fontSize: 24, marginRight: 14, marginTop: 2 },
  allTipContent: { flex: 1 },
  allTipTitle: { fontSize: 14, fontWeight: '700', color: '#3a1a2e', marginBottom: 4 },
  allTipText: { fontSize: 12.5, color: '#7a5060', lineHeight: 18 },
  closeBtn: {
    backgroundColor: '#e91e8c', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 12,
  },
  closeBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});