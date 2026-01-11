import { RoomTemplate, ROOM_SIZE, TileType } from '@3615/shared';

export class RoomParser {

  /**
   * Validates if a template follows the 12x12 grid rule and has sealed borders.
   * Throws an error if invalid.
   */
  static validate(template: RoomTemplate): boolean {
    // 1. Check Dimensions
    if (template.layout.length !== ROOM_SIZE) {
      throw new Error(`Template ${template.id}: Invalid height. Expected ${ROOM_SIZE}, got ${template.layout.length}`);
    }

    for (let y = 0; y < ROOM_SIZE; y++) {
      if (template.layout[y].length !== ROOM_SIZE) {
        throw new Error(`Template ${template.id}: Invalid width at row ${y}. Expected ${ROOM_SIZE}, got ${template.layout[y].length}`);
      }
    }

    // 2. Check Borders (Must be Wall or DoorSocket)
    // Top & Bottom rows
    for (let x = 0; x < ROOM_SIZE; x++) {
      if (!this.isValidBorderTile(template.layout[0][x])) {
        throw new Error(`Template ${template.id}: Top border broken at (0, ${x}). Must be WALL or DOOR_SOCKET.`);
      }
       if (!this.isValidBorderTile(template.layout[ROOM_SIZE - 1][x])) {
        throw new Error(`Template ${template.id}: Bottom border broken at (${ROOM_SIZE-1}, ${x}). Must be WALL or DOOR_SOCKET.`);
      }
    }

    // Left & Right columns
    for (let y = 0; y < ROOM_SIZE; y++) {
      if (!this.isValidBorderTile(template.layout[y][0])) {
        throw new Error(`Template ${template.id}: Left border broken at (${y}, 0). Must be WALL or DOOR_SOCKET.`);
      }
      if (!this.isValidBorderTile(template.layout[y][ROOM_SIZE - 1])) {
        throw new Error(`Template ${template.id}: Right border broken at (${y}, ${ROOM_SIZE-1}). Must be WALL or DOOR_SOCKET.`);
      }
    }

    return true;
  }

  private static isValidBorderTile(tile: number): boolean {
    return tile === TileType.WALL || tile === TileType.DOOR_SOCKET;
  }

  /**
   * Rotates the template 90 degrees clockwise 'times' times.
   * 0 = 0 deg, 1 = 90 deg, 2 = 180 deg, 3 = 270 deg.
   */
  static rotate(template: RoomTemplate, times: number): RoomTemplate {
    const rotations = times % 4;
    if (rotations === 0) return template;

    let currentLayout = template.layout;
    let currentSpawns = template.enemySpawns;

    for (let i = 0; i < rotations; i++) {
      const { layout, spawns } = this.rotateOnce(currentLayout, currentSpawns);
      currentLayout = layout;
      currentSpawns = spawns;
    }

    return {
      ...template,
      id: `${template.id}_rot${rotations * 90}`,
      layout: currentLayout,
      enemySpawns: currentSpawns
    };
  }

  private static rotateOnce(layout: number[][], spawns: RoomTemplate['enemySpawns']) {
    const N = layout.length;
    // Create empty NxN grid
    const newLayout: number[][] = Array.from({ length: N }, () => Array(N).fill(0));

    // Rotate Grid: new[x][y] = old[y][N - 1 - x] (for 90 deg clockwise)
    // Wait, let's verify standard matrix rotation.
    // 90 deg clockwise: (x, y) -> (y, N - 1 - x) is incorrect for array indexing [row][col] which is [y][x]
    // In [y][x] notation:
    // (row, col) moves to (col, N - 1 - row)
    // new[col][N - 1 - row] = old[row][col]
    // Let's map new coords (r, c) back to old?
    // Or just iterate old and place in new.

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const val = layout[r][c];
        // new row = c
        // new col = N - 1 - r
        newLayout[c][N - 1 - r] = val;
      }
    }

    // Rotate Spawns
    // (x, y) corresponds to (col, row) usually in game logic.
    // If x is horizontal (col) and y is vertical (row):
    // (x, y) -> (N - 1 - y, x)
    // Example: (0, 0) top-left -> (11, 0) top-right.
    // (11, 0) -> (11, 11) bottom-right
    // (11, 11) -> (0, 11) bottom-left
    // (0, 11) -> (0, 0) top-left

    const newSpawns = spawns.map(s => ({
      ...s,
      x: ROOM_SIZE - 1 - s.y,
      y: s.x
    }));

    return { layout: newLayout, spawns: newSpawns };
  }
}
