// hooks/useVoiceTrigger.js

import { useEffect, useCallback } from 'react';
import { useSpeechRecognitionEvent } from 'expo-speech-recognition';
import {
  startVoiceDetection,
  stopVoiceDetection,
  checkTranscript,
} from '../services/voiceService';

export const useVoiceTrigger = (onTrigger, active = true) => {

  // Listen for speech results
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results?.[0]?.transcript || '';
    checkTranscript(transcript);
  });

  // Restart listening when it ends (keeps it continuous)
  useSpeechRecognitionEvent('end', async () => {
    if (active) {
      console.log('Voice detection restarting...');
      await startVoiceDetection(onTrigger);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    console.log('Voice recognition error:', event.error);
    // Auto restart on error if still active
    if (active && event.error !== 'aborted') {
      setTimeout(() => startVoiceDetection(onTrigger), 2000);
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