import { create } from 'zustand';

export enum LobbyState {
  BOOT = 'BOOT',
  MENU = 'MENU',
  CONNECTING = 'CONNECTING',
  GAME = 'GAME',
  ERROR = 'ERROR'
}

interface LobbyStore {
  state: LobbyState;
  roomCode: string;
  errorMessage: string | null;

  setState: (state: LobbyState) => void;
  setRoomCode: (code: string) => void;
  setError: (msg: string | null) => void;

  // Actions
  connect: (code: string) => void;
  disconnect: () => void;
}

export const useLobbyStore = create<LobbyStore>((set) => ({
  state: LobbyState.BOOT,
  roomCode: '',
  errorMessage: null,

  setState: (state) => set({ state }),
  setRoomCode: (roomCode) => set({ roomCode: roomCode.toUpperCase() }), // Auto-uppercase
  setError: (errorMessage) => set({ errorMessage }),

  connect: (code) => {
    set({ state: LobbyState.CONNECTING, roomCode: code.toUpperCase() });
  },

  disconnect: () => {
    set({ state: LobbyState.MENU, roomCode: '' });
  }
}));
