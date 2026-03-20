import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal,
  StyleSheet, Animated, Vibration,
} from 'react-native';
import { Audio } from 'expo-av';

const LANGUAGES = [
  { label: 'हिंदी', value: 'hindi' },
  { label: 'Tamil', value: 'tamil' },
];

export default function FakeCallModal({ visible, onAnswer, onDecline }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [answered, setAnswered] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [selectedLang, setSelectedLang] = useState('hindi');
  const soundRef = useRef(null);
  const promptSoundRef = useRef(null);
  const pulseRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setAnswered(false);
      setCallDuration(0);
      startRinging();
      Vibration.vibrate([500, 1000, 500, 1000], true);
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulseRef.current.start();
    } else {
      stopRinging();
      stopPrompts();
      Vibration.cancel();
      pulseRef.current?.stop();
    }
    return () => {
      stopRinging();
      stopPrompts();
      Vibration.cancel();
      pulseRef.current?.stop();
    };
  }, [visible]);

  useEffect(() => {
    if (!answered) return;
    const interval = setInterval(() => setCallDuration(p => p + 1), 1000);
    return () => clearInterval(interval);
  }, [answered]);

  const startRinging = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/ringtone.mp3'),
        { shouldPlay: true, isLooping: true, volume: 1.0 }
      );
      soundRef.current = sound;
    } catch (error) {
      console.error('Error playing ringtone:', error);
    }
  };

  const stopRinging = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    } catch (error) {
      console.error('Error stopping ringtone:', error);
    }
  };

  const startPrompts = async () => {
    try {
      // Switch to earpiece so only user hears prompts
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: true, // plays through earpiece only
      });

      const audioFile = selectedLang === 'hindi'
        ? require('../assets/prompts_hindi.mp3')
        : require('../assets/prompts_tamil.mp3');

      const { sound } = await Audio.Sound.createAsync(
        audioFile,
        { shouldPlay: true, isLooping: false, volume: 1.0 }
      );
      promptSoundRef.current = sound;
      console.log('Prompts playing in earpiece');
    } catch (error) {
      console.error('Error playing prompts:', error);
    }
  };

  const stopPrompts = async () => {
    try {
      if (promptSoundRef.current) {
        await promptSoundRef.current.stopAsync();
        await promptSoundRef.current.unloadAsync();
        promptSoundRef.current = null;
      }
    } catch (error) {
      console.error('Error stopping prompts:', error);
    }
  };

  const handleAnswer = async () => {
    await stopRinging();
    Vibration.cancel();
    pulseRef.current?.stop();
    setAnswered(true);
    await startPrompts(); // start guided prompts in earpiece
    onAnswer && onAnswer();
  };

  const handleDecline = async () => {
    await stopRinging();
    await stopPrompts();
    Vibration.cancel();
    pulseRef.current?.stop();
    setAnswered(false);
    onDecline && onDecline();
  };

  const handleEndCall = async () => {
    await stopRinging();
    await stopPrompts();
    setAnswered(false);
    onDecline && onDecline();
  };

  const formatDuration = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modal}>

          {!answered ? (
            <>
              <Text style={styles.callLabel}>Incoming Call</Text>

              {/* Language selector */}
              <View style={styles.langRow}>
                {LANGUAGES.map(lang => (
                  <TouchableOpacity
                    key={lang.value}
                    style={[styles.langBtn, selectedLang === lang.value && styles.langBtnActive]}
                    onPress={() => setSelectedLang(lang.value)}
                  >
                    <Text style={[styles.langBtnText, selectedLang === lang.value && styles.langBtnTextActive]}>
                      {lang.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Animated.View style={[styles.avatarCircle, { transform: [{ scale: pulseAnim }] }]}>
                <Text style={styles.avatarIcon}>👨</Text>
              </Animated.View>
              <Text style={styles.callerName}>Dad</Text>
              <Text style={styles.callerSub}>Mobile</Text>

              <View style={styles.btnRow}>
                <View style={styles.btnCol}>
                  <TouchableOpacity style={styles.declineBtn} onPress={handleDecline} activeOpacity={0.85}>
                    <Text style={styles.btnIcon}>📵</Text>
                  </TouchableOpacity>
                  <Text style={styles.btnLabel}>Decline</Text>
                </View>
                <View style={styles.btnCol}>
                  <TouchableOpacity style={styles.answerBtn} onPress={handleAnswer} activeOpacity={0.85}>
                    <Text style={styles.btnIcon}>📞</Text>
                  </TouchableOpacity>
                  <Text style={styles.btnLabel}>Answer</Text>
                </View>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.callLabel}>On a call</Text>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarIcon}>👩</Text>
              </View>
              <Text style={styles.callerName}>Mom</Text>
              <Text style={styles.callTimer}>{formatDuration(callDuration)}</Text>

              <View style={styles.promptBanner}>
                <Text style={styles.promptText}>
                  🎧 Guided prompts playing in your earpiece
                </Text>
              </View>

              <View style={styles.activeCallBtns}>
                <View style={styles.btnCol}>
                  <View style={styles.muteBtn}>
                    <Text style={styles.btnIcon}>🔇</Text>
                  </View>
                  <Text style={styles.btnLabel}>Mute</Text>
                </View>
                <View style={styles.btnCol}>
                  <View style={styles.speakerBtn}>
                    <Text style={styles.btnIcon}>🔊</Text>
                  </View>
                  <Text style={styles.btnLabel}>Speaker</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.endCallBtn} onPress={handleEndCall} activeOpacity={0.85}>
                <Text style={styles.btnIcon}>📵</Text>
              </TouchableOpacity>
              <Text style={[styles.btnLabel, { marginTop: 6, color: '#aaa' }]}>End Call</Text>
            </>
          )}

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
  callLabel: { color: '#aaa', fontSize: 14, marginBottom: 12 },
  langRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  langBtn: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: '#444',
  },
  langBtnActive: { backgroundColor: '#e91e8c', borderColor: '#e91e8c' },
  langBtnText: { color: '#aaa', fontSize: 13, fontWeight: '600' },
  langBtnTextActive: { color: '#fff' },
  avatarCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#e91e8c', justifyContent: 'center',
    alignItems: 'center', marginBottom: 16,
  },
  avatarIcon: { fontSize: 44 },
  callerName: { color: '#fff', fontSize: 26, fontWeight: '700', marginBottom: 4 },
  callerSub: { color: '#aaa', fontSize: 13, marginBottom: 36 },
  callTimer: { color: '#4caf50', fontSize: 16, fontWeight: '600', marginBottom: 16 },
  promptBanner: {
    backgroundColor: '#1e3a2f', borderRadius: 10, padding: 10,
    marginBottom: 24, borderWidth: 1, borderColor: '#2e7d32',
  },
  promptText: { color: '#81c784', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  btnRow: { flexDirection: 'row', gap: 40 },
  activeCallBtns: { flexDirection: 'row', gap: 40, marginBottom: 30 },
  btnCol: { alignItems: 'center' },
  declineBtn: {
    backgroundColor: '#d32f2f', width: 64, height: 64,
    borderRadius: 32, justifyContent: 'center', alignItems: 'center',
  },
  answerBtn: {
    backgroundColor: '#4caf50', width: 64, height: 64,
    borderRadius: 32, justifyContent: 'center', alignItems: 'center',
  },
  muteBtn: {
    backgroundColor: '#37474f', width: 56, height: 56,
    borderRadius: 28, justifyContent: 'center', alignItems: 'center',
  },
  speakerBtn: {
    backgroundColor: '#37474f', width: 56, height: 56,
    borderRadius: 28, justifyContent: 'center', alignItems: 'center',
  },
  endCallBtn: {
    backgroundColor: '#d32f2f', width: 64, height: 64,
    borderRadius: 32, justifyContent: 'center', alignItems: 'center',
  },
  btnIcon: { fontSize: 26 },
  btnLabel: { color: '#aaa', fontSize: 11, marginTop: 6, fontWeight: '600' },
});