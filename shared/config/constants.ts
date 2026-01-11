export const TICK_RATE = 30;
export const TICK_DT = 1 / TICK_RATE;
export const PLAYER_SPEED = 500; // cm/s (5m/s)
export const RECONCILIATION_THRESHOLD = 10; // 0.1m in fixed point (10 units)

export const SNAPSHOT_BUFFER_SIZE = 5; // How many snapshots to keep for interpolation
export const INPUT_BUFFER_SIZE = 30; // How many inputs to keep for reconciliation
