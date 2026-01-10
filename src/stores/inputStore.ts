import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// --- Types ---

// 1. Configuration (What user binds)
export enum BindableAction {
  MOVE_UP = 'MOVE_UP',
  MOVE_DOWN = 'MOVE_DOWN',
  MOVE_LEFT = 'MOVE_LEFT',
  MOVE_RIGHT = 'MOVE_RIGHT',
  SHOOT = 'SHOOT',
  THROW = 'THROW',
  INTERACT = 'INTERACT',
  RELOAD = 'RELOAD',
  PAUSE = 'PAUSE',
}

// 2. Consumption (What game loop reads)
export type InputState = {
  move: { x: number; y: number };
  aim: { x: number; y: number };
  shoot: boolean;
  throw: boolean;
  interact: boolean;
  reload: boolean;
  pause: boolean;
  activeDevice: DeviceType;
};

export type DeviceType = 'KEYBOARD' | 'GAMEPAD' | 'TOUCH';

export type InputBinding = {
  keyboard?: string;  // e.g., 'KeyW', 'Space', 'MouseLeft'
  gamepad?: string;   // e.g., 'ButtonSouth', 'LeftStick', 'RightTrigger'
  touch?: string;     // e.g., 'VirtualStick', 'Tap'
};

export type Bindings = Record<BindableAction, InputBinding>;

// --- Default Configuration ---

const DEFAULT_BINDINGS: Bindings = {
  [BindableAction.MOVE_UP]: { keyboard: 'KeyW', gamepad: 'LeftStickUp', touch: 'VirtualStick' },
  [BindableAction.MOVE_DOWN]: { keyboard: 'KeyS', gamepad: 'LeftStickDown', touch: 'VirtualStick' },
  [BindableAction.MOVE_LEFT]: { keyboard: 'KeyA', gamepad: 'LeftStickLeft', touch: 'VirtualStick' },
  [BindableAction.MOVE_RIGHT]: { keyboard: 'KeyD', gamepad: 'LeftStickRight', touch: 'VirtualStick' },

  [BindableAction.SHOOT]: { keyboard: 'Mouse0', gamepad: 'RightTrigger', touch: 'TapRight' },
  [BindableAction.THROW]: { keyboard: 'Mouse1', gamepad: 'LeftTrigger', touch: 'SwipeUp' },
  [BindableAction.INTERACT]: { keyboard: 'KeyE', gamepad: 'ButtonWest', touch: 'TapIcon' }, // X/Square
  [BindableAction.RELOAD]: { keyboard: 'KeyR', gamepad: 'ButtonNorth', touch: 'TapIcon' }, // Y/Triangle
  [BindableAction.PAUSE]: { keyboard: 'Escape', gamepad: 'ButtonStart', touch: 'TapPause' },
};

// --- Mutable Real-Time State (Zero-Cost) ---

// This object is mutated directly by the loop. No React updates.
export const inputState: InputState = {
  move: { x: 0, y: 0 },
  aim: { x: 0, y: 0 },
  shoot: false,
  throw: false,
  interact: false,
  reload: false,
  pause: false,
  activeDevice: 'KEYBOARD', // Default
};

// Accessor for the Game Loop
export const getInputState = () => inputState;

// --- Zustand Store (Configuration & UI State) ---

interface InputStore {
  bindings: Bindings;
  activeDevice: DeviceType; // Mirrored here for UI updates
  isListening: BindableAction | null; // which action is currently waiting for a rebind

  setDevice: (device: DeviceType) => void;
  setBinding: (action: BindableAction, device: DeviceType, key: string) => void;
  startListening: (action: BindableAction) => void;
  stopListening: () => void;
  resetDefaults: () => void;
}

export const useInputStore = create<InputStore>()(
  persist(
    (set, get) => ({
      bindings: DEFAULT_BINDINGS,
      activeDevice: 'KEYBOARD',
      isListening: null,

      setDevice: (device) => {
        if (get().activeDevice !== device) {
          set({ activeDevice: device });
          inputState.activeDevice = device;
        }
      },

      setBinding: (action, device, key) => {
        set((state) => {
          const newBindings = { ...state.bindings };

          // Conflict Resolution: Unbind previous owner
          if (device === 'KEYBOARD') {
            (Object.keys(newBindings) as BindableAction[]).forEach((a) => {
              if (a === action) return;
              const binding = newBindings[a];
              if (binding.keyboard === key) {
                newBindings[a] = { ...binding, keyboard: undefined };
              }
            });
          } else if (device === 'GAMEPAD') {
             (Object.keys(newBindings) as BindableAction[]).forEach((a) => {
              if (a === action) return;
              const binding = newBindings[a];
              if (binding.gamepad === key) {
                newBindings[a] = { ...binding, gamepad: undefined };
              }
            });
          }

          // Assign new binding
          if (device === 'KEYBOARD') {
            newBindings[action] = { ...newBindings[action], keyboard: key };
          } else if (device === 'GAMEPAD') {
             newBindings[action] = { ...newBindings[action], gamepad: key };
          }

          return { bindings: newBindings, isListening: null };
        });
      },

      startListening: (action) => set({ isListening: action }),
      stopListening: () => set({ isListening: null }),

      resetDefaults: () => set({ bindings: DEFAULT_BINDINGS }),
    }),
    {
      name: 'input-storage',
      partialize: (state) => ({ bindings: state.bindings }),
    }
  )
);
