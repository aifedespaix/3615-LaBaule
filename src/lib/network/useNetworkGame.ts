import { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  WorldSnapshot,
  PlayerState,
  EntityState,
  readSnapshot,
  readGameEvent,
  writeClientInput,
  CLIENT_INPUT_SIZE,
  GameEvent
} from '@3615/shared/netcode/schema';
import { PacketType } from '@3615/shared/netcode/opcodes';
import { applyInput } from '@3615/shared/physics';
import { TICK_DT, SNAPSHOT_BUFFER_SIZE, RECONCILIATION_THRESHOLD } from '@3615/shared/config/constants';
import { getInputState } from '../../stores/inputStore';
import { InputMask } from '@3615/shared/netcode/masks';
import { useLevelStore } from '../../stores/levelStore';
import { useLobbyStore, LobbyState } from '../../stores/lobbyStore';

// --- Types ---

interface NetworkState {
  connected: boolean;
  playerId: number | null;
  serverTick: number;
  clientTick: number;
  snapshots: WorldSnapshot[];
  history: { tick: number; inputMask: number; pos: { x: number; y: number } }[];
  entities: EntityState[];
  otherPlayers: PlayerState[];
  localPlayer: { x: number; y: number; angle: number; weapon?: number; ammo?: number; score?: number } | null;
  events: GameEvent[];
}

// --- Singleton State ---

const gameState: NetworkState = {
  connected: false,
  playerId: null,
  serverTick: 0,
  clientTick: 0,
  snapshots: [],
  history: [],
  entities: [],
  otherPlayers: [],
  localPlayer: { x: 0, y: 0, angle: 0 },
  events: [],
};

let socket: WebSocket | null = null;

// --- Helper: Input Mask ---

function getCurrentInputMask(): number {
  const state = getInputState();
  let mask = 0;
  if (state.move.y < -0.1) mask |= InputMask.UP;
  if (state.move.y > 0.1) mask |= InputMask.DOWN;
  if (state.move.x < -0.1) mask |= InputMask.LEFT;
  if (state.move.x > 0.1) mask |= InputMask.RIGHT;
  if (state.shoot) mask |= InputMask.SHOOT;
  if (state.throw) mask |= InputMask.THROW;
  if (state.reload) mask |= InputMask.RELOAD;
  if (state.move.x === 0 && state.move.y === 0 && state.interact) mask |= InputMask.DASH;
  return mask;
}

// --- Logic: Handle Snapshot ---

const onServerSnapshot = (snapshot: WorldSnapshot) => {
  const state = gameState;

  state.serverTick = snapshot.tick;

  if (state.clientTick === 0) {
    state.clientTick = snapshot.tick + 2;
    if (!state.localPlayer && state.playerId) {
        const p = snapshot.players.find(p => p.id === state.playerId);
        if (p) state.localPlayer = { x: p.x, y: p.y, angle: p.angle };
    }
  }

  state.snapshots.push(snapshot);
  if (state.snapshots.length > SNAPSHOT_BUFFER_SIZE) {
    state.snapshots.shift();
  }

  if (state.playerId !== null && state.localPlayer) {
    const serverPlayer = snapshot.players.find(p => p.id === state.playerId);
    if (serverPlayer) {
      state.localPlayer.weapon = serverPlayer.weapon;
      state.localPlayer.ammo = serverPlayer.ammo;
      state.localPlayer.score = serverPlayer.score;
      // Note: HP is updated locally by prediction? No, HP is authoritative.
      state.localPlayer.hp = serverPlayer.hp;

      const historyStep = state.history.find(h => h.tick === snapshot.tick);

      if (historyStep) {
        const dx = serverPlayer.x - historyStep.pos.x;
        const dy = serverPlayer.y - historyStep.pos.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist > RECONCILIATION_THRESHOLD) {
          let simX = serverPlayer.x;
          let simY = serverPlayer.y;

          const newHistory = [];
          for (const step of state.history) {
             if (step.tick > snapshot.tick) {
                 const tempEnt = { x: simX, y: simY };
                 applyInput(tempEnt, step.inputMask, TICK_DT);
                 simX = tempEnt.x;
                 simY = tempEnt.y;

                 newHistory.push({
                     tick: step.tick,
                     inputMask: step.inputMask,
                     pos: { x: simX, y: simY }
                 });
             }
          }

          state.history = newHistory;
          state.localPlayer.x = simX;
          state.localPlayer.y = simY;
        } else {
           state.history = state.history.filter(h => h.tick > snapshot.tick);
        }
      } else {
           if (state.clientTick < snapshot.tick) {
               state.localPlayer.x = serverPlayer.x;
               state.localPlayer.y = serverPlayer.y;
               state.clientTick = snapshot.tick + 1;
           }
      }
    }
  }
};

// --- Hook for Canvas (Prediction Loop) ---

