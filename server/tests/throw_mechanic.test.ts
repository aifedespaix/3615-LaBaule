import { describe, it, expect, beforeEach } from 'bun:test';
import { Game } from '../game';
import { LevelData } from '../../shared/level';
import { WeaponType } from '../../shared/weapons';
import { InputMask } from '../../shared/netcode/masks';
import { TICK_DT, PROJECTILE_RADIUS } from '../../shared/config/constants';
import { Status } from '../../shared/netcode/schema';

// Mock Level Data (Empty Room)
const mockLevelData: LevelData = {
    rooms: [
        { id: "room1", x: 0, y: 0, w: 12, h: 12, templateId: "arena_01" } // 12x12 room
    ],
    width: 24,
    height: 24
};

// We need to mock CollisionHelper or ensure templates registry works.
// Since server/game.ts imports CollisionHelper which imports templates/registry.
// This might fail if templates are not found or registry is complex.
// But we fixed the import in `shared/map/collision.ts`.
// Assuming the integration test environment can resolve shared modules.

describe('Server Integration: Throw Mechanic', () => {
    let game: Game;
    let playerAId: number;
    let playerBId: number;

    beforeEach(() => {
        game = new Game(mockLevelData);
        const pA = game.addPlayer(1);
        const pB = game.addPlayer(2);

        // Position them close
        // 1 meter apart horizontally
        pA.x = 2.0; pA.y = 2.0; pA.angle = 0; // Facing East
        pB.x = 4.0; pB.y = 2.0; pB.angle = Math.PI; // Facing West

        playerAId = 1;
        playerBId = 2;
    });

    it('Scenario: Throw Weapon, Hit Enemy, Stun Enemy', () => {
        const playerA = game.players.get(playerAId)!;
        const playerB = game.players.get(playerBId)!;

        // 1. Setup
        playerA.weapon = WeaponType.PISTOL; // Throwable
        expect(playerA.weapon).toBe(WeaponType.PISTOL);
        expect(game.projectiles.length).toBe(0);

        // 2. Action: Throw Input
        // Tick 1 input
        game.processInput(playerAId, {
            tick: 1,
            inputMask: InputMask.THROW,
            mouseAngle: 0
        });

        // Assert 1: Weapon Lost
        expect(playerA.weapon).toBe(WeaponType.FISTS);

        // Assert 2: Projectile Spawned
        expect(game.projectiles.length).toBe(1);
        const proj = game.projectiles[0];
        expect(proj.ownerId).toBe(playerAId);
        expect(proj.dx).toBeGreaterThan(0); // Flying East
        expect(proj.x).toBeGreaterThan(playerA.x); // Spawned in front

        // 3. Simulation: Advance loop until hit
        // Distance is approx 2.0 - 0.5 (spawn offset) = 1.5m
        // Speed is ~20m/s (Pistol)
        // Time = 1.5 / 20 = 0.075s.
        // TICK_DT = 1/30 = 0.033s.
        // Should hit in ~3 frames.

        let hit = false;
        for (let i = 0; i < 10; i++) {
            game.update(TICK_DT);
            if (game.projectiles.length === 0) {
                hit = true;
                break;
            }
        }

        // Assert 3: Projectile Destroyed
        expect(hit).toBe(true);
        expect(game.projectiles.length).toBe(0);

        // Assert 4: Effect (Damage + Stun)
        // Pistol Throw Damage is 10
        expect(playerB.hp).toBe(90);

        // Stun Status
        // We need to advance time slightly or mock Date.now() to check stun expiration?
        // But the stun logic sets `playerStuns` map.
        const stunUntil = game.playerStuns.get(playerBId);
        expect(stunUntil).toBeDefined();
        expect(stunUntil!).toBeGreaterThan(Date.now());

        // The status flag is updated at the START of the update loop.
        // Since we broke the loop immediately after the hit (mid-update),
        // we need one more tick to apply the status from the map to the player state.
        game.update(TICK_DT);

        // Update loop should have set the flag
        expect((playerB.status & Status.STUNNED)).toBe(Status.STUNNED);
    });
});
