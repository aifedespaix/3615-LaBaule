import { ServerWebSocket } from "bun";
import { readClientInput, writeSnapshot, WorldSnapshot, PlayerState, EntityState, CLIENT_INPUT_SIZE, SNAPSHOT_HEADER_SIZE, PLAYER_STATE_SIZE, ENTITY_STATE_SIZE } from "../shared/netcode/schema";
import { PacketType } from "../shared/netcode/opcodes";
import { applyInput } from "../shared/physics";
import { TICK_RATE, TICK_DT } from "../shared/config/constants";

// --- Types ---

interface ClientData {
  id: number;
  inputQueue: { tick: number; inputMask: number; mouseAngle: number }[];
  lastProcessedTick: number;
}

// --- Game State ---

const MAX_PLAYERS = 4;
let nextPlayerId = 1;
const players: Map<ServerWebSocket<ClientData>, PlayerState> = new Map();
// Simple entity list for now (empty)
const entities: EntityState[] = [];

let serverTick = 0;

// --- Helper: Find Free Player ID ---
function getNextPlayerId(): number | null {
  const usedIds = new Set(Array.from(players.values()).map(p => p.id));
  for (let i = 1; i <= MAX_PLAYERS; i++) {
    if (!usedIds.has(i)) return i;
  }
  return null;
}

// --- Game Loop ---

setInterval(() => {
  serverTick++;

  // 1. Process Inputs for this tick
  for (const [ws, player] of players) {
    const data = ws.data;
    const queue = data.inputQueue;

    // Find input for current tick (or closest)
    // In a real de-jitter buffer, we'd be more sophisticated.
    // Here, we just pop the oldest input if it exists, or reuse last.

    // Simple Strategy for Prototype:
    // Process ALL pending inputs up to a certain limit?
    // No, standard Server Authority processes ONE step per Server Tick.
    // We should look for the input that matches `serverTick` roughly?
    // Actually, clients send inputs stamped with *their* predicted tick.
    // The server just processes "next available input" in sequence.

    // Let's just consume one input from the queue if available.
    if (queue.length > 0) {
      const input = queue.shift()!; // Get oldest
      applyInput(player, input.inputMask, TICK_DT);
      player.angle = input.mouseAngle;
      // data.lastProcessedTick = input.tick; // Store for ack?
    }
  }

  // 2. Generate Snapshot
  const snapshot: WorldSnapshot = {
    tick: serverTick,
    players: Array.from(players.values()),
    entities: entities,
  };

  // 3. Encode Snapshot
  // Calculate size: Header + (Players * Size) + (Entities * Size)
  const size = SNAPSHOT_HEADER_SIZE + (snapshot.players.length * PLAYER_STATE_SIZE) + (snapshot.entities.length * ENTITY_STATE_SIZE);
  const buffer = new ArrayBuffer(size);
  const view = new DataView(buffer);

  // Write PacketType (Header) manually since writeSnapshot expects to write it?
  // shared/netcode/schema.ts: writeSnapshot writes PacketType.SNAPSHOT at offset.
  writeSnapshot(view, 0, snapshot);

  // 4. Broadcast
  for (const [ws] of players) {
    ws.send(buffer);
  }

}, 1000 / TICK_RATE);


// --- Server Setup ---

const server = Bun.serve<ClientData>({
  port: 3001,
  fetch(req, server) {
    const success = server.upgrade(req, {
      data: {
        id: 0, // Placeholder, assigned on open
        inputQueue: [],
        lastProcessedTick: 0
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

      // Initialize Player State
      players.set(ws, {
        id: id,
        x: 0,
        y: 0,
        angle: 0,
        hp: 100
      });

      // We could send a "Welcome" packet here with their ID,
      // but for now they will deduce it from the snapshot or we just sync later.
      // (The user said "Walking Skeleton", let's keep it minimal).
      // Actually, Client needs to know WHICH player is them to do prediction.
      // I'll hack it: The first snapshot they see with a new ID is them?
      // Or just send a small binary message with ID?

      // Let's send a 1-byte message with the ID as a quick hack or proper handshake packet.
      // Let's use PacketType.HANDSHAKE (1) + ID (1 byte).
      const buffer = new ArrayBuffer(2);
      const view = new DataView(buffer);
      view.setUint8(0, PacketType.HANDSHAKE);
      view.setUint8(1, id);
      ws.send(buffer);
    },
    message(ws, message) {
      if (message instanceof ArrayBuffer || message instanceof Uint8Array) {
        const buffer = message instanceof Uint8Array ? message.buffer : message;
        const view = new DataView(buffer);
        const type = view.getUint8(0);

        if (type === PacketType.INPUT) {
           // Read payload starting at byte 1 (as per our plan in previous step logic)
           // But wait, my readClientInput implementation in schema.ts assumed offset points to PAYLOAD?
           // Let's check schema.ts again in my mind.
           // Yes, "assumes offset points to the first byte of the PAYLOAD".
           // Packet is [Type, Tick, Mask...]
           // So offset 1.

           try {
             // Basic validation
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
      players.delete(ws);
    },
  },
});

console.log(`Server listening on port ${server.port}`);
