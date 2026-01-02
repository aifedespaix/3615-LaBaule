# 🎨 Graphics Specifications & Optimization

> **Status:** Draft
> **Scope:** Rendering Pipeline, Shaders, VFX, Asset Optimization
> **Vibe:** "Dirty Minitel", High Lethality, 60 FPS Locked

---

## 1. Gore System (Blood Splatters)

To maintain performance with high enemy counts ($50+$) and high lethality, we cannot create new Geometry for every blood splatter. We use a **Circular Buffer** pattern with `InstancedMesh`.

### Technical Constraints
*   **Geometry:** `PlaneGeometry` (Simple Quad). **NO** `DecalGeometry` (too CPU expensive).
*   **Count:** Pool of **2000** instances.
*   **Placement:** Floor only (Phase 1).
*   **Z-Fighting:** Handle via `polygonOffset` or micro Y-offsets.

### Implementation Logic (Circular Buffer)

The system maintains a pointer (`currentIndex`) to the next available instance index. When a unit dies:

1.  Calculate position $(x, z)$ and random rotation $r$.
2.  Update the Matrix at `currentIndex`.
3.  Increment `currentIndex`. If `currentIndex >= maxCount`, reset to 0 (overwriting the oldest splatter).
4.  Flag `instanceMatrix` as `needsUpdate`.

### Pseudo-Implementation (React Three Fiber)

```typescript
// GoreSystem.tsx (Concept)
const MAX_SPLATTERS = 2000;
const tempObject = new THREE.Object3D();

export const GoreSystem = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const [index, setIndex] = useState(0);

  // External hook or store triggers this
  const addSplatter = (position: THREE.Vector3) => {
    if (!meshRef.current) return;

    tempObject.position.copy(position);
    // Anti-Z-Fighting: Lift slightly based on index or random jitter
    tempObject.position.y = 0.01 + (index * 0.0001);

    tempObject.rotation.x = -Math.PI / 2; // Flat on floor
    tempObject.rotation.z = Math.random() * Math.PI * 2;

    // Scale randomization
    const scale = 0.8 + Math.random() * 0.5;
    tempObject.scale.set(scale, scale, 1);

    tempObject.updateMatrix();
    meshRef.current.setMatrixAt(index, tempObject.matrix);

    // Circular Buffer Logic
    meshRef.current.instanceMatrix.needsUpdate = true;
    setIndex((prev) => (prev + 1) % MAX_SPLATTERS);
  };

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_SPLATTERS]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={bloodTexture}
        transparent
        alphaTest={0.5}
        depthWrite={false} // Important for floor decals
      />
    </instancedMesh>
  );
};
```

---

## 2. CRT / Minitel Post-Processing

We use `@react-three/postprocessing` to implement a custom shader pass. The goal is to simulate a low-resolution, curved, phosphorescent Minitel screen.

### Features
*   **Curvature:** Barrel distortion.
*   **Scanlines:** Horizontal lines with intensity varying by sine wave.
*   **Vignette:** Darker corners.
*   **Ghosting/Aberration:** Slight RGB shift to mimic cheap electron beams.
*   **Noise:** Analog signal noise.

### GLSL Fragment Shader

```glsl
uniform float time;
uniform sampler2D tDiffuse; // Input scene texture
uniform vec2 resolution;

varying vec2 vUv;

// Configuration
const float CURVATURE = 3.0;
const float SCANLINE_INTENSITY = 0.15;
const float NOISE_INTENSITY = 0.08;
const float VIGNETTE_INTENSITY = 1.5;

// Distort UV coordinates to mimic curved CRT screen
vec2 curve(vec2 uv) {
    uv = (uv - 0.5) * 2.0;
    uv *= 1.1;
    uv.x *= 1.0 + pow((abs(uv.y) / 5.0), CURVATURE);
    uv.y *= 1.0 + pow((abs(uv.x) / 4.0), CURVATURE);
    uv  = (uv / 2.0) + 0.5;
    uv =  uv * 0.92 + 0.04;
    return uv;
}

void main() {
    vec2 q = vUv;
    vec2 uv = curve(q);

    // Black out pixels outside the curved screen
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    // Chromatic Aberration (Ghosting)
    // Shift channels slightly for the "cheap monitor" look
    float r = texture2D(tDiffuse, vec2(uv.x + 0.002, uv.y)).r;
    float g = texture2D(tDiffuse, vec2(uv.x + 0.000, uv.y)).g;
    float b = texture2D(tDiffuse, vec2(uv.x - 0.002, uv.y)).b;
    vec3 color = vec3(r, g, b);

    // Scanlines (Sine wave based on screen Y coordinate)
    float scanline = sin(uv.y * resolution.y * 2.0) * 0.5 + 0.5;
    color -= scanline * SCANLINE_INTENSITY;

    // Static Noise
    float noise = fract(sin(dot(uv * time, vec2(12.9898, 78.233))) * 43758.5453);
    color += noise * NOISE_INTENSITY;

    // Vignette
    float vig = (0.0 + 1.0 * 16.0 * uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y));
    color *= vec3(pow(vig, 0.2));

    // Green Tint / Phosphor Glow (Optional - tweak per art direction)
    // color *= vec3(0.8, 1.2, 0.9);

    gl_FragColor = vec4(color, 1.0);
}
```

---

## 3. Asset Pipeline & Optimization

To ensure the game runs in a browser on average hardware, we adhere to strict constraints.

### 3.1 Compression Standards
*   **Geometry:** Must use **Draco Compression**.
    *   *Tool:* `gltf-pipeline -d`
    *   *Rationale:* Reduces geometry size by ~40-60%, faster parsing on worker threads.
*   **Textures:** Must use **KTX2** (Basis Universal).
    *   *Tool:* `gltf-transform ktx` or similar.
    *   *Rationale:* GPU-ready format. No decoding on main thread. significantly lower VRAM usage.

### 3.2 Lighting Strategy
**Constraint:** NO Dynamic Shadow Maps for moving objects.

*   **Static Geometry (Walls/Floor):**
    *   Use **Baked Lightmaps** (created in Blender/Unity).
    *   Export as a separate UV channel (UV2).
    *   Apply via `.lightMap` property on materials.
*   **Dynamic Objects (Players/Enemies):**
    *   Use **Blob Shadows** (Simple dark Plane/Circle underneath the model).
    *   *Why?* Calculating shadow maps for 50 entities is too expensive for WebGL.

### 3.3 Materials
*   **Forbidden:** `MeshStandardMaterial` / `MeshPhysicalMaterial` (PBR is too heavy and breaks the retro aesthetic).
*   **Required:**
    *   `MeshBasicMaterial`: For unlit UI, sprites, or stylized glowing elements.
    *   `MeshLambertMaterial`: For 3D objects needing simple Gouraud shading.
    *   `ShaderMaterial`: For custom VFX (Shields, Lasers).

### 3.4 Draw Calls
*   Combine static meshes where possible.
*   Use `InstancedMesh` for:
    *   Projectiles
    *   Blood Splatters
    *   Debris/Shell Casings
    *   Identical Props (e.g., Computer Terminals, Chairs)
