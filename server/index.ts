import { ServerWebSocket } from "bun";
import { readClientInput, writeSnapshot, writeGameEvent, WorldSnapshot, PlayerState, EntityState, CLIENT_INPUT_SIZE, SNAPSHOT_HEADER_SIZE, PLAYER_STATE_SIZE, ENTITY_STATE_SIZE, GAME_EVENT_SIZE } from "../shared/netcode/schema";
import { PacketType } from "../shared/netcode/opcodes";
import { TICK_RATE, TICK_DT } from "../shared/config/constants";
import { generateDungeon } from "./dungeon";
import { Game } from "./game";
import { ClientData } from "./types";

// --- Game State ---

const MAX_PLAYERS = 4;
let levelData;

try {
  levelData = generateDungeon();
} catch (e) {
  console.error("Failed to generate level:", e);
  process.exit(1);
}

const game = new Game(levelData);
console.log(`Generated Level with ${levelData.rooms.length} rooms`);

// WebSocket Map (WS -> PlayerID)
// We need this to map connection to game.players
const connections: Map<ServerWebSocket<ClientData>, number> = new Map();

let serverTick = 0;

// --- Helper: Find Free Player ID ---
function getNextPlayerId(): number | null {
  // Use game.players keys
  const usedIds = new Set(game.players.keys());
  for (let i = 1; i <= MAX_PLAYERS; i++) {
    if (!usedIds.has(i)) return i;
  }
  return null;
}

// --- Game Loop ---

setInterval(() => {
  serverTick++;
  const now = Date.now();

  // 1. Process Inputs for this tick
  for (const [ws, playerId] of connections) {
    const queue = ws.data.inputQueue;

    if (queue.length > 0) {
      const input = queue.shift()!; // Get oldest
      game.processInput(playerId, input);
    }
  }

  // 2. Update Game Simulation
  game.update(TICK_DT);

  // 3. Process Pending Events (Broadcast)
  while (game.pendingEvents.length > 0) {
      const event = game.pendingEvents.shift()!;
      const eventBuffer = new ArrayBuffer(GAME_EVENT_SIZE);
      const eventView = new DataView(eventBuffer);
      writeGameEvent(eventView, 0, event);

      for (const [client] of connections) {
          client.send(eventBuffer);
      }
  }

  // 4. Generate Snapshot
  const snapshot: WorldSnapshot = {
    tick: serverTick,
    players: Array.from(game.players.values()),
    entities: game.projectiles.map(p => ({
        id: p.id,
        type: p.type,
        x: p.x,
        y: p.y,
        angle: p.angle
    })),
  };

  // 5. Encode Snapshot
  const size = SNAPSHOT_HEADER_SIZE + (snapshot.players.length * PLAYER_STATE_SIZE) + (snapshot.entities.length * ENTITY_STATE_SIZE);
  const buffer = new ArrayBuffer(size);
  const view = new DataView(buffer);
  writeSnapshot(view, 0, snapshot);

  // 6. Broadcast
  for (const [ws] of connections) {
    ws.send(buffer);
  }

}, 1000 / TICK_RATE);


// --- Server Setup ---

const server = Bun.serve<ClientData>({
  port: 3001,
  fetch(req, server) {
    const success = server.upgrade(req, {
      data: {
        id: 0, // Placeholder
        inputQueue: [],
        lastProcessedTick: 0,
        lastFireTime: 0
      }
    });
    return success ? undefined : new Response("Upgrade failed", { status: 500 });
  },
  websocket: {
    open(ws) {
      const id = getNextPlayerId();
      if (!id) {
        ws.close(1008, "Server Full");
        return;
      }

      ws.data.id = id;
      console.log(`Player ${id} connected`);

      // Add Player to Game
      game.addPlayer(id);
      connections.set(ws, id);

      // Handshake
      const buffer = new ArrayBuffer(2);
      const view = new DataView(buffer);
      view.setUint8(0, PacketType.HANDSHAKE);
      view.setUint8(1, id);
      ws.send(buffer);

      // Send Level Data
      const json = JSON.stringify(levelData);
      const encoder = new TextEncoder();
      const payload = encoder.encode(json);

      const levelBuffer = new Uint8Array(1 + payload.length);
      levelBuffer[0] = PacketType.LEVEL_DATA;
      levelBuffer.set(payload, 1);

      ws.send(levelBuffer);
    },
    message(ws, message) {
      if (message instanceof ArrayBuffer || message instanceof Uint8Array) {
        const buffer = message instanceof Uint8Array ? message.buffer : message;
        const view = new DataView(buffer);
        const type = view.getUint8(0);

        if (type === PacketType.INPUT) {
           try {
             if (buffer.byteLength < CLIENT_INPUT_SIZE) return;
             const input = readClientInput(view, 1);
             ws.data.inputQueue.push(input);
           } catch (e) {
             console.error("Failed to decode input", e);
           }
        }
      }
    },
    close(ws) {
      const id = ws.data.id;
      console.log(`Player ${id} disconnected`);
      game.removePlayer(id);
      connections.delete(ws);
    },
  },
});

console.log(`Server listening on port ${server.port}`);
