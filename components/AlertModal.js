import React from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
} from 'react-native';

export default function AlertModal({ visible, title, message, onSafe, onHelp }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>{title || 'Are you safe?'}</Text>
          <Text style={styles.message}>
            {message || 'A route deviation was detected. Please confirm your status.'}
          </Text>

          <TouchableOpacity style={styles.safeBtn} onPress={onSafe} activeOpacity={0.85}>
            <Text style={styles.safeBtnText}>✓ Yes, I am Safe</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.helpBtn} onPress={onHelp} activeOpacity={0.85}>
            <Text style={styles.helpBtnText}>🚨 I Need Help</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modal: {
    backgroundColor: '#fff', borderRadius: 20,
    padding: 28, width: '100%', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.3,
    shadowRadius: 20, elevation: 10,
  },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: '#3a1a2e', marginBottom: 10 },
  message: { fontSize: 14, color: '#7a5060', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  safeBtn: {
    backgroundColor: '#4caf50', borderRadius: 12,
    paddingVertical: 14, width: '100%', alignItems: 'center', marginBottom: 10,
  },
  safeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  helpBtn: {
    backgroundColor: '#d32f2f', borderRadius: 12,
    paddingVertical: 14, width: '100%', alignItems: 'center',
  },
  helpBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});