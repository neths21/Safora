import React from 'react';
import { View, TextInput, Text, StyleSheet } from 'react-native';

export default function DestinationInput({ value, onChangeText, placeholder }) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>🏁 Destination</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder || 'Enter your destination'}
        placeholderTextColor="#bbb"
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#7a3a60', marginBottom: 8 },
  input: {
    borderWidth: 1.5, borderColor: '#f0d0e4', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13, fontSize: 15,
    color: '#2d1a24', backgroundColor: '#fef8fb',
  },
});