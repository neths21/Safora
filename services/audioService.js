// services/audioService.js

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

let recording = null;

// ─── START RECORDING ──────────────────────────────────────

export const startRecording = async () => {
  try {
    // Clean up any existing recording first
    if (recording) {
      try {
        await recording.stopAndUnloadAsync();
      } catch (e) {
        // ignore cleanup errors
      }
      recording = null;
    }

    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) {
      console.log('Microphone permission denied');
      return false;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const { recording: newRecording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );

    recording = newRecording;
    console.log('Recording started');
    return true;
  } catch (error) {
    console.error('Error starting recording:', error);
    throw error;
  }
};

// ─── STOP RECORDING ───────────────────────────────────────

export const stopRecording = async (userId) => {
  try {
    if (!recording) {
      console.log('No active recording to stop');
      return null;
    }

    await recording.stopAndUnloadAsync();
    const tempUri = recording.getURI();
    recording = null;

    // Move from cache to permanent storage
    const fileName = `safora_emergency_${userId}_${Date.now()}.m4a`;
    const permanentUri = FileSystem.documentDirectory + fileName;

    await FileSystem.moveAsync({
      from: tempUri,
      to: permanentUri,
    });

    console.log('Recording permanently saved at:', permanentUri);
    return permanentUri;

  } catch (error) {
    console.error('Error stopping recording:', error);
    throw error;
  }
};

// ─── LIST ALL RECORDINGS ──────────────────────────────────

// Returns all saved emergency recordings for a user
export const getRecordings = async (userId) => {
  try {
    const files = await FileSystem.readDirectoryAsync(
      FileSystem.documentDirectory
    );
    const userRecordings = files.filter(
      f => f.startsWith(`safora_emergency_${userId}`)
    );
    return userRecordings.map(f => ({
      fileName: f,
      uri: FileSystem.documentDirectory + f,
      timestamp: f.split('_').pop().replace('.m4a', ''),
    }));
  } catch (error) {
    console.error('Error listing recordings:', error);
    return [];
  }
};

// ─── HELPERS ──────────────────────────────────────────────

export const isRecording = () => recording !== null;