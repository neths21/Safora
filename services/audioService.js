// services/audioService.js

import { Audio } from 'expo-av';
import { File, Directory, Paths } from 'expo-file-system/next';

let recording = null;
let _recordingLock = false; // guard against concurrent startRecording calls

// ─── START RECORDING ──────────────────────────────────────

export const startRecording = async () => {
  // Guard against concurrent calls
  if (_recordingLock) {
    console.warn('startRecording called while another start is in progress');
    return false;
  }
  _recordingLock = true;

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
  } finally {
    _recordingLock = false;
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

    if (!tempUri) {
      console.error('Recording URI was null after stopping');
      return null;
    }

    // Move from temp cache to permanent document storage using new File API.
    // move() takes a single destination — pass a File (not Directory + name)
    // to control the final filename.
    const fileName = `safora_emergency_${userId}_${Date.now()}.m4a`;
    const tempFile = new File(tempUri);
    const destFile = new File(Paths.document, fileName);
    tempFile.move(destFile);

    const permanentUri = destFile.uri;
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
    const prefix = `safora_emergency_${userId}_`;

    // New Directory API: list() returns File/Directory instances
    const docDir = new Directory(Paths.document);
    const entries = docDir.list();

    const userRecordings = entries.filter(
      entry => entry instanceof File &&
               entry.name.startsWith(prefix) &&
               entry.name.endsWith('.m4a')
    );

    return userRecordings.map(file => {
      // Safely extract timestamp: safora_emergency_<userId>_<timestamp>.m4a
      const withoutPrefix = file.name.slice(prefix.length);
      const timestampStr = withoutPrefix.replace(/\.m4a$/, '');
      const timestamp = parseInt(timestampStr, 10);

      return {
        fileName: file.name,
        uri: file.uri,
        timestamp: Number.isFinite(timestamp) ? timestamp : null,
      };
    });
  } catch (error) {
    console.error('Error listing recordings:', error);
    return [];
  }
};

// ─── HELPERS ──────────────────────────────────────────────

export const isRecording = () => recording !== null;