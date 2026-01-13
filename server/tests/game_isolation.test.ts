import { describe, it, expect, beforeEach, afterEach } from "bun:test";

// Since we can't easily spin up the full WebSocket server in unit tests without conflicting with the running one
// or mocking complex objects, we will verify the core logic via "integration" tests that simulate the structures.
// However, the best way to test the logic I just wrote (which is in `server/index.ts` and mostly side-effect heavy)
// is to simulate the Room Management logic.

// But `server/index.ts` is an entry point, not a module with exports we can test easily without refactoring.
// For now, I will create a test that verifies the Game class isolation, which is the core of the multi-room logic.

import { Game } from "../game";
import { generateDungeon } from "../dungeon";

describe("Multi-Room Game Isolation", () => {
    let game1: Game;
    let game2: Game;

    beforeEach(() => {
        const level1 = generateDungeon();
        const level2 = generateDungeon();
        game1 = new Game(level1);
        game2 = new Game(level2);
    });

    it("should allow adding players with same ID to different games", () => {
        const p1_g1 = game1.addPlayer(1);
        const p1_g2 = game2.addPlayer(1);

        expect(p1_g1.id).toBe(1);
        expect(p1_g2.id).toBe(1);
        expect(game1.players.size).toBe(1);
        expect(game2.players.size).toBe(1);

        // Modify one, ensure other is untouched
        p1_g1.x = 100;
        expect(p1_g2.x).toBe(0); // Default spawn is 0,0 usually
    });

    it("should maintain independent projectile lists", () => {
        const p1 = game1.addPlayer(1);
        // Simulate throw in Game 1
        game1.processInput(1, {
            tick: 1,
            inputMask: 32, // THROW
            mouseAngle: 0
        });

        expect(game1.projectiles.length).toBe(1);
        expect(game2.projectiles.length).toBe(0);
    });
});
