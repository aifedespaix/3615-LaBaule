import { PacketType } from "./opcodes";

// --- Types ---

export interface ClientInput {
  tick: number;
  inputMask: number;
  mouseAngle: number; // in radians
}

export interface PlayerState {
  id: number;
  x: number;
  y: number;
  angle: number; // in radians
  hp: number;
}

export interface EntityState {
  id: number;
  type: number;
  x: number;
  y: number;
  angle: number; // in radians
}

export interface WorldSnapshot {
  tick: number;
  players: PlayerState[];
  entities: EntityState[];
}

// --- Constants ---

// Packet Layouts
// ClientInput: Type(1) + Tick(2) + Mask(1) + Angle(2) + Pad(1) = 7 bytes
export const CLIENT_INPUT_SIZE = 7;

// PlayerState: ID(1) + X(2) + Y(2) + Angle(2) + HP(1) = 8 bytes
export const PLAYER_STATE_SIZE = 8;

// EntityState: ID(2) + Type(1) + X(2) + Y(2) + Angle(2) = 9 bytes
export const ENTITY_STATE_SIZE = 9;

// Snapshot Header: Type(1) + Tick(2) + PlayerCount(1) + EntityCount(2) = 6 bytes
export const SNAPSHOT_HEADER_SIZE = 6;


// --- Fixed-Point Math Helpers ---

const POS_SCALE = 100;
const POS_MIN = -327.68;
const POS_MAX = 327.67;
const ANGLE_SCALE = 65535 / (2 * Math.PI);

/**
 * Packs a float position into a fixed-point Int16.
 * Clamps to valid range.
 */
function packPos(val: number): number {
  // Clamp to prevent overflow wrapping
  if (val < POS_MIN) val = POS_MIN;
  if (val > POS_MAX) val = POS_MAX;
  return Math.floor(val * POS_SCALE);
}

/**
 * Unpacks a fixed-point Int16 into a float position.
 */
function unpackPos(val: number): number {
  return val / POS_SCALE;
}

/**
 * Packs a float radian angle into a Uint16.
 */
function packAngle(rad: number): number {
  // Normalize to 0 -> 2PI range
  let normalized = rad % (2 * Math.PI);
  if (normalized < 0) normalized += 2 * Math.PI;
  return Math.floor(normalized * ANGLE_SCALE);
}

/**
 * Unpacks a Uint16 into a float radian angle.
 */
function unpackAngle(val: number): number {
  return val / ANGLE_SCALE;
}

// --- Writers ---

/**
 * Writes a ClientInput packet to the DataView.
 * Returns the new offset.
 */
export function writeClientInput(view: DataView, offset: number, input: ClientInput): number {
  view.setUint8(offset, PacketType.INPUT);
  offset += 1;

  view.setUint16(offset, input.tick, true); // Little Endian
  offset += 2;

  view.setUint8(offset, input.inputMask);
  offset += 1;

  view.setUint16(offset, packAngle(input.mouseAngle), true);
  offset += 2;

  // Padding
  view.setUint8(offset, 0);
  offset += 1;

  return offset;
}

/**
 * Writes a WorldSnapshot packet to the DataView.
 * Returns the new offset.
 */
export function writeSnapshot(view: DataView, offset: number, snapshot: WorldSnapshot): number {
  view.setUint8(offset, PacketType.SNAPSHOT);
  offset += 1;

  view.setUint16(offset, snapshot.tick, true);
  offset += 2;

  // Player Count
  view.setUint8(offset, snapshot.players.length);
  offset += 1;

  // Entity Count
  view.setUint16(offset, snapshot.entities.length, true);
  offset += 2;

  // Players
  for (const player of snapshot.players) {
    view.setUint8(offset, player.id);
    offset += 1;

    view.setInt16(offset, packPos(player.x), true);
    offset += 2;

    view.setInt16(offset, packPos(player.y), true);
    offset += 2;

    view.setUint16(offset, packAngle(player.angle), true);
    offset += 2;

    view.setUint8(offset, player.hp);
    offset += 1;
  }

  // Entities
  for (const entity of snapshot.entities) {
    view.setUint16(offset, entity.id, true);
    offset += 2;

    view.setUint8(offset, entity.type);
    offset += 1;

    view.setInt16(offset, packPos(entity.x), true);
    offset += 2;

    view.setInt16(offset, packPos(entity.y), true);
    offset += 2;

    view.setUint16(offset, packAngle(entity.angle), true);
    offset += 2;
  }

  return offset;
}

