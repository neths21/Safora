// hooks/useVoiceTrigger.js

import { useCallback, useEffect, useRef } from 'react';
import { useSpeechRecognitionEvent } from 'expo-speech-recognition';
import {
  startVoiceDetection,
  stopVoiceDetection,
  handleTranscript,
  isVoiceDetectionActive,
} from '../services/voiceService';

export const useVoiceTrigger = (onTrigger, active = true) => {
  // Keep a stable ref to onTrigger so stale closures never fire an old callback
  const onTriggerRef = useRef(onTrigger);
  useEffect(() => {
    onTriggerRef.current = onTrigger;
  });

  // Stable callback wrapper that always reads from the ref
  const stableOnTrigger = useCallback((transcript) => {
    onTriggerRef.current?.(transcript);
  }, []); // no deps — intentionally stable for lifetime of the hook

  const restartTimer = useRef(null);
  const watchdogTimer = useRef(null);
  const triggered = useRef(false);
  // Keep a ref to `active` so timers/intervals can read the latest value
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  });

  const clearTimers = useCallback(() => {
    if (restartTimer.current) clearTimeout(restartTimer.current);
    if (watchdogTimer.current) clearInterval(watchdogTimer.current);
    restartTimer.current = null;
    watchdogTimer.current = null;
  }, []);

  const startWatchdog = useCallback(() => {
    if (watchdogTimer.current) clearInterval(watchdogTimer.current);
    watchdogTimer.current = setInterval(() => {
      if (activeRef.current && !triggered.current && !isVoiceDetectionActive()) {
        console.log('Watchdog restarting voice detection...');
        startVoiceDetection(stableOnTrigger);
      }
    }, 5000);
  }, [stableOnTrigger]);

  const scheduleRestart = useCallback((delay = 1500) => {
    if (restartTimer.current) clearTimeout(restartTimer.current);
    restartTimer.current = setTimeout(async () => {
      if (activeRef.current && !triggered.current) {
        await stopVoiceDetection();
        await startVoiceDetection(stableOnTrigger);
        startWatchdog();
      }
    }, delay);
  }, [stableOnTrigger, startWatchdog]);

  // ─── SPEECH RECOGNITION EVENTS ──────────────────────────

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results?.[0]?.transcript || '';
    if (!transcript) return;

    console.log('Heard:', transcript);
    const detected = handleTranscript(transcript);

    if (detected) {
      triggered.current = true;
      clearTimers();
    }
  });

  useSpeechRecognitionEvent('end', () => {
    if (activeRef.current && !triggered.current) {
      scheduleRestart(1500);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    console.log('Voice error:', event.error);
    if (activeRef.current && !triggered.current) {
      const delay =
        event.error === 'no-speech'  ? 1500 :
        event.error === 'busy'       ? 4000 :
        event.error === 'network'    ? 8000 :
                                       3000;
      scheduleRestart(delay);
    }
  });

  // ─── LIFECYCLE ──────────────────────────────────────────

  useEffect(() => {
    if (active) {
      triggered.current = false;
      startVoiceDetection(stableOnTrigger);
      startWatchdog();
    }

    return () => {
      clearTimers();
      stopVoiceDetection();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // `stableOnTrigger` and `startWatchdog` are stable — intentionally omitted
    // from deps to avoid spurious restarts. Only `active` should drive re-runs.
  }, [active]);
};