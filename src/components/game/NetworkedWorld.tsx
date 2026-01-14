"use client";

import { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useNetworkGame } from "../../lib/network/useNetworkGame";
import * as THREE from "three";
import { MapRenderer } from "./MapRenderer";
import { getInputState } from "../../stores/inputStore";
import { useSoundStore } from "../../stores/useSoundStore";
import { SoundKey } from "../../config/soundMap";
import { GameEventType } from "@3615/shared/netcode/opcodes";
import { WEAPONS, WeaponType } from "@3615/shared/weapons";
import { raycast } from "@3615/shared/physics";
import { CollisionHelper } from "@3615/shared/map/collision";
import { useLevelStore } from "../../stores/levelStore";
// import { GoreSystem, GoreSystemHandle } from "./GoreSystem";

interface Tracer {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  spawnTime: number;
  color: string;
}

export function NetworkedWorld() {
  const gameState = useNetworkGame();
  const { camera, clock } = useThree();
  const playSound = useSoundStore(state => state.playSound);
  const levelData = useLevelStore(state => state.levelData);

  // Refs for meshes to update them without React re-renders (Performance)
  const localPlayerRef = useRef<THREE.Mesh>(null);
  const remotePlayersGroupRef = useRef<THREE.Group>(null);
  // const goreRef = useRef<GoreSystemHandle>(null);

  // Tracers State (Local visual only)
  const tracersRef = useRef<Tracer[]>([]);

  // Trauma System
  const traumaRef = useRef(0);
  const shakeRef = useRef(new THREE.Vector3());

  // Prediction State
  const lastFireTimeRef = useRef(0);
  const collisionHelper = useMemo(() => levelData ? new CollisionHelper(levelData) : null, [levelData]);

  useFrame((state, delta) => {
    const now = state.clock.elapsedTime * 1000; // ms

    // --- 1. Screen Shake (Trauma) ---
    if (traumaRef.current > 0) {
      const shake = traumaRef.current * traumaRef.current;
      const maxAngle = 10 * (Math.PI / 180);
      const maxOffset = 0.5; // Meters

      const angle = (Math.random() * 2 - 1) * maxAngle * shake;
      const offsetX = (Math.random() * 2 - 1) * maxOffset * shake;
      const offsetY = (Math.random() * 2 - 1) * maxOffset * shake;

      camera.rotation.z = angle;
      camera.position.x += offsetX - shakeRef.current.x; // Apply delta
      camera.position.y += offsetY - shakeRef.current.y;

      shakeRef.current.set(offsetX, offsetY, 0);

      // Decay
      traumaRef.current = Math.max(0, traumaRef.current - 1.2 * delta);
    } else if (shakeRef.current.lengthSq() > 0) {
      // Reset
      camera.rotation.z = 0;
      camera.position.x -= shakeRef.current.x;
      camera.position.y -= shakeRef.current.y;
      shakeRef.current.set(0, 0, 0);
    }


    // --- 2. Input & LookAt ---
    if (gameState.localPlayer && localPlayerRef.current) {
      // Update position from prediction
      localPlayerRef.current.position.set(gameState.localPlayer.x, 0.5, gameState.localPlayer.y);

      // Calculate Angle based on Mouse
      const raycaster = new THREE.Raycaster();
      // Assuming inputStore gives NDC (-1 to 1) for aim.
      // If logic in inputStore differs, we adjust.
      // Based on `useInputStore`, `aim` is Vector2.
      const mouse = new THREE.Vector2(getInputState().aim.x, getInputState().aim.y);

      raycaster.setFromCamera(mouse, camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const target = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, target);

      if (target) {
        const dx = target.x - gameState.localPlayer.x;
        const dy = target.z - gameState.localPlayer.y;
        const angle = Math.atan2(dy, dx);
        gameState.localPlayer.angle = angle;
        localPlayerRef.current.rotation.y = -angle;
      }

      // --- Client Prediction: Shooting ---
      if (getInputState().shoot && gameState.localPlayer.weapon !== undefined) {
        const weapon = WEAPONS[gameState.localPlayer.weapon as WeaponType];

        if (now - lastFireTimeRef.current >= weapon.fireRate && (gameState.localPlayer.ammo || 0) > 0) {
          lastFireTimeRef.current = now;

          // Predict Local Shot
          const startX = gameState.localPlayer.x;
          const startY = gameState.localPlayer.y;
          const angle = gameState.localPlayer.angle;

          // Spread application (Client Prediction)
          const spread = weapon.spread;
          const randomAngle = angle + (Math.random() - 0.5) * spread; // Simple spread

          const dirX = Math.cos(randomAngle);
          const dirY = Math.sin(randomAngle);

          // Raycast against Walls (for Visual Length)
          let endX = startX + dirX * weapon.range;
          let endY = startY + dirY * weapon.range;

          if (collisionHelper) {
            const hit = raycast(startX, startY, dirX, dirY, weapon.range, collisionHelper);
            if (hit) {
              endX = hit.x;
              endY = hit.y;
            }
          }

          // Add Tracer
          tracersRef.current.push({
            id: Math.random().toString(),
            startX, startY, endX, endY,
            spawnTime: state.clock.elapsedTime,
            color: '#ffff00'
          });

          // Play Sound
          playSound('shoot' as SoundKey, [startX, 0, startY]); // TODO: Map weapon to sound

          // Add Trauma
          traumaRef.current = Math.min(1.0, traumaRef.current + weapon.trauma);

          // Optimistic Ammo Update (Will be overwritten by server snapshot eventually)
          if (gameState.localPlayer.ammo) gameState.localPlayer.ammo--;
        }
      }
    }

    // --- 3. Process Game Events (Remote Tracers / SFX) ---
    while (gameState.events.length > 0) {
      const evt = gameState.events.shift()!;

      // Skip if source is self (Predicted already)
      if (evt.sourceId === gameState.playerId) continue;

      if (evt.type === GameEventType.SHOOT || evt.type === GameEventType.HIT_WALL || evt.type === GameEventType.HIT_ENEMY) {
        // Find source position
        let startX = 0, startY = 0;
        const remote = gameState.otherPlayers.find(p => p.id === evt.sourceId);
        if (remote) {
          startX = remote.x;
          startY = remote.y;
        }

        // Add Tracer
        const newTracer: Tracer = {
          id: Math.random().toString(),
          startX,
          startY,
          endX: evt.endX,
          endY: evt.endY,
          spawnTime: state.clock.elapsedTime,
          color: '#ffff00' // Neon Yellow
        };

        tracersRef.current.push(newTracer);

        // Play Sound
        playSound('shoot' as SoundKey, [startX, 0, startY]);
      }

      // Trigger Gore on HIT_ENEMY
      // if (evt.type === GameEventType.HIT_ENEMY) {
      //   goreRef.current?.addSplatter(evt.endX, evt.endY);
      // }
    }

    // Clean up old tracers
    const TRACER_DURATION = 0.1; // 100ms
    tracersRef.current = tracersRef.current.filter(t => state.clock.elapsedTime - t.spawnTime < TRACER_DURATION);

    // Update Remote Players
    if (remotePlayersGroupRef.current) {
      const group = remotePlayersGroupRef.current;
      const childrenMap = new Map<string, THREE.Object3D>();
      group.children.forEach(c => childrenMap.set(c.name, c));

      group.children.forEach(c => c.visible = false);

      gameState.otherPlayers.forEach(p => {
        let mesh = childrenMap.get(p.id.toString());
        if (!mesh) {
          const geom = new THREE.BoxGeometry(1, 1, 1);
          const mat = new THREE.MeshStandardMaterial({ color: 'red' });
          mesh = new THREE.Mesh(geom, mat);
          mesh.name = p.id.toString();
          group.add(mesh);
        }

        mesh.visible = true;
        mesh.position.set(p.x, 0.5, p.y);
        mesh.rotation.y = -p.angle;
      });
    }
  });

  return (
    <group>
      {/* Map Rendering */}
      <MapRenderer />

      {/* Local Player (Blue) */}
      <mesh ref={localPlayerRef} position={[0, -100, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#00ffff" />
      </mesh>

      {/* Remote Players (Red) - Managed by ref */}
      <group ref={remotePlayersGroupRef} />

      {/* Gore System (Disabled for stability) */}
      {/* <GoreSystem ref={goreRef} /> */}

      {/* Tracers */}
      <TracerRenderer tracersRef={tracersRef} />

      {/* Floor Grid for Reference */}
      <gridHelper args={[100, 100, 0x444444, 0x222222]} />
    </group>
  );
}

// Optimized Tracer Renderer
function TracerRenderer({ tracersRef }: { tracersRef: React.MutableRefObject<Tracer[]> }) {
  const lineRef = useRef<THREE.LineSegments>(null);
  const maxTracers = 100;
  // Allocate buffer once: 100 lines * 2 vertices * 3 coordinates
  const positions = useMemo(() => new Float32Array(maxTracers * 2 * 3), []);

  useFrame(() => {
    if (!lineRef.current) return;

    const tracers = tracersRef.current;
    // Cap at maxTracers
    const count = Math.min(tracers.length, maxTracers);

    // Update geometry attributes directly
    for (let i = 0; i < count; i++) {
      const t = tracers[i];
      const idx = i * 6; // 2 vertices per line, 3 floats per vertex

      // Start Point
      positions[idx] = t.startX;
      positions[idx + 1] = 0.5;
      positions[idx + 2] = t.startY;

      // End Point
      positions[idx + 3] = t.endX;
      positions[idx + 4] = 0.5;
      positions[idx + 5] = t.endY;
    }

    // Tell Three.js to upload the new data
    lineRef.current.geometry.attributes.position.needsUpdate = true;

    // Only draw the active lines
    lineRef.current.geometry.setDrawRange(0, count * 2);
  });

  return (
    <lineSegments ref={lineRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#ffff00" linewidth={2} depthTest={false} transparent opacity={0.8} />
    </lineSegments>
  );
}
