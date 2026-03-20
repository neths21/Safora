import { useEffect, useRef } from 'react';
import { useSpeechRecognitionEvent } from 'expo-speech-recognition';
import {
  startVoiceDetection,
  stopVoiceDetection,
  checkTranscript,
  isVoiceDetectionActive,
} from '../services/voiceService';

export const useVoiceTrigger = (onTrigger, active = true) => {
  const restartTimer = useRef(null);
  const watchdogTimer = useRef(null);
  const triggered = useRef(false);

  const scheduleRestart = (delay = 1500) => {
    if (restartTimer.current) clearTimeout(restartTimer.current);
    restartTimer.current = setTimeout(async () => {
      if (active && !triggered.current) {
        await stopVoiceDetection();
        await startVoiceDetection(onTrigger);
        startWatchdog();
      }
    }, delay);
  };

  // Watchdog — checks every 5 seconds if voice is still active
  // If not, restarts it
  const startWatchdog = () => {
    if (watchdogTimer.current) clearInterval(watchdogTimer.current);
    watchdogTimer.current = setInterval(() => {
      if (active && !triggered.current && !isVoiceDetectionActive()) {
        console.log('Watchdog restarting voice detection...');
        startVoiceDetection(onTrigger);
      }
    }, 5000);
  };

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results?.[0]?.transcript || '';
    if (transcript) {
      console.log('Heard:', transcript);
      const detected = checkTranscript(transcript);
      if (detected) {
        triggered.current = true;
        if (watchdogTimer.current) clearInterval(watchdogTimer.current);
      }
    }
  });

  useSpeechRecognitionEvent('end', () => {
    if (active && !triggered.current) {
      scheduleRestart(1500);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    console.log('Voice error:', event.error);
    if (active && !triggered.current) {
      const delay =
        event.error === 'no-speech' ? 1500
        : event.error === 'busy' ? 4000
        : event.error === 'network' ? 8000
        : 3000;
      scheduleRestart(delay);
    }
  });

  useEffect(() => {
    if (active) {
      triggered.current = false;
      startVoiceDetection(onTrigger);
      startWatchdog();
    }
    return () => {
      if (restartTimer.current) clearTimeout(restartTimer.current);
      if (watchdogTimer.current) clearInterval(watchdogTimer.current);
      stopVoiceDetection();
    };
  }, [active]);
};