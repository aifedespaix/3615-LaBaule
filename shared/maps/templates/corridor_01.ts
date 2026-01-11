import { RoomTemplate } from '../types';
import { _, W, D } from '../constants';

export const CORRIDOR_01: RoomTemplate = {
  id: 'corridor_01',
  tags: ['corridor'],
  layout: [
    [W, W, W, W, W, D, D, W, W, W, W, W],
    [W, _, _, W, _, _, _, _, W, _, _, W],
    [W, _, _, W, _, _, _, _, W, _, _, W],
    [W, _, _, _, _, _, _, _, _, _, _, W],
    [W, W, _, W, W, _, _, W, W, _, W, W],
    [W, _, _, _, _, _, _, _, _, _, _, W], // Narrow choke point effectively created by side walls
    [W, _, _, _, _, _, _, _, _, _, _, W],
    [W, W, _, W, W, _, _, W, W, _, W, W],
    [W, _, _, _, _, _, _, _, _, _, _, W],
    [W, _, _, W, _, _, _, _, W, _, _, W],
    [W, _, _, W, _, _, _, _, W, _, _, W],
    [W, W, W, W, W, D, D, W, W, W, W, W]
  ],
  enemySpawns: [
    { x: 1, y: 5, type: 'Melee' },
    { x: 10, y: 6, type: 'Melee' },
    { x: 5, y: 1, type: 'Ranged' },
    { x: 6, y: 10, type: 'Ranged' }
  ]
};
