export const TICK_RATE = 30;
export const TICK_DT = 1 / TICK_RATE;
export const PLAYER_SPEED = 8.0; // 8 m/s (Fast run)
export const RECONCILIATION_THRESHOLD = 10; // 0.1m in fixed point (10 units)

export const SNAPSHOT_BUFFER_SIZE = 5; // How many snapshots to keep for interpolation
export const INPUT_BUFFER_SIZE = 30; // How many inputs to keep for reconciliation

// Physics Constants
export const TILE_SIZE = 2.0; // 1 Tile = 2 Meters
export const ENTITY_RADIUS = 0.4; // 40cm radius for hitboxes
