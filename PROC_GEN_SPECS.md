# 🎲 Procedural Generation Specifications (The Architect)

> **Status:** Draft
> **Scope:** Floor Layout Algorithms, Room Templating, Enemy Spawning Logic
> **Reference:** `server/rooms.ts`

---

## 1. The Macro Algorithm (Floor Layout)

**Goal:** Create a coherent, non-linear dungeon layout of **10-15 rooms** that feels structured but unpredictable.

### Algorithm: Restricted Drunkard's Walk
We use a grid-based "Random Walker" approach with strict topological constraints to avoid "snakelike" linear corridors.

1.  **Grid Initialization:** Start with an infinite (or large fixed 20x20) empty grid.
2.  **Walker Start:** Place `Start Room` at center $(0,0)$.
3.  **Step Generation:**
    *   The Walker moves to an adjacent cell (Up, Down, Left, Right).
    *   If the cell is empty, create a generic `Fight Room`.
    *   Repeat until **Room Count** is between 10 and 15.
4.  **Branching Constraint:**
    *   Allow strictly **1 or 2 main branches**.
    *   *Implementation:* The walker can split its path, but we prune excessive dead-ends to keep the flow focused.

### Constraints & Validation
After generation, run a **Flood Fill (BFS) / Dijkstra** algorithm to calculate distances from $(0,0)$.

*   **Boss Room Placement:**
    *   Must be located at a "Dead End".
    *   **Distance Constraint:** Must be at least **6 steps** (Manhattan Distance) from the `Start Room`.
    *   *Retry:* If no room satisfies this condition, regenerate the layout.
*   **Connectivity:** Ensure all rooms are reachable.

---

## 2. The Micro Algorithm (Room Internals)

**Approach:** **Chunk-Based Templates**.
*   **Prohibited:** Pure Perlin Noise or Cellular Automata (Too organic/chaotic for a building structure).
*   **Mandated:** Hand-crafted 12x12 tile patterns that ensure cover placement and combat flow.

### Generation Steps
1.  **Template Selection:** Pick a template matching the room tags (e.g., `corridor`, `arena`).
2.  **Variation (Isometries):**
    *   Randomly **Flip X/Y** or **Rotate 90/180/270°** (if the template allows symmetry).
    *   *Goal:* Reuse the same 5 templates to create 40+ variations.
3.  **Dynamic Obstacles:**
    *   The template defines `Empty` tiles suitable for cover.
    *   **Probability:** **30%** chance per eligible tile to spawn dynamic cover (Table, Crate, Vending Machine).
    *   *Rule:* Never block the path between doors (Pathfinding check required).

---

## 3. Template Data Structure (JSON Schema)

Rooms are defined by strict JSON/TypeScript schemas to be easily parseable by the server.

```typescript
export interface RoomTemplate {
  /** Unique identifier for the pattern (e.g., "office_open_01") */
  id: string;

  /**
   * 12x12 Grid representing the physical structure.
   * Values:
   * 0 = Floor (Walkable)
   * 1 = Wall (Indestructible)
   * 2 = Glass (Destructible / See-through)
   * 3 = DoorSocket (Potential exit point)
   */
  layout: number[][];

  /** Pre-defined spawn points for enemies to ensure tactical placement */
  enemySpawns: Array<{
    x: number;
    y: number;
    type: 'Melee' | 'Ranged' | 'Tank';
  }>;

  /** Metadata for selection algorithm */
  tags: ('corridor' | 'arena' | 'boss' | 'start' | 'reward')[];
}
```

---

## 4. Enemy Population Logic (The Scaling)

We populate the room *after* the layout is finalized, using a "Budget" system based on difficulty.

### Difficulty Formula
```typescript
DifficultyScore = (Distance_From_Start * 0.5) + (Player_Count * 1.5)
```
*   **Distance_From_Start:** Steps from spawn (0 to ~8).
*   **Player_Count:** 1 or 2.

### Spawning Algorithm
1.  **Iterate** through the `enemySpawns` list defined in the `RoomTemplate`.
2.  **Roll** against the `DifficultyScore`.
3.  **Selection Logic:**
    *   If `DifficultyScore > Threshold_Elite` (e.g., 8.0) AND `Random() < 0.2`:
        *   Spawn **Elite / Tank** (High HP).
        *   *Cost:* Deduct 3 points from local budget (optional).
    *   Else:
        *   Spawn **Grunt** (Melee/Ranged based on spawn type).
    *   *Note:* Ensure we don't overcrowd small rooms. Cap max enemies per room (e.g., 8).
