import { PlayerState, EntityState, Status, GameEvent } from "../shared/netcode/schema";
import { EntityType, GameEventType } from "../shared/netcode/opcodes";
import { ClientData, ServerProjectile } from "./types";
import { applyInput, raycast, raycastEntities, checkCircleCollision } from "../shared/physics";
import { TICK_DT, PROJECTILE_RADIUS, ENTITY_RADIUS } from "../shared/config/constants";
import { WEAPONS, WeaponType } from "../shared/weapons";
import { InputMask } from "../shared/netcode/masks";
import { CollisionHelper } from "../shared/map/collision";
import { LevelData } from "../shared/level";

export class Game {
  players: Map<number, PlayerState>;
  clientData: Map<number, ClientData>;
  projectiles: ServerProjectile[];
  collisionHelper: CollisionHelper;
  levelData: LevelData;

  // Stun State: PlayerID -> Timestamp (ms)
  playerStuns: Map<number, number>;

  // Events to be consumed by the network layer
  pendingEvents: GameEvent[];

  private nextEntityId: number = 1;

  constructor(levelData: LevelData) {
    this.levelData = levelData;
    this.collisionHelper = new CollisionHelper(levelData);
    this.players = new Map();
    this.clientData = new Map();
    this.projectiles = [];
    this.playerStuns = new Map();
    this.pendingEvents = [];
  }

  addPlayer(id: number): PlayerState {
    const player: PlayerState = {
      id: id,
      x: 0,
      y: 0,
      angle: 0,
      hp: 100,
      weapon: WeaponType.PISTOL,
      ammo: WEAPONS[WeaponType.PISTOL].ammoMax,
      status: 0,
      score: 0
    };

    this.players.set(id, player);

    this.clientData.set(id, {
        id: id,
        inputQueue: [],
        lastProcessedTick: 0,
        lastFireTime: 0
    });

    return player;
  }

  removePlayer(id: number) {
    this.players.delete(id);
    this.clientData.delete(id);
    this.playerStuns.delete(id);
  }

  processInput(playerId: number, input: { tick: number; inputMask: number; mouseAngle: number }) {
    const player = this.players.get(playerId);
    const data = this.clientData.get(playerId);
    if (!player || !data) return;

    const now = Date.now();

    // Check Stun Status (Updated here or in update loop? In update loop is better for consistency)
    // But input processing happens before physics.

    // Apply Input
    applyInput(player, input.inputMask, TICK_DT);
    player.angle = input.mouseAngle;

    // Handle THROW (Bit 5)
    if ((input.inputMask & InputMask.THROW) && player.weapon !== WeaponType.FISTS) {
       // Create Projectile
       const weapon = WEAPONS[player.weapon as WeaponType];

       const dirX = Math.cos(player.angle);
       const dirY = Math.sin(player.angle);

       const proj: ServerProjectile = {
           id: this.nextEntityId++,
           type: EntityType.PROJECTILE,
           x: player.x + dirX * 0.5, // Spawn slightly in front
           y: player.y + dirY * 0.5,
           angle: player.angle,
           ownerId: player.id,
           dx: dirX * weapon.throwSpeed,
           dy: dirY * weapon.throwSpeed,
           damage: weapon.throwDamage,
           spawnTime: now
       };

       this.projectiles.push(proj);

       // Remove Weapon (Revert to Fists)
       player.weapon = WeaponType.FISTS;
       player.ammo = WEAPONS[WeaponType.FISTS].ammoMax;
    }

    // Weapon Logic (SHOOT)
    if ((input.inputMask & InputMask.SHOOT) && !(player.status & Status.STUNNED)) {
        const weapon = WEAPONS[player.weapon as WeaponType];

        // Check Cooldown
        if (now - data.lastFireTime >= weapon.fireRate) {
            // Check Ammo
            if (player.ammo > 0) {
                data.lastFireTime = now;
                player.ammo--;

                // Fire Raycast(s)
                const startX = player.x;
                const startY = player.y;

                // Calculate direction vector from angle
                const dirX = Math.cos(player.angle);
                const dirY = Math.sin(player.angle);

                // 1. Check Walls
                const wallHit = raycast(startX, startY, dirX, dirY, weapon.range, this.collisionHelper);
                let maxDist = weapon.range;
                let endX = startX + dirX * maxDist;
                let endY = startY + dirY * maxDist;
                let eventType = GameEventType.SHOOT;

                if (wallHit) {
                    maxDist = wallHit.distance;
                    endX = wallHit.x;
                    endY = wallHit.y;
                    eventType = GameEventType.HIT_WALL;
                }

                // 2. Check Entities (Players + Enemies)
                // Construct target list from all OTHER players
                const targets = Array.from(this.players.values()).filter(p => p.id !== player.id);
                // Add entities (enemies) later when implemented

                const entHit = raycastEntities(startX, startY, dirX, dirY, maxDist, targets);

                if (entHit) {
                    endX = entHit.x;
                    endY = entHit.y;
                    eventType = GameEventType.HIT_ENEMY;

                    // Apply Damage
                    const targetPlayer = this.players.get(
                        Array.from(this.players.keys()).find(key => this.players.get(key)?.id === entHit.entity.id)!
                    );

                    if (targetPlayer) {
                        targetPlayer.hp = Math.max(0, targetPlayer.hp - weapon.damage);
                        // TODO: Handle Death
                    }
                }

                // Enqueue Game Event
                this.pendingEvents.push({
                    type: eventType,
                    sourceId: player.id,
                    weaponId: player.weapon,
                    endX: endX,
                    endY: endY
                });
            }
        }
    }
  }

  update(dt: number) {
    const now = Date.now();

    // 1. Update Stun Status
    for (const [id, player] of this.players) {
        const stunUntil = this.playerStuns.get(id) || 0;
        if (now < stunUntil) {
            player.status |= Status.STUNNED;
        } else {
            player.status &= ~Status.STUNNED;
        }
    }

    // 2. Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];

        // Move
        p.x += p.dx * dt;
        p.y += p.dy * dt;
        p.angle += 15.0 * dt; // Spin fast

        let destroyed = false;

        // Wall Collision (Grid Check)
        // Check center point
        const mapX = Math.floor(p.x / 2.0); // TILE_SIZE hardcoded check? Use constant
        const mapY = Math.floor(p.y / 2.0); // TILE_SIZE = 2.0

        if (this.collisionHelper.isWall(mapX, mapY)) {
            destroyed = true;
        }

        // Entity Collision (Players)
        if (!destroyed) {
            for (const [id, target] of this.players) {
                if (target.id === p.ownerId) continue; // Don't hit self
                // Ignore already dead?
                if (target.hp <= 0) continue;

                if (checkCircleCollision(p.x, p.y, PROJECTILE_RADIUS, target.x, target.y, ENTITY_RADIUS)) {
                    // HIT!
                    destroyed = true;

                    // Apply Damage
                    target.hp = Math.max(0, target.hp - p.damage);

                    // Apply Stun (if not lethal?)
                    if (target.hp > 0 && p.damage < 50) {
                         this.playerStuns.set(target.id, now + 1000); // 1s Stun
                    }

                    // Enqueue Hit Event
                    this.pendingEvents.push({
                        type: GameEventType.HIT_ENEMY,
                        sourceId: p.ownerId,
                        weaponId: 0,
                        endX: p.x,
                        endY: p.y
                    });

                    break; // Hit one target
                }
            }
        }

        // Cleanup
        if (destroyed || (now - p.spawnTime > 5000)) { // 5s max life
            this.projectiles.splice(i, 1);
        }
    }
  }
}
