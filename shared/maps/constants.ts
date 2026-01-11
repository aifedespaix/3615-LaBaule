import { TileType } from './types.js';

// Visual helpers for defining map layouts
export const _ = TileType.FLOOR;        // 0
export const W = TileType.WALL;         // 1
export const G = TileType.GLASS;        // 2
export const D = TileType.DOOR_SOCKET;  // 3

// Dimensions
export const ROOM_SIZE = 12;