// --- Readers ---

/**
 * Reads a ClientInput packet from the DataView.
 * Expects the cursor to be at the start of the payload (PacketType already read).
 * Actually, to be safe and symmetric, let's assume we read the PacketType outside
 * or we skip it here.
 * NOTE: The instruction said "ReadSnapshot(view: DataView, offset: number): WorldSnapshot".
 * It usually implies reading the whole thing or the payload.
 * Since we have PacketId at byte 0, the caller likely reads byte 0 to decide which function to call.
 * So these functions should start reading AFTER the PacketType (byte 1).
 *
 * However, to keep it consistent with the "Writers" which DO write the packet type,
 * I will make the Readers skip the first byte (PacketType) if it's there, OR
 * I should adjust the Writers to NOT write the PacketType?
 *
 * The instruction said: "Byte 0: PacketId... Byte 1..N: Payload".
 * And "WriteInput... returns new offset". It's safest if WriteInput writes the WHOLE packet including header.
 *
 * But for reading, usually you peek the header, see what it is, then dispatch to a reader.
 * The reader shouldn't need to re-read the PacketId.
 *
 * Let's define the Readers to start reading at `offset`.
 * If the caller has already consumed the PacketID, they pass `offset + 1`.
 *
 * Actually, let's just make the Reader strictly read the PAYLOAD structure defined in the specs.
 * The specs define:
 * ClientInputPacket: Tick, InputMask, MouseAngle, Padding.
 * Snapshot: Tick, Counts, Blocks...
 *
 * The PacketType is a transport-layer header effectively.
 *
 * BUT, the Writer writes it. So the buffer *contains* it.
 * To avoid confusion, I will make the reader ignore the first byte if the offset points to it?
 * No, that's ambiguous.
 *
 * Standard practice:
 * Writer: Writes full packet (Header + Payload).
 * Reader: Reads Payload. Caller handles Header dispatch.
 *
 * So `readClientInput` will assume `offset` points to `Tick` (byte 1).
 * Wait, `writeClientInput` writes `PacketType` at `offset`.
 * So `readClientInput` should probably take `offset` pointing to `Tick`?
 *
 * Let's document this clearly.
 */

/**
 * Reads a ClientInput payload.
 * assumes offset points to the first byte of the PAYLOAD (i.e. byte 1 if packet starts at 0).
 */
export function readClientInput(view: DataView, offset: number): ClientInput {
  const tick = view.getUint16(offset, true);
  offset += 2;

  const inputMask = view.getUint8(offset);
  offset += 1;

  const mouseAngle = unpackAngle(view.getUint16(offset, true));
  offset += 2;

  // Padding
  // view.getUint8(offset);
  offset += 1;

  return { tick, inputMask, mouseAngle };
}

/**
 * Reads a WorldSnapshot payload.
 * assumes offset points to the first byte of the PAYLOAD (i.e. byte 1 if packet starts at 0).
 */
export function readSnapshot(view: DataView, offset: number): WorldSnapshot {
  const tick = view.getUint16(offset, true);
  offset += 2;

  const playerCount = view.getUint8(offset);
  offset += 1;

  const entityCount = view.getUint16(offset, true);
  offset += 2;

  const players: PlayerState[] = [];
  for (let i = 0; i < playerCount; i++) {
    const id = view.getUint8(offset);
    offset += 1;

    const x = unpackPos(view.getInt16(offset, true));
    offset += 2;

    const y = unpackPos(view.getInt16(offset, true));
    offset += 2;

    const angle = unpackAngle(view.getUint16(offset, true));
    offset += 2;

    const hp = view.getUint8(offset);
    offset += 1;

    players.push({ id, x, y, angle, hp });
  }

  const entities: EntityState[] = [];
  for (let i = 0; i < entityCount; i++) {
    const id = view.getUint16(offset, true);
    offset += 2;

    const type = view.getUint8(offset);
    offset += 1;

    const x = unpackPos(view.getInt16(offset, true));
    offset += 2;

    const y = unpackPos(view.getInt16(offset, true));
    offset += 2;

    const angle = unpackAngle(view.getUint16(offset, true));
    offset += 2;

    entities.push({ id, type, x, y, angle });
  }

  return { tick, players, entities };
}
