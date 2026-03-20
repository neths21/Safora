import { useEffect } from 'react';
import { useSpeechRecognitionEvent } from 'expo-speech-recognition';
import {
  startVoiceDetection,
  stopVoiceDetection,
  checkTranscript,
} from '../services/voiceService';

export const useVoiceTrigger = (onTrigger, active = true) => {

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results?.[0]?.transcript || '';
    console.log('Heard:', transcript);
    checkTranscript(transcript);
  });

  useSpeechRecognitionEvent('end', async () => {
    if (active) {
      // Small delay before restarting to avoid rapid loops
      setTimeout(() => startVoiceDetection(onTrigger), 1000);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    console.log('Voice error:', event.error);
    if (active && event.error !== 'aborted' && event.error !== 'network') {
      // Only restart on non-network errors
      setTimeout(() => startVoiceDetection(onTrigger), 3000);
    } else if (event.error === 'network') {
      // Network error — try again after longer delay
      setTimeout(() => startVoiceDetection(onTrigger), 5000);
    }
  });

  useEffect(() => {
    if (active) {
      startVoiceDetection(onTrigger);
    }
    return () => {
      stopVoiceDetection();
    };
  }, [active]);
};