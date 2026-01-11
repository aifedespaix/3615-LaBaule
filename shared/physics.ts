import { InputMask } from './netcode/masks';
import { PLAYER_SPEED } from './config/constants';

interface MovableEntity {
  x: number;
  y: number;
}

/**
 * Applies input to an entity for a single tick.
 * Deterministic physics update.
 * @param entity The entity to move
 * @param inputMask The bitmask of inputs
 * @param dt Delta time in seconds (should be fixed 1/30 for network ticks)
 */
export function applyInput(entity: MovableEntity, inputMask: number, dt: number): void {
  let dx = 0;
  let dy = 0;

  if (inputMask & InputMask.UP) {
    dy -= 1;
  }
  if (inputMask & InputMask.DOWN) {
    dy += 1;
  }
  if (inputMask & InputMask.LEFT) {
    dx -= 1;
  }
  if (inputMask & InputMask.RIGHT) {
    dx += 1;
  }

  // Normalize diagonal movement
  if (dx !== 0 && dy !== 0) {
    const length = Math.sqrt(dx * dx + dy * dy);
    dx /= length;
    dy /= length;
  }

  // Apply velocity
  entity.x += dx * PLAYER_SPEED * dt;
  entity.y += dy * PLAYER_SPEED * dt;

  // No collision checking against walls yet (Infinite Plane)
}
