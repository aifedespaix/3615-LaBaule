# 🤖 3615 LA BAULE - AI Development Prompts

Ce fichier contient une suite de prompts séquentiels conçus pour guider une IA de développement (Cursor, Windsurf, Copilot) dans la construction du projet **3615 LA BAULE**.

**Usage :** Copiez-collez le contenu d'un bloc de code dans votre chat avec l'IA. Ne passez à l'étape suivante que lorsque l'étape courante est fonctionnelle et testée.

---

## 🛠️ Phase 0: Setup & Tooling

### 0.1 Initialization & Stack
```text
Act as a Senior Fullstack Engineer. Initialize the project repository with the following stack:

1. **Runtime:** Bun (Latest).
2. **Monorepo Structure:**
   - `/server`: Bun native WebSocket server.
   - `/client`: Vite + React 19 + TypeScript.
   - `/shared`: Shared TypeScript types and constants (symlinked or workspace).
3. **Frontend Dependencies:**
   - `three`, `@types/three`, `@react-three/fiber`, `@react-three/drei`.
   - `tailwindcss`, `postcss`, `autoprefixer`.
   - `shadcn/ui` (init manually or via CLI if possible, otherwise setup basic structure).
   - `zustand` for state management.
4. **Configuration:**
   - Strict TypeScript (`tsconfig.json` for each package).
   - Setup `bun test` runner.

**Goal:** A running "Hello World" where the client connects to the server via WebSocket and logs "Connected".
```

### 0.2 Asset Optimization Pipeline
```text
Create a robust Asset Pipeline script to optimize 3D models for WebGL.

**Requirements:**
1. Create a script `scripts/optimize-assets.ts` (runnable via `bun run optimize`).
2. Input Directory: `./raw-assets` (should be gitignored).
3. Output Directory: `./client/public/assets`.
4. **Tools:** Use `@gltf-transform/cli` or API.
5. **Process:**
   - Convert `.gltf` / `.glb` to **Draco Compressed** GLB.
   - Convert textures to **KTX2** format.
   - Resize textures > 2048px to 2048px.
6. **Automation:** The script should watch for changes or run on all files in `raw-assets` that are newer than their outputs.

**Reference:** See `GRAPHICS_SPECS.md` section 3.
```

---

## ⚙️ Phase 1: Core Engine (Client-Side Physics)

### 1.1 Input & Movement Physics
```text
Implement the Core Character Controller.

**Context:** This is a top-down shooter. We need "Slippery" movement physics, not instant snap.

**Specs (from GAMEPLAY_RULES.md):**
1. **Input:** ZQSD (Absolute movement).
2. **Physics:**
   - Custom implementation (No heavy physics engine).
   - `Velocity += Acceleration * dt`.
   - `Velocity *= Friction` (Friction = 0.85 per frame approx, tune for ~150ms slide).
   - **Collision:** Circle (Player) vs AABB (Walls).
3. **Camera:** Top-down orthographic or high FOV perspective.
   - Implement "Look Ahead": Camera position = `Lerp(PlayerPos, MousePos, 0.3)`.

**Task:** Create the `PlayerController` component in R3F. rigid bodies are NOT allowed. Use simple math in `useFrame`.
```

### 1.2 Sound Manager Architecture
```text
Implement the Global Sound Architecture.

**Constraints:**
- The music must **NOT** stop when the 3D scene (Level) is unmounted/remounted (e.g., Respawn).
- SFX must be spatialized in 3D.

**Architecture:**
1. **Global Store:** `useSoundStore` (Zustand) to manage Volume/Mute.
2. **Music Manager:** A non-rendering component (or outside Canvas) using `howler.js` for BGM loops.
3. **SFX:** Use R3F `<PositionalAudio />` (WebAudio API) for in-game sounds (Gunshots, Footsteps).
4. **Assets:** Setup a placeholder `assets/sounds/` folder.

**Deliverable:** A `SoundManager` system where I can call `playSound('shoot', position)` and `playMusic('synthwave_track_1')`.
```

---

## 📡 Phase 2: Network Foundation

### 2.1 Binary Schema & Protocol
```text
Define the Network Protocol. We prioritize bandwidth over readability. NO JSON in gameplay packets.

**Reference:** Read `NETCODE_SPECS.md` carefully.

**Task:**
1. Create `/shared/netcode/schema.ts`.
2. Define binary structures using a library like `bytebuffer` or raw `DataView`:
   - `ClientInput`: Tick (u16), InputMask (u8), MouseRotation (u16).
   - `EntityState`: ID (u16), Type (u8), PosX (i16), PosY (i16), Rot (u16).
   - `WorldSnapshot`: Tick (u16), PlayerStates[], EntityStates[].
3. Implement utility functions `encodePacket(type, data)` and `decodePacket(buffer)`.
4. **Coordinate System:** Fixed-Point Math. Float * 100 => Int16. Range -327.68m to +327.67m.
```

### 2.2 Server Authority & Client Prediction
```text
Implement the Client-Server Loop.

**Logic:**
1. **Server (Bun):**
   - Run a game loop at **30Hz**.
   - Process incoming `ClientInput` buffers.
   - Update world state (Basic movement for now).
   - Broadcast `WorldSnapshot` to all clients.
2. **Client:**
   - **Prediction:** Move the local player immediately on Input. Store input in a `HistoryBuffer`.
   - **Reconciliation:** When `WorldSnapshot` arrives:
     - Compare Server Pos vs History Pos at that Tick.
     - If error > Threshold: Teleport to Server Pos and **Replay** subsequent inputs.
   - **Interpolation:** For *other* entities, render them with a 100ms delay using Linear Interpolation (Lerp) between the last two snapshots.

**Task:** Get two browser windows syncing movement. One player sees the other moving smoothly.
```

