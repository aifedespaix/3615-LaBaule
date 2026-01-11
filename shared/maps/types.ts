export enum TileType {
  FLOOR = 0,
  WALL = 1,
  GLASS = 2,
  DOOR_SOCKET = 3,
}

export type EnemyType = 'Melee' | 'Ranged' | 'Tank';

export interface EnemySpawn {
  x: number;
  y: number;
  type: EnemyType;
}

export interface RoomTemplate {
  /** Unique identifier for the pattern (e.g., "office_open_01") */
  id: string;

  /**
   * 12x12 Grid representing the physical structure.
   */
  layout: number[][];

  /** Pre-defined spawn points for enemies to ensure tactical placement */
  enemySpawns: EnemySpawn[];

  /** Metadata for selection algorithm */
  tags: ('corridor' | 'arena' | 'boss' | 'start' | 'reward')[];
}
