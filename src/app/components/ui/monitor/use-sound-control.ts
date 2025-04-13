"use client";

import { useCallback, useEffect, useState } from "react";
import { Settings } from "@/app/lib/db/settings";

export function useSoundControl() {
  const [soundPlay, setSoundPlay] = useState(false);
  const [soundPlayEnabled, setSoundPlayEnabled] = useState(true);

  useEffect(() => {
    Settings.get('soundPlayAutoActivation').then(value => {
      setSoundPlay(value ?? false);
    });

    let audioContext: AudioContext | null = null;
    if (typeof window !== 'undefined') {
      try {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        setSoundPlayEnabled(!!audioContext);
      } catch (e) {
        console.error('Audio context not supported:', e);
        setSoundPlayEnabled(false);
      }
    }

    return () => {
      audioContext?.close();
    };
  }, []);

  const toggleSoundPlay = useCallback(() => {
    const newValue = !soundPlay;
    setSoundPlay(newValue);
    Settings.set('soundPlayAutoActivation', newValue);
  }, [soundPlay]);

  const playSound = useCallback((frequency = 440, duration = 500, volume = 0.5) => {
    if (!soundPlay || !soundPlayEnabled || typeof window === 'undefined') return;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gainNode.gain.value = volume;

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start();
      
      setTimeout(() => {
        oscillator.stop();
        audioContext.close();
      }, duration);
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  }, [soundPlay, soundPlayEnabled]);

  return {
    soundPlay,
    toggleSoundPlay,
    soundPlayEnabled,
    playSound
  };
}
