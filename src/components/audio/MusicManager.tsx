"use client";

import { useEffect, useRef } from 'react';
import { Howl } from 'howler';
import { useSoundStore } from '../../stores/useSoundStore';

const MUSIC_FADE_DURATION = 1000;

export function MusicManager() {
  const currentTrack = useSoundStore((state) => state.currentMusicTrack);
  const musicVolume = useSoundStore((state) => state.musicVolume);
  const masterVolume = useSoundStore((state) => state.masterVolume);
  const isMuted = useSoundStore((state) => state.isMuted);

  const howlRef = useRef<Howl | null>(null);
  const activeTrackRef = useRef<string | null>(null);

  // Handle Track Changes
  useEffect(() => {
    if (activeTrackRef.current === currentTrack) return;

    // Fade out old track
    if (howlRef.current) {
      const oldHowl = howlRef.current;
      oldHowl.fade(oldHowl.volume(), 0, MUSIC_FADE_DURATION);
      setTimeout(() => {
        oldHowl.stop();
        oldHowl.unload();
      }, MUSIC_FADE_DURATION + 100);
    }

    if (!currentTrack) {
      activeTrackRef.current = null;
      howlRef.current = null;
      return;
    }

    // Start new track
    activeTrackRef.current = currentTrack;

    // Calculate initial volume
    const volume = isMuted ? 0 : musicVolume * masterVolume;

    const sound = new Howl({
      src: [`/assets/sounds/music/${currentTrack}.mp3`],
      html5: true, // Force HTML5 Audio for large files (music)
      loop: true,
      volume: 0, // Start at 0 for fade-in
      onloaderror: (_id, err) => {
        console.warn(`[MusicManager] Failed to load track: ${currentTrack}`, err);
      },
      onplayerror: (_id, err) => {
        console.warn(`[MusicManager] Play error for track: ${currentTrack}`, err);
      }
    });

    howlRef.current = sound;
    sound.play();
    sound.fade(0, volume, MUSIC_FADE_DURATION);

    return () => {
      // Cleanup on unmount handled by global refs
    };
  }, [currentTrack, isMuted, musicVolume, masterVolume]);

  // Handle Volume Updates
  useEffect(() => {
    if (howlRef.current) {
      const targetVol = isMuted ? 0 : musicVolume * masterVolume;
      howlRef.current.volume(targetVol);
    }
  }, [musicVolume, masterVolume, isMuted]);

  return null;
}
