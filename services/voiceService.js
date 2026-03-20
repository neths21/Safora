// services/voiceService.js

import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

const TRIGGER_WORDS = ['help', 'sos', 'emergency', 'police'];

let isListening = false;
let onTriggerCallback = null;

// ─── START LISTENING ──────────────────────────────────────

export const startVoiceDetection = async (onTrigger) => {
  try {
    // Request permission
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      console.log('Speech recognition permission denied');
      return false;
    }

    onTriggerCallback = onTrigger;
    isListening = true;

    await ExpoSpeechRecognitionModule.start({
      lang: 'en-IN', // Indian English
      continuous: true, // keep listening
      interimResults: true, // get results as user speaks
    });

    console.log('Voice detection started');
    return true;
  } catch (error) {
    console.error('Error starting voice detection:', error);
    return false;
  }
};

// ─── STOP LISTENING ───────────────────────────────────────

export const stopVoiceDetection = async () => {
  try {
    isListening = false;
    onTriggerCallback = null;
    await ExpoSpeechRecognitionModule.stop();
    console.log('Voice detection stopped');
  } catch (error) {
    console.error('Error stopping voice detection:', error);
  }
};

// ─── CHECK TRANSCRIPT FOR TRIGGER WORDS ──────────────────

export const checkTranscript = (transcript) => {
  if (!transcript || !isListening) return false;
  const lower = transcript.toLowerCase();
  const triggered = TRIGGER_WORDS.some(word => lower.includes(word));
  if (triggered && onTriggerCallback) {
    console.log('Trigger word detected:', transcript);
    onTriggerCallback(transcript);
  }
  return triggered;
};

// ─── HELPERS ──────────────────────────────────────────────

export const isVoiceDetectionActive = () => isListening;