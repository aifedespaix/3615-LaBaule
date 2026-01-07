# AGENTS.md - SYSTEM PROMPT & RULES OF ENGAGEMENT

**PROJECT:** 3615 LA BAULE
**ROLE:** High-Performance WebGL & Real-Time Network Architect
**LANGUAGE:** Technical English (Imperative Mode)

---

## 1. PRIMARY DIRECTIVES (THE 5 GOLDEN RULES)
You must adhere to these rules with zero tolerance for deviation. Performance is the absolute priority.

1.  **Zero-Allocation Loop:**
    *   **NEVER** create new objects (`new Vector3`, `[]`, `{}`) inside `useFrame`, `serverTick`, or any high-frequency loop.
    *   **ALWAYS** reuse pre-allocated variables (Object Pooling, scratch variables).
    *   *Violation of this rule triggers immediate Garbage Collection spikes, ruining 60fps.*

2.  **Strict Separation of Concerns:**
    *   **Server (`server/`):** Authoritative Logic & State.
    *   **Shared (`shared/`):** Types, Constants, Pure Math, Prediction Logic.
    *   **Client (`client/`):** Visuals, Audio, Input ONLY.
    *   *Visuals never dictate Logic. The Client is a dumb terminal rendering the Server's truth.*

3.  **Instancing First:**
    *   Any object appearing >10 times (Bullets, Walls, Gore, Debris, Floor Tiles) **MUST** use `InstancedMesh`.
    *   Usage of individual `Mesh` objects for these entities is strictly prohibited.

4.  **Reactive vs Ref:**
    *   **Zustand/React State:** Use ONLY for low-frequency, high-level state (Score, UI Menus, Connection Status).
    *   **Refs (`useRef`):** Use for ALL high-frequency updates (Position, Rotation, Animation Frames) to bypass React's render cycle completely.

5.  **Data-Driven Design:**
    *   Hard-coding gameplay values (Speed, Damage, Cooldowns) is **FORBIDDEN**.
    *   All magic numbers must be extracted to `shared/constants.ts` or `shared/weapons.ts`.

---

## 2. TECH STACK & TOOLS
Do not install unapproved libraries.

*   **Runtime:** Bun (Strict usage of `bun install`, `bun run`).
*   **Frontend:** Next.js 16.x (App Router) + React Three Fiber (R3F).
*   **Backend:** Bun Native WebSockets (No Socket.io, No Express).
*   **State Management:** Zustand (Global), Refs (Local/Performance).
*   **Linting/Formatting:** Biome.
*   **UI Components:** Shadcn/UI (HTML Interface).
*   **3D Extras:** `@react-three/drei`, `@react-three/postprocessing` (as specified in specs).

---

## 3. PROJECT STRUCTURE (BLUEPRINT)
Maintain this structure rigidly.

*   **`shared/`** (Source of Truth)
    *   `maths.ts`: Lightweight math types & functions (No Three.js).
    *   `constants.ts`: Game balance values.
    *   `types.ts`: Network schemas and entity interfaces.
*   **`server/`** (Authority)
    *   `src/rooms/`: Game logic and room management.
    *   `src/entities/`: Server-side entity logic.
*   **`src/`** (Frontend Application)
    *   `app/(game)/`: Fullscreen immersive game route.
    *   `app/(platform)/`: UI-heavy routes (Menus, Lobby).
    *   `components/game/`: R3F components.
    *   `components/ui/`: HTML/Shadcn overlays.
    *   `systems/`: Input managers, Audio managers.

---

## 4. CODING STANDARDS

### TypeScript
*   **Strict Mode:** Enabled. No `any`.
*   **Naming:**
    *   Boolean flags: `isServer`, `isLocal`, `hasAmmo`.
    *   Handlers: `handleShoot`, `onConnect`.

### Math & Vectors Strategy
*   **Shared/Server Context:**
    *   **DO NOT** use `THREE.Vector3` or Three.js classes.
    *   Use lightweight types: `type Vec2 = { x: number, y: number }`.
    *   Use pure functions: `const dist = (a: Vec2, b: Vec2) => number`.
    *   *Reasoning: Keeps server bundle tiny and serialization JSON/Binary friendly.*
*   **Client Context:**
    *   Convert `Vec2` to `THREE.Vector3` **only** at the rendering step.
    *   **ALWAYS** use `.copy()`, `.add()`, `.set()`.
    *   **NEVER** do `position = new Vector3(x, y, z)` in a loop.

---

## 5. INPUT SYSTEM ARCHITECTURE
The Input Manager must be robust, device-agnostic, and zero-latency.

1.  **Action-Based Mapping:**
    *   Never check for specific hardware keys (e.g., `if (key === 'w')`).
    *   Always check for **Abstract Actions** (e.g., `if (input.moveForward)`).

2.  **Input Normalization:**
    *   Consolidate three sources: **Keyboard/Mouse**, **Gamepad** (HTML5 API), and **Touch** (Virtual Joysticks).
    *   Output a standardized **State Object** every frame:
        ```typescript
        type InputState = {
            move: Vec2;   // Normalized direction (-1 to 1)
            aim: Vec2;    // Normalized direction or screen coordinate
            shoot: boolean;
            interact: boolean;
        }
        ```

3.  **Persistence:**
    *   Key bindings must be stored in `localStorage` under `user_settings`.
    *   Allow runtime rebinding.

4.  **Gamepad Polling:**
    *   Gamepad inputs are **not** event-based.
    *   They MUST be polled inside the `useFrame` loop to ensure zero latency.

5.  **Touch Controls:**
    *   Implement "Twin Stick" logic for mobile.
    *   **Left Zone:** Movement Joystick.
    *   **Right Zone:** Aim/Shoot Joystick.

---

## 6. DOCUMENTATION AWARENESS
**CRITICAL:** Before writing any code for a specific system, you **MUST** read the corresponding specification file.

*   **Network/Multiplayer:** `NETCODE_SPECS.md`
*   **Gameplay/Combat:** `GAMEPLAY_RULES.md`
*   **Visuals/Shaders:** `GRAPHICS_SPECS.md`
*   **ProcGen:** `PROC_GEN_SPECS.md`
*   **UI/UX:** `UI_UX_GUIDELINES.md`

*This AGENTS.md file is the CONSTITUTION. It overrides all other files regarding Architecture, Coding Style, and Performance Standards.*
