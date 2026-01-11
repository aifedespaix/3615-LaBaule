import { ServerWebSocket } from "bun";
import { readClientInput, writeSnapshot, writeGameEvent, WorldSnapshot, PlayerState, EntityState, CLIENT_INPUT_SIZE, SNAPSHOT_HEADER_SIZE, PLAYER_STATE_SIZE, ENTITY_STATE_SIZE, GAME_EVENT_SIZE } from "../shared/netcode/schema";
import { PacketType, GameEventType } from "../shared/netcode/opcodes";
import { applyInput, raycast, raycastEntities } from "../shared/physics";
import { TICK_RATE, TICK_DT } from "../shared/config/constants";
import { generateDungeon } from "./dungeon";
import { LevelData } from "../shared/level";
import { WEAPONS, WeaponType } from "../shared/weapons";
import { InputMask } from "../shared/netcode/masks";
import { CollisionHelper } from "../shared/map/collision";

// --- Types ---

interface ClientData {
  id: number;
  inputQueue: { tick: number; inputMask: number; mouseAngle: number }[];
  lastProcessedTick: number;
  lastFireTime: number; // Timestamp of last shot
}

// --- Game State ---

const MAX_PLAYERS = 4;
let nextPlayerId = 1;
const players: Map<ServerWebSocket<ClientData>, PlayerState> = new Map();
// Simple entity list for now (empty)
const entities: EntityState[] = [];

// Generate Level
let levelData: LevelData;
let collisionHelper: CollisionHelper;
try {
  levelData = generateDungeon();
  collisionHelper = new CollisionHelper(levelData);
  console.log(`Generated Level with ${levelData.rooms.length} rooms`);
} catch (e) {
  console.error("Failed to generate level:", e);
  process.exit(1);
}

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
  const now = Date.now();

  // 1. Process Inputs for this tick
  for (const [ws, player] of players) {
    const data = ws.data;
    const queue = data.inputQueue;

    if (queue.length > 0) {
      const input = queue.shift()!; // Get oldest
      applyInput(player, input.inputMask, TICK_DT);
      player.angle = input.mouseAngle;

      // Weapon Logic
      if (input.inputMask & InputMask.SHOOT) {
          const weapon = WEAPONS[player.weapon as WeaponType];

          // Check Cooldown
          if (now - data.lastFireTime >= weapon.fireRate) {
              // Check Ammo
              if (player.ammo > 0) {
                  data.lastFireTime = now;
                  player.ammo--;

                  // Fire Raycast(s)
                  const startX = player.x;
                  const startY = player.y;

                  // Calculate direction vector from angle
                  const dirX = Math.cos(player.angle);
                  const dirY = Math.sin(player.angle);

                  // 1. Check Walls
                  const wallHit = raycast(startX, startY, dirX, dirY, weapon.range, collisionHelper);
                  let maxDist = weapon.range;
                  let endX = startX + dirX * maxDist;
                  let endY = startY + dirY * maxDist;
                  let eventType = GameEventType.SHOOT;

                  if (wallHit) {
                      maxDist = wallHit.distance;
                      endX = wallHit.x;
                      endY = wallHit.y;
                      eventType = GameEventType.HIT_WALL;
                  }

                  // 2. Check Entities (Players + Enemies)
                  // Construct target list from all OTHER players
                  const targets = Array.from(players.values()).filter(p => p.id !== player.id);
                  // Add entities (enemies) later when implemented

                  const entHit = raycastEntities(startX, startY, dirX, dirY, maxDist, targets);

                  if (entHit) {
                      endX = entHit.x;
                      endY = entHit.y;
                      eventType = GameEventType.HIT_ENEMY;

                      // Apply Damage
                      const targetPlayer = players.get(
                          Array.from(players.keys()).find(key => players.get(key)?.id === entHit.entity.id)!
                      );

                      if (targetPlayer) {
                          targetPlayer.hp = Math.max(0, targetPlayer.hp - weapon.damage);
                          // TODO: Handle Death
                      }
                  }

                  // Broadcast Game Event
                  const eventBuffer = new ArrayBuffer(GAME_EVENT_SIZE);
                  const eventView = new DataView(eventBuffer);
                  writeGameEvent(eventView, 0, {
                      type: eventType,
                      sourceId: player.id,
                      weaponId: player.weapon,
                      endX: endX,
                      endY: endY
                  });

                  for (const [client] of players) {
                      client.send(eventBuffer);
                  }
              }
          }
      }
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

      // Initialize Player State
      players.set(ws, {
        id: id,
        x: 0,
        y: 0,
        angle: 0,
        hp: 100,
        weapon: WeaponType.PISTOL, // Default weapon
        ammo: WEAPONS[WeaponType.PISTOL].ammoMax
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

      // Send Level Data
      // Opcode (1 byte) + JSON string
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
