import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

const TRIGGER_WORDS = ['help', 'sos', 'emergency', 'police', 'bachao'];

let isListening = false;
let onTriggerCallback = null;

export const startVoiceDetection = async (onTrigger) => {
  try {
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      console.log('Speech recognition permission denied');
      return false;
    }

    onTriggerCallback = onTrigger;
    isListening = true;

    await ExpoSpeechRecognitionModule.start({
      lang: 'en-IN',
      continuous: true,
      interimResults: true,
      requiresOnDeviceRecognition: true, // ← offline mode
      addsPunctuation: false,
    });

    console.log('Voice detection started');
    return true;
  } catch (error) {
    // If offline not available, fall back to online
    console.log('Offline not available, trying online...');
    try {
      await ExpoSpeechRecognitionModule.start({
        lang: 'en-IN',
        continuous: true,
        interimResults: true,
        requiresOnDeviceRecognition: false,
        addsPunctuation: false,
      });
      return true;
    } catch (fallbackError) {
      console.error('Voice detection failed:', fallbackError);
      return false;
    }
  }
};

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

export const isVoiceDetectionActive = () => isListening;