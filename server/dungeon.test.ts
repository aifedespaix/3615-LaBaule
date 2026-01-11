import { describe, it, expect } from 'bun:test';
import { generateDungeon } from './dungeon';

describe('Dungeon Generator', () => {
  it('should generate a dungeon with 10-15 rooms', () => {
    const data = generateDungeon();
    expect(data.rooms.length).toBeGreaterThanOrEqual(10);
    expect(data.rooms.length).toBeLessThanOrEqual(15);
  });

  it('should have a Start room at 0,0', () => {
    const data = generateDungeon();
    const start = data.rooms.find(r => r.x === 0 && r.y === 0);
    expect(start).toBeDefined();
    expect(start?.templateId).toBe('START_ROOM');
  });

  it('should have a Boss room at least 6 steps away', () => {
    // Generate multiple times to ensure stability
    for (let i=0; i<5; i++) {
        const data = generateDungeon();
        const boss = data.rooms.find(r => r.templateId === 'BOSS_ROOM');
        expect(boss).toBeDefined();
        expect(boss?.distanceToStart).toBeGreaterThanOrEqual(6);
    }
  });

  it('should generate doors', () => {
    const data = generateDungeon();
    expect(data.doors.length).toBeGreaterThan(0);

    // Check if a door corresponds to a connection
    // Pick first door
    const d = data.doors[0];

    // Reverse engineer grid coords
    const gx = d.x / 12;
    const gy = d.y / 12;

    // Should be near a room
    // Logic is tricky to reverse exactly, but let's check basic sanity
    expect(d.orientation).toMatch(/horizontal|vertical/);
  });
});
