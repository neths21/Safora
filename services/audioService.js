// services/audioService.js

import { Audio } from 'expo-av';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebaseConfig';

let recording = null;

// ─── START RECORDING ──────────────────────────────────────

// Called automatically when SOS is triggered
export const startRecording = async () => {
  try {
    // Ask for microphone permission
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) {
      console.log('Microphone permission denied');
      return false;
    }

    // Set audio mode for recording
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    // Start recording
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

// Called when emergency is resolved or ride ends
// Returns the local file URI of the recording
export const stopRecording = async (userId) => {
  try {
    if (!recording) {
      console.log('No active recording to stop');
      return null;
    }

    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    recording = null;

    console.log('Recording stopped. File saved at:', uri);
    return uri;
  } catch (error) {
    console.error('Error stopping recording:', error);
    throw error;
  }
};

// ─── HELPERS ──────────────────────────────────────────────

// Check if recording is currently active
export const isRecording = () => recording !== null;