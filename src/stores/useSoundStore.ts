import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SoundKey } from '../config/soundMap';

interface SoundEvent {
  id: string;
  key: SoundKey;
  position?: [number, number, number];
}

interface SoundState {
  // Persisted Settings
  masterVolume: number; // 0-1
  musicVolume: number;  // 0-1
  sfxVolume: number;    // 0-1
  isMuted: boolean;

  // Actions
  setMasterVolume: (val: number) => void;
  setMusicVolume: (val: number) => void;
  setSfxVolume: (val: number) => void;
  toggleMute: () => void;

  // Music Logic
  currentMusicTrack: string | null;
  playMusic: (track: string) => void;

  // SFX Queue (Transient - not persisted)
  sfxQueue: SoundEvent[];
  playSound: (key: SoundKey, position?: [number, number, number]) => void;
  consumeSoundQueue: () => SoundEvent[];
}

export const useSoundStore = create<SoundState>()(
  persist(
    (set, get) => ({
      masterVolume: 0.8,
      musicVolume: 0.5,
      sfxVolume: 0.7,
      isMuted: false,
      currentMusicTrack: null,
      sfxQueue: [],

      setMasterVolume: (val) => set({ masterVolume: Math.max(0, Math.min(1, val)) }),
      setMusicVolume: (val) => set({ musicVolume: Math.max(0, Math.min(1, val)) }),
      setSfxVolume: (val) => set({ sfxVolume: Math.max(0, Math.min(1, val)) }),
      toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

      playMusic: (track) => set({ currentMusicTrack: track }),

      playSound: (key, position) => {
        set((state) => ({
          sfxQueue: [
            ...state.sfxQueue,
            { id: crypto.randomUUID(), key, position }
          ]
        }));
      },

      consumeSoundQueue: () => {
        const queue = get().sfxQueue;
        if (queue.length > 0) {
          set({ sfxQueue: [] });
        }
        return queue;
      }
    }),
    {
      name: 'sound-settings',
      partialize: (state) => ({
        masterVolume: state.masterVolume,
        musicVolume: state.musicVolume,
        sfxVolume: state.sfxVolume,
        isMuted: state.isMuted,
      }),
    }
  )
);
