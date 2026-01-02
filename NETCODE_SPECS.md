# 📡 Netcode Specifications & Binary Schema

> **Document Status:** Draft
> **Target Protocol:** WebSockets (Binary Type: `ArrayBuffer`)
> **Endianness:** Little Endian (Standard for x86/ARM/WASM)

---

## 1. Core Principles

To guarantee a competitive "Fast-Paced" feel while maintaining data integrity, the netcode follows these strict rules:

1.  **Server Authority:** The server is the single source of truth. It runs the physics simulation at **30Hz** (Tickrate).
2.  **Client Prediction:** The client simulates its own movement immediately (Zero Input Lag).
3.  **Server Reconciliation:** If the server's authoritative state differs from the client's predicted state, the client **re-simulates** all inputs since the divergence.
4.  **Bandwidth Optimization:** All network traffic is encoded in **Binary** (no JSON). Positions use Fixed-Point arithmetic.

---

## 2. Primitive Data Types

To save bandwidth, we avoid standard 64-bit doubles.

| Type | Bytes | Description | Formula / Mapping |
| :--- | :--- | :--- | :--- |
| **`Tick`** | 2 (Uint16) | Frame ID. Wraps around every ~36 mins at 30Hz. | `0` to `65535` |
| **`Pos16`** | 2 (Int16) | Fixed-Point Position (Centimeters). | `Value = Math.floor(Float * 100)` <br> Range: **-327.68m** to **+327.67m** |
| **`Angle16`** | 2 (Uint16) | High precision rotation. | `Value = Math.floor((Radians / (2*PI)) * 65535)` |
| **`EID`** | 2 (Uint16) | Entity ID (Enemies, Bullets). | Max **65,535** concurrent entities. |
| **`PID`** | 1 (Uint8) | Player ID. | Max **4** players (Architecture supports 255). |

---

## 3. Packet Schema (Binary Layout)

### 3.1 Client Input Packet (C->S)
Sent every frame by the client. Contains the player's intent.

**Total Size:** 6 Bytes (Header included)

```typescript
// Binary Layout
struct ClientInputPacket {
  tick: Uint16;       // 0-1: ID of the input frame
  inputMask: Uint8;   // 2:   Bitmask of pressed keys
  mouseAngle: Uint16; // 3-4: Precise look direction
  padding: Uint8;     // 5:   Alignment (Optional, or reserved for Weapon Index)
}
```

**Bitmask (`inputMask`):**
| Bit | Key | Action |
| :--- | :--- | :--- |
| 0 | `W` | Move Up |
| 1 | `S` | Move Down |
| 2 | `A` | Move Left |
| 3 | `D` | Move Right |
| 4 | `LMB` | Shoot |
| 5 | `RMB` | Throw / Pickup |
| 6 | `R` | Reload |
| 7 | `SPACE` | Dash |

---

### 3.2 World Snapshot Packet (S->C)
Sent by the server every tick (30Hz). Contains the state of the world.

**Structure:** `[Header] + [PlayerBlock] + [EntityBlock]`

#### A. Header (5 Bytes)
```typescript
struct SnapshotHeader {
  tick: Uint16;         // 2 bytes: The server tick this snapshot represents
  playerCount: Uint8;   // 1 byte:  Number of active players
  entityCount: Uint16;  // 2 bytes: Number of active dynamic entities (Bullets, Enemies)
}
```

#### B. Player Block (Repeated `playerCount` times)
**Size per Player:** 8 Bytes
```typescript
struct PlayerState {
  id: Uint8;       // 1 byte:  Player ID
  x: Int16;        // 2 bytes: Fixed-Point X
  y: Int16;        // 2 bytes: Fixed-Point Y
  angle: Uint16;   // 2 bytes: Rotation
  hp: Uint8;       // 1 byte:  Health (0-100) / Status Flags
}
```

#### C. Entity Block (Repeated `entityCount` times)
**Size per Entity:** 9 Bytes
```typescript
struct EntityState {
  id: Uint16;      // 2 bytes: Unique Entity ID
  type: Uint8;     // 1 byte:  Type (0: Bullet, 1: EnemyA, 2: EnemyB)
  x: Int16;        // 2 bytes: Fixed-Point X
  y: Int16;        // 2 bytes: Fixed-Point Y
  angle: Uint16;   // 2 bytes: Rotation (or Velocity Vector encoding for bullets)
}
```

---

## 4. Algorithms & Logic

### 4.1 Client-Side Prediction (The Local Loop)
To prevent the "feeling of walking in mud," the client does not wait for the server.

1.  **Input Sampling:** Every frame, capture `InputMask` and `MouseAngle`.
2.  **Local Simulation:**
    *   Apply velocity based on `InputMask`.
    *   Run collision detection against the static map (Client-side shared logic).
    *   Update local `Player.position`.
3.  **Storage:** Store the input and the resulting state in a `HistoryBuffer`:
    ```typescript
    type HistoryStep = { tick: number; input: InputPacket; state: PlayerState };
    history.push(currentStep);
    ```
4.  **Transmission:** Send `InputPacket` to Server.

### 4.2 Server Reconciliation (Correction)
When the Client receives a `Snapshot` from the Server:

1.  **Find Reference:** Look up the `HistoryStep` that matches `Snapshot.tick`.
2.  **Compare:** Calculate distance between `HistoryStep.state` and `Snapshot.playerState`.
3.  **Divergence Check:**
    *   **If (dist < Threshold):** Do nothing. The prediction was close enough.
    *   **If (dist > Threshold):** **RECONCILE.**
        1.  **Snap:** Force local player position to `Snapshot.playerState`.
        2.  **Replay:** Re-run the physics simulation for **ALL** inputs stored in `HistoryBuffer` from `Snapshot.tick + 1` up to `CurrentTick`.
        3.  **Update:** The player is now at the correct corrected position for the current frame.

### 4.3 Entity Interpolation (Remote Objects)
We cannot predict enemies or other players (we don't know their inputs). We interpolate them.

1.  **Buffer:** Store received Snapshots in a `SnapshotBuffer`.
2.  **Delay:** Render the world **100ms** in the past (Server Time - 100ms).
    *   *Why?* Ensures we always have a `PreviousSnapshot` and a `NextSnapshot` to interpolate between.
3.  **Interpolate:**
    ```typescript
    float alpha = (RenderTime - Prev.time) / (Next.time - Prev.time);
    CurrentPos = Lerp(Prev.pos, Next.pos, alpha);
    ```

### 4.4 Jitter Compensation (Client)
*   **Problem:** Network jitter causes Snapshots to arrive irregularly (e.g., +10ms, -5ms).
*   **Solution:** The `RenderTime` is adaptive. If the buffer runs dry, we slightly increase the delay (slow down time). If the buffer gets too large, we slightly decrease the delay (speed up time) to catch up.

### 4.5 Server-Side Jitter Buffer
*   **Problem:** Packets from clients arrive with irregular latency, potentially causing "missed" ticks or clumps of inputs arriving at once.
*   **Solution:** The server maintains a small input buffer (De-Jitter Buffer).
    1.  **Buffering:** Incoming `InputPackets` are not processed immediately upon socket receipt. They are placed in a queue ordered by `Tick`.
    2.  **Execution:** At the start of each Server Tick, the server pops the input corresponding to that tick.
    3.  **Smoothing:** If the buffer is empty (packet late), the server repeats the last known input (or predicts). If the buffer is too full (lag spike recovery), it may process multiple inputs in one tick to catch up.
    4.  **Target Buffer Size:** ~2-3 Ticks (66-100ms) to ensure smooth authority without excessive input lag.
