import { LevelData, Room, Door } from "../shared/level";

// --- Constants ---
const MIN_ROOMS = 10;
const MAX_ROOMS = 15;
const MIN_BOSS_DIST = 6;

// Templates
const TPL_START = 'START_ROOM';
const TPL_BOSS = 'BOSS_ROOM';
const TPL_COMMON = ['ARENA_01', 'CORRIDOR_01'];

// Utils
const hashKey = (x: number, y: number) => `${x},${y}`;

// --- Generator ---

export function generateDungeon(): LevelData {
  let attempts = 0;
  const MAX_ATTEMPTS = 100;

  while (attempts++ < MAX_ATTEMPTS) {
    const data = tryGenerate();
    if (data) {
      console.log(`Dungeon generated in ${attempts} attempts.`);
      return data;
    }
  }

  throw new Error("Failed to generate dungeon after max attempts");
}

function tryGenerate(): LevelData | null {
  const rooms = new Map<string, Room>();

  // 1. Initialize Walker
  let walker = { x: 0, y: 0 };

  // Add Start Room
  rooms.set(hashKey(0,0), {
    id: 'room_0',
    x: 0,
    y: 0,
    templateId: TPL_START,
    distanceToStart: 0
  });

  // 2. Drunkard's Walk
  // We want strictly 1 or 2 branches.
  // Implementation: Just walk randomly. To encourage branching, we could
  // occasionally jump back to an existing room?
  // Let's stick to a simple walker first.

  let steps = 0;
  // Safety break
  while (rooms.size < MAX_ROOMS && steps < 100) {
    steps++;

    // Pick random direction
    const dirs = [[0,1], [0,-1], [1,0], [-1,0]];
    const dir = dirs[Math.floor(Math.random() * dirs.length)];

    walker.x += dir[0];
    walker.y += dir[1];

    const key = hashKey(walker.x, walker.y);

    if (!rooms.has(key)) {
      // Create new room
      rooms.set(key, {
        id: `room_${rooms.size}`,
        x: walker.x,
        y: walker.y,
        templateId: 'TEMP', // Assign later
        distanceToStart: -1 // Calc later
      });
    } else {
      // Walked into existing room.
      // Maybe jump back to start occasionally to create branches?
      if (Math.random() < 0.1) {
        walker.x = 0;
        walker.y = 0;
      }
    }
  }

  if (rooms.size < MIN_ROOMS) return null;

  // 3. Flood Fill for Distances
  const roomList = Array.from(rooms.values());
  const distMap = new Map<string, number>();
  const queue: {x: number, y: number, d: number}[] = [{x:0, y:0, d:0}];
  distMap.set(hashKey(0,0), 0);

  let maxDist = 0;

  while (queue.length > 0) {
    const curr = queue.shift()!;
    maxDist = Math.max(maxDist, curr.d);

    // Check neighbors
    const dirs = [[0,1], [0,-1], [1,0], [-1,0]];
    for (const d of dirs) {
      const nx = curr.x + d[0];
      const ny = curr.y + d[1];
      const nKey = hashKey(nx, ny);

      if (rooms.has(nKey) && !distMap.has(nKey)) {
        distMap.set(nKey, curr.d + 1);
        queue.push({x: nx, y: ny, d: curr.d + 1});
      }
    }
  }

  // Assign distances to room objects
  for (const r of roomList) {
    const d = distMap.get(hashKey(r.x, r.y));
    if (d === undefined) {
      // Unreachable room? Should not happen with this walker, but just in case
      return null;
    }
    r.distanceToStart = d;
  }

  // 4. Boss Room Placement
  // Must be > 6 steps and a Dead End (1 neighbor)
  const candidates = roomList.filter(r => {
    if (r.distanceToStart < MIN_BOSS_DIST) return false;

    // Count neighbors
    let neighbors = 0;
    const dirs = [[0,1], [0,-1], [1,0], [-1,0]];
    for (const d of dirs) {
      if (rooms.has(hashKey(r.x + d[0], r.y + d[1]))) neighbors++;
    }
    return neighbors === 1;
  });

  if (candidates.length === 0) return null;

  // Pick furthest
  candidates.sort((a, b) => b.distanceToStart - a.distanceToStart);
  const bossRoom = candidates[0];
  bossRoom.templateId = TPL_BOSS;

  // 5. Assign Templates to others
  for (const r of roomList) {
    if (r.templateId === 'TEMP') {
      const tpl = TPL_COMMON[Math.floor(Math.random() * TPL_COMMON.length)];
      r.templateId = tpl;
    }
  }

  // 6. Generate Doors
  const doors: Door[] = [];
  const processedDoors = new Set<string>(); // Key: "x1,y1-x2,y2" sorted

  for (const r of roomList) {
    const dirs = [
      { x: 0, y: 1, orient: 'horizontal' }, // North
      { x: 0, y: -1, orient: 'horizontal' }, // South
      { x: 1, y: 0, orient: 'vertical' },    // East
      { x: -1, y: 0, orient: 'vertical' }    // West
    ];

    for (const d of dirs) {
      const nx = r.x + d.x;
      const ny = r.y + d.y;

      if (rooms.has(hashKey(nx, ny))) {
        // Door exists
        // Sort coords to avoid dupes
        const p1 = `${r.x},${r.y}`;
        const p2 = `${nx},${ny}`;
        const key = p1 < p2 ? `${p1}-${p2}` : `${p2}-${p1}`;

        if (!processedDoors.has(key)) {
          processedDoors.add(key);

          // Where is the door?
          // If we assume Rooms are 12x12.
          // r is at (r.x * 12, r.y * 12).
          // If neighbor is North (y+1), door is at y=12 relative to r.
          // World Y = (r.y * 12) + 12? Or just between them?

          // Let's use simple logic:
          // Vertical door (East/West connection) -> x = max(rx, nx) * 12?
          // If r.x=0, nx=1. Door at x=12.

          // Horizontal door (North/South connection) -> y = max(ry, ny) * 12?
          // If r.y=0, ny=1. Door at y=12.

          let doorX = 0;
          let doorY = 0;

          const TILE_SIZE = 12; // Room size in tiles

          if (d.orient === 'vertical') {
             // Connection along X axis
             doorX = Math.max(r.x, nx) * TILE_SIZE;
             doorY = r.y * TILE_SIZE + (TILE_SIZE / 2); // Centered Y?
          } else {
             // Connection along Y axis
             doorX = r.x * TILE_SIZE + (TILE_SIZE / 2); // Centered X?
             doorY = Math.max(r.y, ny) * TILE_SIZE;
          }

          doors.push({
            x: doorX,
            y: doorY,
            orientation: d.orient as 'horizontal' | 'vertical'
          });
        }
      }
    }
  }

  return {
    rooms: roomList,
    doors
  };
}
