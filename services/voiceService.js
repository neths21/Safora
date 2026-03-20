import {
  ExpoSpeechRecognitionModule,
} from 'expo-speech-recognition';

const TRIGGER_WORDS = ['help', 'sos', 'emergency', 'police', 'bachao', 'help me'];

let isListening = false;
let isStarting = false;
let onTriggerCallback = null;

export const startVoiceDetection = async (onTrigger) => {
  if (isStarting) return;
  isStarting = true;
  isListening = false;

  try {
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      console.log('Speech permission denied');
      isStarting = false;
      return false;
    }

    onTriggerCallback = onTrigger;

    const languages = ['en-US', 'en-GB', 'en'];

    for (const lang of languages) {
      try {
        await ExpoSpeechRecognitionModule.start({
          lang,
          continuous: false,
          interimResults: true,
          requiresOnDeviceRecognition: false,
          addsPunctuation: false,
        });
        isListening = true;
        isStarting = false;
        console.log('Voice detection started:', lang);
        return true;
      } catch (e) {
        continue;
      }
    }

    isStarting = false;
    return false;
  } catch (error) {
    console.error('Voice start failed:', error.message);
    isStarting = false;
    isListening = false;
    return false;
  }
};

export const stopVoiceDetection = async () => {
  isListening = false;
  isStarting = false;
  onTriggerCallback = null;
  try {
    await ExpoSpeechRecognitionModule.stop();
  } catch (e) {
    // ignore
  }
};

export const checkTranscript = (transcript) => {
  if (!transcript) return false;
  const lower = transcript.toLowerCase();
  const triggered = TRIGGER_WORDS.some(word => lower.includes(word));
  if (triggered && onTriggerCallback) {
    console.log('Trigger word detected:', transcript);
    onTriggerCallback(transcript);
  }
  return triggered;
};

export const isVoiceDetectionActive = () => isListening;