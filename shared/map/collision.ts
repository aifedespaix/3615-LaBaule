import { LevelData } from '../level';
import { TEMPLATES } from '../maps/templates/registry';
import { ROOM_SIZE } from '../maps/constants';
import { TileType } from '../maps/types';

export class CollisionHelper {
  private roomMap: Map<string, string>; // "x,y" (grid coords) -> templateId
  private roomConnectivity: Map<string, boolean>; // "x,y,dir" -> isConnected

  constructor(level: LevelData) {
    this.roomMap = new Map();
    this.roomConnectivity = new Map();

    // Index Rooms
    for (const room of level.rooms) {
      this.roomMap.set(`${room.x},${room.y}`, room.templateId);
    }
  }

  /**
   * Gets the tile type at the given GLOBAL grid coordinates (integer).
   * Note: Global (0,0) corresponds to Room(0,0) Tile(0,0).
   */
  getTile(gx: number, gy: number): number {
    const rx = Math.floor(gx / ROOM_SIZE);
    const ry = Math.floor(gy / ROOM_SIZE);

    const templateId = this.roomMap.get(`${rx},${ry}`);
    if (!templateId) return TileType.WALL; // Void is Wall

    const template = TEMPLATES[templateId];
    if (!template) return TileType.WALL; // Should not happen

    // Local coordinates
    const lx = gx % ROOM_SIZE; // Assumes positive coords.
    const ly = gy % ROOM_SIZE;

    // Handle negative coords if needed?
    // Drunkard walk starts at 0,0 and goes anywhere.
    // Modulo on negative numbers in JS is weird (-1 % 12 = -1).
    // Let's implement proper positive modulo or offset.
    const lxPos = (lx + ROOM_SIZE) % ROOM_SIZE;
    const lyPos = (ly + ROOM_SIZE) % ROOM_SIZE;

    // Wait, if gx is -1, rx is -1.
    // lx is -1. lxPos is 11. Correct.

    const tile = template.layout[lyPos][lxPos];

    if (tile === TileType.DOOR_SOCKET) {
      // Logic: A door socket is passable ONLY if it connects to another room.
      // Check neighbors based on position in room.
      // Arena_01 has D at lx=0, lx=11, ly=0, ly=11.
      // Actually arena_01 D is at indices 0 and 11?
      // Check arena_01.ts: Row 0 has D at index 5 and 6.
      // Wait, arena_01.ts: `[W, W, W, W, W, D, D, W, W, W, W, W]`
      // So Top Middle.
      // Left side: `[W...], [D...], [D...]` (Rows 5,6)

      // If lxPos is 0 (West Wall) -> Check West Neighbor (rx-1)
      if (lxPos === 0) {
        if (this.roomMap.has(`${rx - 1},${ry}`)) return TileType.FLOOR;
      }
      // If lxPos is 11 (East Wall) -> Check East Neighbor (rx+1)
      if (lxPos === ROOM_SIZE - 1) {
        if (this.roomMap.has(`${rx + 1},${ry}`)) return TileType.FLOOR;
      }
      // If lyPos is 0 (North Wall) -> Check North Neighbor (ry-1)
      if (lyPos === 0) {
        if (this.roomMap.has(`${rx},${ry - 1}`)) return TileType.FLOOR;
      }
      // If lyPos is 11 (South Wall) -> Check South Neighbor (ry+1)
      if (lyPos === ROOM_SIZE - 1) {
        if (this.roomMap.has(`${rx},${ry + 1}`)) return TileType.FLOOR;
      }

      // If no neighbor, it's a closed door/wall.
      return TileType.WALL;
    }

    return tile;
  }

  isWall(gx: number, gy: number): boolean {
      const t = this.getTile(gx, gy);
      return t === TileType.WALL;
  }
}
