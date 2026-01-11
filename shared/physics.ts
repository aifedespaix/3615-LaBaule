import { InputMask } from './netcode/masks';
import { PLAYER_SPEED, TILE_SIZE, ENTITY_RADIUS } from './config/constants';
import { LevelData } from './level';
import { CollisionHelper } from './map/collision';

interface MovableEntity {
  x: number;
  y: number;
}

interface TargetEntity {
  id: number | string;
  x: number;
  y: number;
  // Radius? Assume fixed for now
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
  // TODO: Add collision checking using CollisionHelper if needed for movement
}

/**
 * Performs a DDA Raycast against the level grid.
 * @param startX Starting X (World Meters)
 * @param startY Starting Y (World Meters)
 * @param dirX Direction X (Normalized)
 * @param dirY Direction Y (Normalized)
 * @param maxDistance Maximum distance to check
 * @param collisionHelper Initialized CollisionHelper with level data
 * @returns Object containing hit info or null if no hit
 */
export function raycast(
  startX: number,
  startY: number,
  dirX: number,
  dirY: number,
  maxDistance: number,
  collisionHelper: CollisionHelper
): { x: number; y: number; distance: number; hit: boolean } | null {

  // Convert World Pos to Grid Pos (Float)
  let rayX = startX / TILE_SIZE;
  let rayY = startY / TILE_SIZE;

  // Map coordinates (Integer)
  let mapX = Math.floor(rayX);
  let mapY = Math.floor(rayY);

  // Delta Dist (distance ray has to travel to go from 1 x-side to the next x-side)
  // If dirX is 0, deltaDistX is Infinity
  const deltaDistX = (dirX === 0) ? 1e30 : Math.abs(1 / dirX);
  const deltaDistY = (dirY === 0) ? 1e30 : Math.abs(1 / dirY);

  // Step and Side Dist
  let stepX: number;
  let stepY: number;
  let sideDistX: number;
  let sideDistY: number;

  if (dirX < 0) {
    stepX = -1;
    sideDistX = (rayX - mapX) * deltaDistX;
  } else {
    stepX = 1;
    sideDistX = (mapX + 1.0 - rayX) * deltaDistX;
  }

  if (dirY < 0) {
    stepY = -1;
    sideDistY = (rayY - mapY) * deltaDistY;
  } else {
    stepY = 1;
    sideDistY = (mapY + 1.0 - rayY) * deltaDistY;
  }

  let hit = false;
  let side = 0; // 0 for NS, 1 for EW (optional)
  let distance = 0;

  // DDA Loop
  while (!hit && distance < maxDistance) {
    // Jump to next map square
    if (sideDistX < sideDistY) {
      sideDistX += deltaDistX;
      mapX += stepX;
      side = 0;
    } else {
      sideDistY += deltaDistY;
      mapY += stepY;
      side = 1;
    }

    // Check collision
    if (collisionHelper.isWall(mapX, mapY)) {
      hit = true;
    }

    // Calculate actual distance in World Units
    // Distance to the *previous* wall hit point?
    // Correct DDA distance calculation:
    // If side == 0, perpWallDist = (mapX - rayX + (1 - stepX) / 2) / dirX
    // But we are tracking sideDist.
    // distance = (sideDist - deltaDist) * TILE_SIZE?
    // Let's re-calculate exact hit point at the end.

    // Simplest: `distance` in meters.
    // If side == 0: dist = (sideDistX - deltaDistX) * TILE_SIZE
    // If side == 1: dist = (sideDistY - deltaDistY) * TILE_SIZE
    const distGrid = (side === 0) ? (sideDistX - deltaDistX) : (sideDistY - deltaDistY);
    distance = distGrid * TILE_SIZE;
  }

  if (hit && distance <= maxDistance) {
    return {
      x: startX + dirX * distance,
      y: startY + dirY * distance,
      distance: distance,
      hit: true
    };
  }

  return null;
}

/**
 * Performs Ray vs Circle checks against a list of entities.
 * Returns the closest entity hit.
 */
export function raycastEntities(
  startX: number,
  startY: number,
  dirX: number,
  dirY: number,
  maxDistance: number,
  entities: TargetEntity[],
  ignoredEntityId?: number | string
): { entity: TargetEntity; distance: number; x: number; y: number } | null {

  let closestHit: { entity: TargetEntity; distance: number; x: number; y: number } | null = null;
  let closestDist = maxDistance;

  for (const ent of entities) {
    if (ent.id === ignoredEntityId) continue;

    // Ray-Circle Intersection
    // Circle center (ent.x, ent.y), radius ENTITY_RADIUS
    // Ray origin (startX, startY), dir (dirX, dirY)

    // Vector from Ray Origin to Circle Center
    const fx = ent.x - startX;
    const fy = ent.y - startY;

    // Project f onto direction
    const t = fx * dirX + fy * dirY;

    // Closest point on ray to circle center
    const closestX = startX + t * dirX;
    const closestY = startY + t * dirY;

    // Distance from closest point to circle center (squared)
    const distSq = (closestX - ent.x) ** 2 + (closestY - ent.y) ** 2;
    const radiusSq = ENTITY_RADIUS * ENTITY_RADIUS;

    if (distSq <= radiusSq) {
      // Intersection!
      // But we need the *first* intersection point along the ray.
      // t is the center projection.
      // Offset from t is sqrt(radiusSq - distSq).
      const offset = Math.sqrt(radiusSq - distSq);
      const t0 = t - offset; // First hit point
      const t1 = t + offset; // Exit point

      if (t0 < closestDist && t0 > 0) {
        closestDist = t0;
        closestHit = {
          entity: ent,
          distance: t0,
          x: startX + t0 * dirX,
          y: startY + t0 * dirY
        };
      }
    }
  }

  return closestHit;
}
