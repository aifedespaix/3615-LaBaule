import { describe, expect, test } from "bun:test";
import { raycast, raycastEntities } from "./physics";
import { CollisionHelper } from "./map/collision";
import { LevelData } from "./level";
import { TileType } from "./maps/types";
import { ENTITY_RADIUS } from "./config/constants";

describe("Raycast", () => {
    test("Hits a wall", () => {
        const mockHelper = {
            isWall: (x: number, y: number) => x === 5 && y === 0,
            getTile: (x: number, y: number) => 0
        } as unknown as CollisionHelper;

        const result = raycast(1.0, 1.0, 1, 0, 100, mockHelper);
        expect(result).not.toBeNull();
        expect(result?.hit).toBe(true);
        // Wall at x=5 grid -> x=10 world. Ray starts at 1.0. Distance 9.0.
        expect(result?.distance).toBeCloseTo(9.0, 1);
    });

    test("Misses if too short", () => {
         const mockHelper = {
            isWall: (x: number, y: number) => x === 5 && y === 0,
            getTile: () => 0
        } as unknown as CollisionHelper;

        const result = raycast(1.0, 1.0, 1, 0, 5.0, mockHelper); // Max dist 5, Wall at 9
        expect(result).toBeNull();
    });
});

describe("Entity Raycast", () => {
    test("Hits an entity", () => {
        const entities = [{ id: 1, x: 5, y: 0 }];
        // Ray from (0,0) towards (10,0)
        // Should hit circle at x=5, r=0.4
        // Hit point = 5 - 0.4 = 4.6
        const result = raycastEntities(0, 0, 1, 0, 100, entities);

        expect(result).not.toBeNull();
        expect(result?.entity.id).toBe(1);
        expect(result?.distance).toBeCloseTo(5 - ENTITY_RADIUS, 3);
    });

    test("Ignores self", () => {
        const entities = [{ id: 1, x: 5, y: 0 }];
        const result = raycastEntities(0, 0, 1, 0, 100, entities, 1);
        expect(result).toBeNull();
    });

    test("Hits closest entity", () => {
        const entities = [
            { id: 1, x: 10, y: 0 },
            { id: 2, x: 5, y: 0 }
        ];
        const result = raycastEntities(0, 0, 1, 0, 100, entities);
        expect(result).not.toBeNull();
        expect(result?.entity.id).toBe(2);
    });
});
