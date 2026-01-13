import { ServerWebSocket } from "bun";
import { readClientInput, writeSnapshot, writeGameEvent, WorldSnapshot, PlayerState, EntityState, CLIENT_INPUT_SIZE, SNAPSHOT_HEADER_SIZE, PLAYER_STATE_SIZE, ENTITY_STATE_SIZE, GAME_EVENT_SIZE } from "../shared/netcode/schema";
import { PacketType } from "../shared/netcode/opcodes";
import { TICK_RATE, TICK_DT } from "../shared/config/constants";
import { generateDungeon } from "./dungeon";
import { Game } from "./game";
import { ClientData } from "./types";

// --- Game State ---

const MAX_PLAYERS = 4;

interface Room {
    game: Game;
    connections: Set<ServerWebSocket<ClientData>>;
    tick: number;
}

const rooms = new Map<string, Room>();

// --- Helper: Find Free Player ID ---
function getNextPlayerId(game: Game): number | null {
  // Use game.players keys
  const usedIds = new Set(game.players.keys());
  for (let i = 1; i <= MAX_PLAYERS; i++) {
    if (!usedIds.has(i)) return i;
  }
  return null;
}

// --- Game Loop ---

setInterval(() => {
  // Iterate over all active rooms
  for (const [roomCode, room] of rooms) {
      const { game, connections } = room;
      room.tick++;

      // 1. Process Inputs for this tick
      for (const ws of connections) {
        const playerId = ws.data.id;
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

          for (const client of connections) {
              client.send(eventBuffer);
          }
      }

      // 4. Generate Snapshot
      const snapshot: WorldSnapshot = {
        tick: room.tick,
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
      for (const ws of connections) {
        ws.send(buffer);
      }
  }
}, 1000 / TICK_RATE);


// --- Server Setup ---

const server = Bun.serve<ClientData>({
  port: 3001,
  fetch(req, server) {
    const url = new URL(req.url);
    const roomCode = url.searchParams.get("room")?.toUpperCase() || "DEFAULT";

    const success = server.upgrade(req, {
      data: {
        id: 0, // Placeholder
        roomCode,
        inputQueue: [],
        lastProcessedTick: 0,
        lastFireTime: 0
      }
    });
    return success ? undefined : new Response("Upgrade failed", { status: 500 });
  },
  websocket: {
    open(ws) {
      const roomCode = ws.data.roomCode;

      // Find or Create Room
      let room = rooms.get(roomCode);
      if (!room) {
          console.log(`Creating new room: ${roomCode}`);
          try {
              const levelData = generateDungeon();
              const game = new Game(levelData);
              room = {
                  game,
                  connections: new Set(),
                  tick: 0
              };
              rooms.set(roomCode, room);
          } catch (e) {
              console.error(`Failed to create room ${roomCode}:`, e);
              ws.close(1011, "Internal Server Error");
              return;
          }
      }

      const id = getNextPlayerId(room.game);
      if (!id) {
        ws.close(1008, "Room Full");
        return;
      }

      ws.data.id = id;
      console.log(`Player ${id} connected to room ${roomCode}`);

      // Add Player to Game
      room.game.addPlayer(id);
      room.connections.add(ws);

      // Handshake
      const buffer = new ArrayBuffer(2);
      const view = new DataView(buffer);
      view.setUint8(0, PacketType.HANDSHAKE);
      view.setUint8(1, id);
      ws.send(buffer);

      // Send Level Data
      const json = JSON.stringify(room.game.levelData);
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
      const roomCode = ws.data.roomCode;
      const id = ws.data.id;

      console.log(`Player ${id} disconnected from ${roomCode}`);

      const room = rooms.get(roomCode);
      if (room) {
          room.game.removePlayer(id);
          room.connections.delete(ws);

          if (room.connections.size === 0) {
              console.log(`Room ${roomCode} is empty. Destroying.`);
              rooms.delete(roomCode);
          }
      }
    },
  },
});

console.log(`Server listening on port ${server.port}`);
