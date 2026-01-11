export enum PacketType {
  HANDSHAKE = 1,
  INPUT = 2,
  SNAPSHOT = 3,
  LEVEL_DATA = 4,
  GAME_EVENT = 5,
}

export enum GameEventType {
  SHOOT = 1,
  HIT_ENEMY = 2,
  HIT_WALL = 3,
}

export enum EntityType {
  PROJECTILE = 1,
}