---

## 🗺️ Phase 3: Procedural Generation

### 3.1 Room Templates & Data Structures
```text
Setup the Room Template System.

**Reference:** `PROC_GEN_SPECS.md`.

**Task:**
1. Create a `/shared/maps/templates` directory.
2. Define the `RoomTemplate` interface (12x12 grid, spawn points, doors).
3. Create 3 hardcoded templates in JSON/TS:
   - `START_ROOM` (Safe, 1 exit).
   - `ARENA_01` (Open space, cover pillars).
   - `CORRIDOR_01` (Narrow, flanking spots).
4. Implement a `RoomParser` on the Server to read these templates.
```

### 3.2 Macro Generation (Drunkard's Walk)
```text
Implement the Dungeon Generator (Server Side).

**Algorithm:** Restricted Drunkard's Walk (`PROC_GEN_SPECS.md`).
1. Start at (0,0).
2. Generate 10-15 rooms.
3. Ensure Boss Room is > 6 steps away (Manhattan Distance).
4. Output: A `LevelData` object containing { `rooms`: [{id, x, y, templateId}], `doors`: [] }.

**Visualization:** Create a simple debug view (HTML Canvas 2D) on the client to visualize the generated grid layout.
```

### 3.3 Map Rendering (InstancedMesh)
```text
Render the generated map efficiently in R3F.

**Constraints:**
- Do NOT create 1 Mesh per Wall.
- Use `InstancedMesh` for Walls and Floor Tiles.

**Task:**
1. Receive `LevelData` from server.
2. Iterate through the grid.
3. Compute matrices for all walls.
4. Render the entire dungeon using:
   - `<instancedMesh key="walls" ... />`
   - `<instancedMesh key="floors" ... />`
5. Apply simple textures (placeholders).
```

---

## 🩸 Phase 4: Gameplay Loop

### 4.1 Weapons & Shooting (Raycast)
```text
Implement the Weapon System.

**Reference:** `GAMEPLAY_RULES.md` and `shared/weapons.ts`.

**Task:**
1. Define `WeaponConfig` (FireRate, Damage, Spread).
2. **Server:** Implement `Raycast` logic (Hitscan).
   - Validation: Can player shoot? (Ammo, FireRate).
   - Hit Check: Ray vs Circle (Enemies) / Ray vs AABB (Walls).
3. **Client:**
   - Visuals: Draw "Tracer" lines (Yellow Neon) fading out quickly.
   - Audio: Trigger gunshot SFX.
   - Screen Shake: Add Trauma on shoot.
```

### 4.2 Thrown Weapons (Circular Physics)
```text
Implement the Weapon Throw mechanic.

**Decision:** Use **Circular Collision** for thrown weapons (Optimized).

**Logic:**
1. **Input:** Right Click -> Throw current weapon.
2. **Physics:**
   - Spawn a "Projectile" entity.
   - Velocity = PlayerDir * ThrowForce.
   - Rotation = Spin fast.
   - **Collision:** `Distance(WeaponCenter, EnemyCenter) < (WeaponRadius + EnemyRadius)`.
3. **Effect:** On hit -> Deal Damage + **STUN** enemy (Stop movement for 1s).
```

### 4.3 Gore System (Circular Buffer)
```text
Implement the Optimized Gore System.

**Reference:** `GRAPHICS_SPECS.md`.

**Task:**
1. Create a `GoreSystem` component.
2. Use `InstancedMesh` with a pool of 2000 Quads (PlaneGeometry).
3. Implement a **Circular Buffer**:
   - `addSplatter(x, y)` updates the matrix at `currentIndex`.
   - Increment `currentIndex` (Loop back to 0 at max).
   - Mark `instanceMatrix` as `needsUpdate`.
4. Trigger splatter on Enemy Death or Hit.
```

---

## 📟 Phase 5: UI & Polish (Minitel)

### 5.1 Post-Processing Shader
```text
Implement the "Minitel" Post-Processing effect.

**Reference:** `GRAPHICS_SPECS.md` Section 2.

**Task:**
1. Use `@react-three/postprocessing`.
2. Create a Custom Shader Pass (`MinitelShader`):
   - Curvature (Barrel Distortion).
   - Scanlines (Sine wave).
   - Vignette.
   - Chromatic Aberration (RGB Shift).
3. Apply it to the main Scene.
```

### 5.2 HUD & Menus (Shadcn + Tailwind)
```text
Build the Game Interface.

**Reference:** `UI_UX_GUIDELINES.md`.

**Task:**
1. **Overlay:** Create a HTML layer on top of the Canvas.
2. **Font:** Import `VT323` or similar pixel font.
3. **Components:**
   - **MainMenu:** "3615 LA BAULE" (Blinking cursor). Input for Room Code.
   - **HUD:** Top Bar (Score), Bottom Bar (Status).
   - **Colors:** Use the strict Videotex Palette (Cyan, Magenta, Yellow, Green).
4. **Lobby:** Handle states `WAITING_FOR_PEER`, `CONNECTED`, `GAME_START`.
5. **Error Handling:** Display simple feedback for "Invalid Code" or "Room Full".
```

---

## 🧪 Phase 6: QA & Optimization

### 6.1 Performance Check
```text
Verify strict performance constraints.

1. **Memory:** Ensure no memory leaks in `useFrame` (no `new Vector3` every frame).
2. **Draw Calls:** Check `InstancedMesh` usage.
3. **Network:** Verify packet size (should be < 100 bytes/frame per player).
```
