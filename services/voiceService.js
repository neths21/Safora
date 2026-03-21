// services/voiceService.js

import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

const TRIGGER_WORDS = ['help', 'sos', 'emergency', 'police', 'bachao', 'help me'];

// All state is encapsulated — never export raw mutable variables
let isListening = false;
let isStarting = false;
let onTriggerCallback = null;

const LANGUAGES = ['en-US', 'en-GB', 'en'];

// ─── START ────────────────────────────────────────────────

export const startVoiceDetection = async (onTrigger) => {
  if (isStarting) return false;
  isStarting = true;
  isListening = false;

  try {
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      console.log('Speech permission denied');
      return false;
    }

    for (const lang of LANGUAGES) {
      try {
        await ExpoSpeechRecognitionModule.start({
          lang,
          continuous: false,
          interimResults: true,
          requiresOnDeviceRecognition: false,
          addsPunctuation: false,
        });

        // Only assign the callback after a successful start
        onTriggerCallback = onTrigger;
        isListening = true;
        console.log('Voice detection started:', lang);
        return true;
      } catch (e) {
        console.warn(`Voice detection failed for lang "${lang}":`, e.message);
      }
    }

    console.error('Voice detection failed for all languages:', LANGUAGES);
    return false;
  } catch (error) {
    console.error('Voice start failed:', error.message);
    isListening = false;
    return false;
  } finally {
    isStarting = false;
  }
};

// ─── STOP ─────────────────────────────────────────────────

export const stopVoiceDetection = async () => {
  isListening = false;
  isStarting = false;
  onTriggerCallback = null;
  try {
    await ExpoSpeechRecognitionModule.stop();
  } catch (e) {
    // ignore — may already be stopped
  }
};

// ─── HANDLE TRANSCRIPT ────────────────────────────────────
// Named to reflect that it both checks AND fires the callback (side effect).
// Returns true if a trigger word was found.

export const handleTranscript = (transcript) => {
  if (!transcript) return false;

  const lower = transcript.toLowerCase();
  const triggered = TRIGGER_WORDS.some(word => lower.includes(word));

  if (triggered) {
    console.log('Trigger word detected:', transcript);
    if (onTriggerCallback) {
      onTriggerCallback(transcript);
    }
  }

  return triggered;
};

// Keep checkTranscript as a deprecated alias so existing callers don't break
export const checkTranscript = handleTranscript;

// ─── STATUS ───────────────────────────────────────────────

export const isVoiceDetectionActive = () => isListening;