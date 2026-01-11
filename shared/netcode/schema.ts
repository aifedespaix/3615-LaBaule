import { PacketType } from "./opcodes";

// --- Types ---

export enum Status {
  NONE = 0,
  STUNNED = 1 << 0,
}

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
  weapon: number; // WeaponType
  ammo: number;
  status: number; // Bitmask (Status)
}

export interface EntityState {
  id: number;
  type: number;
  x: number;
  y: number;
  angle: number; // in radians
}

export interface GameEvent {
  type: number; // GameEventType
  sourceId: number;
  weaponId: number;
  endX: number;
  endY: number;
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

// PlayerState: ID(1) + X(2) + Y(2) + Angle(2) + HP(1) + Weapon(1) + Ammo(1) + Status(1) = 11 bytes
export const PLAYER_STATE_SIZE = 11;

// EntityState: ID(2) + Type(1) + X(2) + Y(2) + Angle(2) = 9 bytes
export const ENTITY_STATE_SIZE = 9;

// Snapshot Header: Type(1) + Tick(2) + PlayerCount(1) + EntityCount(2) = 6 bytes
export const SNAPSHOT_HEADER_SIZE = 6;

// GameEvent: Type(1) + EventType(1) + SourceID(1) + WeaponID(1) + EndX(2) + EndY(2) = 8 bytes
export const GAME_EVENT_SIZE = 8;


// --- Fixed-Point Math Helpers ---

const POS_SCALE = 100;
const POS_MIN = -327.68;
const POS_MAX = 327.67;
const ANGLE_SCALE = 65535 / (2 * Math.PI);

/**
 * Packs a float position into a fixed-point Int16.
 * Clamps to valid range.
 */
export function packPos(val: number): number {
  // Clamp to prevent overflow wrapping
  if (val < POS_MIN) val = POS_MIN;
  if (val > POS_MAX) val = POS_MAX;
  return Math.floor(val * POS_SCALE);
}

/**
 * Unpacks a fixed-point Int16 into a float position.
 */
export function unpackPos(val: number): number {
  return val / POS_SCALE;
}

/**
 * Packs a float radian angle into a Uint16.
 */
export function packAngle(rad: number): number {
  // Normalize to 0 -> 2PI range
  let normalized = rad % (2 * Math.PI);
  if (normalized < 0) normalized += 2 * Math.PI;
  return Math.floor(normalized * ANGLE_SCALE);
}

/**
 * Unpacks a Uint16 into a float radian angle.
 */
export function unpackAngle(val: number): number {
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

    view.setUint8(offset, player.weapon);
    offset += 1;

    view.setUint8(offset, player.ammo);
    offset += 1;

    view.setUint8(offset, player.status);
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

/**
 * Writes a GameEvent packet to the DataView.
 * Returns the new offset.
 */
export function writeGameEvent(view: DataView, offset: number, event: GameEvent): number {
  view.setUint8(offset, PacketType.GAME_EVENT);
  offset += 1;

  view.setUint8(offset, event.type);
  offset += 1;

  view.setUint8(offset, event.sourceId);
  offset += 1;

  view.setUint8(offset, event.weaponId);
  offset += 1;

  view.setInt16(offset, packPos(event.endX), true);
  offset += 2;

  view.setInt16(offset, packPos(event.endY), true);
  offset += 2;

  return offset;
}

// --- Readers ---

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

    const weapon = view.getUint8(offset);
    offset += 1;

    const ammo = view.getUint8(offset);
    offset += 1;

    const status = view.getUint8(offset);
    offset += 1;

    players.push({ id, x, y, angle, hp, weapon, ammo, status });
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

/**
 * Reads a GameEvent payload.
 * assumes offset points to the first byte of the PAYLOAD.
 */
export function readGameEvent(view: DataView, offset: number): GameEvent {
  const type = view.getUint8(offset);
  offset += 1;

  const sourceId = view.getUint8(offset);
  offset += 1;

  const weaponId = view.getUint8(offset);
  offset += 1;

  const endX = unpackPos(view.getInt16(offset, true));
  offset += 2;

  const endY = unpackPos(view.getInt16(offset, true));
  offset += 2;

  return { type, sourceId, weaponId, endX, endY };
}
