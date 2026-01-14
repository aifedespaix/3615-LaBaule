import { RoomTemplate } from '../types';

const W = 1; // Wall
const _ = 0; // Floor
const S = 2; // Spawn/Interest Point (Glass in TileType)

export const BOSS_ROOM: RoomTemplate = {
  id: 'BOSS_ROOM',
  tags: ['boss'],
  layout: [
    [W, W, W, W, W, W, W, W, W, W, W, W],
    [W, _, _, _, _, _, _, _, _, _, _, W],
    [W, _, W, W, _, _, _, _, W, W, _, W], // Corner Pillars
    [W, _, W, W, _, _, _, _, W, W, _, W],
    [W, _, _, _, _, _, _, _, _, _, _, W],
    [W, _, _, _, S, S, S, S, _, _, _, W], // Central Arena
    [W, _, _, _, S, S, S, S, _, _, _, W],
    [W, _, _, _, _, _, _, _, _, _, _, W],
    [W, _, W, W, _, _, _, _, W, W, _, W],
    [W, _, W, W, _, _, _, _, W, W, _, W],
    [W, _, _, _, _, _, _, _, _, _, _, W],
    [W, W, W, W, W, W, W, W, W, W, W, W],
  ],
  enemySpawns: [
    { x: 6, y: 6, type: 'Tank' }
  ]
};
