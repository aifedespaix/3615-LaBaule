import { RoomTemplate } from '../types';
import { _, W, D } from '../constants';

export const START_ROOM: RoomTemplate = {
  id: 'start_room',
  tags: ['start'],
  layout: [
    [W, W, W, W, W, D, D, W, W, W, W, W],
    [W, _, _, _, _, _, _, _, _, _, _, W],
    [W, _, W, W, _, _, _, _, W, W, _, W],
    [W, _, W, _, _, _, _, _, _, W, _, W],
    [W, _, _, _, _, _, _, _, _, _, _, W],
    [W, _, _, _, _, _, _, _, _, _, _, D], // Possible side exit
    [W, _, _, _, _, _, _, _, _, _, _, D],
    [W, _, _, _, _, _, _, _, _, _, _, W],
    [W, _, W, _, _, _, _, _, _, W, _, W],
    [W, _, W, W, _, _, _, _, W, W, _, W],
    [W, _, _, _, _, _, _, _, _, _, _, W],
    [W, W, W, W, W, W, W, W, W, W, W, W]  // Bottom closed
  ],
  enemySpawns: [] // Safe room
};
