import { RoomTemplate } from '../types';
import { _, W, D, G } from '../constants';

export const ARENA_01: RoomTemplate = {
  id: 'ARENA_01',
  tags: ['arena'],
  layout: [
    [W, W, W, W, W, D, D, W, W, W, W, W],
    [W, _, _, _, _, _, _, _, _, _, _, W],
    [W, _, G, _, _, _, _, _, _, G, _, W],
    [W, _, _, _, W, _, _, W, _, _, _, W],
    [W, _, _, _, _, _, _, _, _, _, _, D],
    [D, _, _, _, W, _, _, W, _, _, _, D],
    [D, _, _, _, _, _, _, _, _, _, _, D],
    [W, _, _, _, W, _, _, W, _, _, _, W],
    [W, _, _, _, _, _, _, _, _, _, _, W],
    [W, _, G, _, _, _, _, _, _, G, _, W],
    [W, _, _, _, _, _, _, _, _, _, _, W],
    [W, W, W, W, W, D, D, W, W, W, W, W]
  ],
  enemySpawns: [
    { x: 2, y: 2, type: 'Ranged' },
    { x: 9, y: 2, type: 'Ranged' },
    { x: 2, y: 9, type: 'Ranged' },
    { x: 9, y: 9, type: 'Ranged' },
    { x: 5, y: 5, type: 'Melee' },
    { x: 6, y: 6, type: 'Tank' }
  ]
};