export function useNetworkGame() {
  const { state: lobbyState, roomCode, setState: setLobbyState, setError } = useLobbyStore();
  const accumulator = useRef(0);

  // Handle Connection Lifecycle
  useEffect(() => {
    if (lobbyState === LobbyState.CONNECTING && !socket) {
      console.log(`Dialing 3615 LA BAULE... Code: ${roomCode}`);

      const wsUrl = new URL('ws://localhost:3001');
      if (roomCode) {
        wsUrl.searchParams.append('room', roomCode);
      }

      const ws = new WebSocket(wsUrl.toString());
      ws.binaryType = 'arraybuffer';
      socket = ws;

      ws.onopen = () => {
        console.log('Connected to server');
        gameState.connected = true;
        setLobbyState(LobbyState.GAME);
      };

      ws.onmessage = (event) => {
        const buffer = event.data as ArrayBuffer;
        const view = new DataView(buffer);
        const type = view.getUint8(0);

        if (type === PacketType.LEVEL_DATA) {
          const decoder = new TextDecoder();
          const json = decoder.decode(new Uint8Array(buffer).slice(1));
          try {
            const levelData = JSON.parse(json);
            console.log("Received Level Data:", levelData);
            useLevelStore.getState().setLevelData(levelData);
          } catch (e) {
            console.error("Failed to parse level data", e);
          }
        } else if (type === PacketType.HANDSHAKE) {
          const id = view.getUint8(1);
          console.log('Assigned Player ID:', id);
          gameState.playerId = id;
          if (!gameState.localPlayer) {
               gameState.localPlayer = { x: 0, y: 0, angle: 0 };
          }
        } else if (type === PacketType.SNAPSHOT) {
          const snapshot = readSnapshot(view, 1);
          onServerSnapshot(snapshot);
        } else if (type === PacketType.GAME_EVENT) {
          const evt = readGameEvent(view, 1);
          gameState.events.push(evt);
        }
      };

      ws.onclose = (ev) => {
        console.log('Disconnected', ev.code, ev.reason);
        gameState.connected = false;
        socket = null;

        if (lobbyState === LobbyState.GAME || lobbyState === LobbyState.CONNECTING) {
           setLobbyState(LobbyState.ERROR);
           setError("SERVICE INDISPONIBLE");
        }
      };

      ws.onerror = () => {
         // Close handles error
      };
    } else if (lobbyState === LobbyState.MENU && socket) {
        socket.close();
        socket = null;
    }
  }, [lobbyState, roomCode, setLobbyState, setError]);

  // Game Loop
  useFrame((state, delta) => {
    if (!gameState.connected || gameState.playerId === null || lobbyState !== LobbyState.GAME) return;

    accumulator.current += delta;
    if (accumulator.current > 0.1) accumulator.current = 0.1;

    while (accumulator.current >= TICK_DT) {
      accumulator.current -= TICK_DT;

      const inputMask = getCurrentInputMask();
      const currentAngle = gameState.localPlayer?.angle || 0;
      const currentTick = gameState.clientTick;

      if (gameState.localPlayer) {
        applyInput(gameState.localPlayer, inputMask, TICK_DT);
        gameState.history.push({
          tick: currentTick,
          inputMask: inputMask,
          pos: { ...gameState.localPlayer }
        });
      }

      if (socket && socket.readyState === WebSocket.OPEN) {
        const buffer = new ArrayBuffer(CLIENT_INPUT_SIZE);
        const view = new DataView(buffer);
        writeClientInput(view, 0, {
          tick: currentTick,
          inputMask: inputMask,
          mouseAngle: currentAngle
        });
        socket.send(buffer);
      }

      gameState.clientTick++;
    }

    // Interpolation for Remotes
    const snapshots = gameState.snapshots;
    if (snapshots.length >= 2) {
       const next = snapshots[snapshots.length - 1];
       const prev = snapshots[snapshots.length - 2];
       const alpha = 0.5;

       gameState.otherPlayers = next.players
          .filter(p => p.id !== gameState.playerId)
          .map(nextP => {
              const prevP = prev.players.find(pp => pp.id === nextP.id);
              if (prevP) {
                  return {
                      ...nextP,
                      x: prevP.x + (nextP.x - prevP.x) * alpha,
                      y: prevP.y + (nextP.y - prevP.y) * alpha,
                      angle: nextP.angle
                  };
              }
              return nextP;
          });
    } else if (snapshots.length === 1) {
       gameState.otherPlayers = snapshots[0].players.filter(p => p.id !== gameState.playerId);
    }
  });

  return gameState;
}

// --- Hook for UI (Polling) ---

export function useGameUI() {
    const [tick, setTick] = useState(0);

    useEffect(() => {
        let anim: number;
        const loop = () => {
            setTick(t => t + 1);
            anim = requestAnimationFrame(loop);
        };
        loop();
        return () => cancelAnimationFrame(anim);
    }, []);

    return gameState;
}
