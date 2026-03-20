import React, { useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';

export default function SOSButton({ onPress }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 0.9, duration: 100, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    onPress && onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <TouchableOpacity style={styles.btn} onPress={handlePress} activeOpacity={0.8}>
        <Text style={styles.icon}>🚨</Text>
        <Text style={styles.text}>SOS</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: '#d32f2f', width: 70, height: 70,
    borderRadius: 35, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#d32f2f', shadowOpacity: 0.5,
    shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  icon: { fontSize: 22 },
  text: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
});