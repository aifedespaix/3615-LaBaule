import { RoomTemplate } from '../types';
import { START_ROOM } from './start_room';
import { ARENA_01 } from './arena_01';
import { CORRIDOR_01 } from './corridor_01';

export const TEMPLATES: Record<string, RoomTemplate> = {
  [START_ROOM.id]: START_ROOM,
  [ARENA_01.id]: ARENA_01,
  [CORRIDOR_01.id]: CORRIDOR_01,
};
