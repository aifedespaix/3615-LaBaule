import { create } from 'zustand';
import { LevelData } from '@3615/shared/level';

interface LevelState {
  levelData: LevelData | null;
  setLevelData: (data: LevelData) => void;
}

export const useLevelStore = create<LevelState>((set) => ({
  levelData: null,
  setLevelData: (data) => set({ levelData: data }),
}));
