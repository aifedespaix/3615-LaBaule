"use client";

import { useRef, useMemo, useEffect } from "react";
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

  // Shared Resources (Optimization)
  // Memory Optimization: Geometry and Material Reuse
  const remoteGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const remoteMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: 'red' }), []);

  // Cleanup Shared Resources on Unmount
  useEffect(() => {
    return () => {
      remoteGeometry.dispose();
      remoteMaterial.dispose();
    };
  }, [remoteGeometry, remoteMaterial]);

  // Tracers State (Local visual only)
  const tracersRef = useRef<Tracer[]>([]);

  // Trauma System
  const traumaRef = useRef(0);
  const shakeRef = useRef(new THREE.Vector3());

  // Prediction State
  const lastFireTimeRef = useRef(0);
  const collisionHelper = useMemo(() => levelData ? new CollisionHelper(levelData) : null, [levelData]);

  // Reusable Objects for Raycasting/Math (GC Optimization)
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseVecRef = useRef(new THREE.Vector2());
  const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const targetVecRef = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    const now = state.clock.elapsedTime * 1000; // ms

    // --- 1. Screen Shake (Trauma) ---
    // Safety check: ensure trauma is finite
    if (!Number.isFinite(traumaRef.current)) {
      traumaRef.current = 0;
    }

    if (traumaRef.current > 0) {
      const shake = traumaRef.current * traumaRef.current;
      const maxAngle = 10 * (Math.PI / 180);
      const maxOffset = 0.5; // Meters

      let angle = (Math.random() * 2 - 1) * maxAngle * shake;
      let offsetX = (Math.random() * 2 - 1) * maxOffset * shake;
      let offsetY = (Math.random() * 2 - 1) * maxOffset * shake;

      // NaN Guard for camera safety
      if (!Number.isFinite(angle)) angle = 0;
      if (!Number.isFinite(offsetX)) offsetX = 0;
      if (!Number.isFinite(offsetY)) offsetY = 0;

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
      // NaN Guard for Player Position
      const lx = Number.isFinite(gameState.localPlayer.x) ? gameState.localPlayer.x : 0;
      const ly = Number.isFinite(gameState.localPlayer.y) ? gameState.localPlayer.y : 0;

      // Update position from prediction
      localPlayerRef.current.position.set(lx, 0.5, ly);

      // Calculate Angle based on Mouse
      const raycaster = raycasterRef.current;
      const mouse = mouseVecRef.current;
      const inputAim = getInputState().aim;
      mouse.set(inputAim.x, inputAim.y);

      raycaster.setFromCamera(mouse, camera);
      const plane = planeRef.current;
      const target = targetVecRef.current;
      raycaster.ray.intersectPlane(plane, target);

      if (target) {
        const dx = target.x - lx;
        const dy = target.z - ly;
        const angle = Math.atan2(dy, dx);

        if (Number.isFinite(angle)) {
           gameState.localPlayer.angle = angle;
           localPlayerRef.current.rotation.y = -angle;
        }
      }

      // --- Client Prediction: Shooting ---
      if (getInputState().shoot && gameState.localPlayer.weapon !== undefined) {
        const weapon = WEAPONS[gameState.localPlayer.weapon as WeaponType];

        if (now - lastFireTimeRef.current >= weapon.fireRate && (gameState.localPlayer.ammo || 0) > 0) {
          lastFireTimeRef.current = now;

          // Predict Local Shot
          const startX = lx;
          const startY = ly;
          const angle = Number.isFinite(gameState.localPlayer.angle) ? gameState.localPlayer.angle : 0;

          // Spread application (Client Prediction)
          const spread = weapon.spread;
          const randomAngle = angle + (Math.random() - 0.5) * spread; // Simple spread

          const dirX = Math.cos(randomAngle);
          const dirY = Math.sin(randomAngle);

          // Raycast against Walls (for Visual Length)
          let endX = startX + dirX * weapon.range;
          let endY = startY + dirY * weapon.range;

          if (collisionHelper) {
            // Validate inputs to raycast
            if (Number.isFinite(startX) && Number.isFinite(startY) && Number.isFinite(dirX) && Number.isFinite(dirY)) {
               const hit = raycast(startX, startY, dirX, dirY, weapon.range, collisionHelper);
               if (hit) {
                 endX = hit.x;
                 endY = hit.y;
               }
            }
          }

          // Add Tracer (Guarded against NaN)
          if (Number.isFinite(endX) && Number.isFinite(endY)) {
              tracersRef.current.push({
                id: Math.random().toString(),
                startX, startY, endX, endY,
                spawnTime: state.clock.elapsedTime,
                color: '#ffff00'
              });
          }

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
        if (Number.isFinite(startX) && Number.isFinite(startY) && Number.isFinite(evt.endX) && Number.isFinite(evt.endY)) {
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
        }

        // Play Sound
        playSound('shoot' as SoundKey, [startX, 0, startY]);
      }

      // Trigger Gore on HIT_ENEMY
      // if (evt.type === GameEventType.HIT_ENEMY) {
      //   goreRef.current?.addSplatter(evt.endX, evt.endY);
      // }
    }

    // Clean up old tracers (GC Optimized: Swap-Remove-Like logic or In-Place Filter)
    const TRACER_DURATION = 0.1; // 100ms
    const activeTracers: Tracer[] = [];
    for (let i = 0; i < tracersRef.current.length; i++) {
        if (state.clock.elapsedTime - tracersRef.current[i].spawnTime < TRACER_DURATION) {
            activeTracers.push(tracersRef.current[i]);
        }
    }
    // Only replace array if size changed (though creating new array still creates garbage,
    // it's cleaner than in-place mutation for React refs usually, but here performance is key).
    // Actually, `filter` creates a new array anyway.
    // Ideally we use a ring buffer, but for < 100 items, `filter` or `push` is negligible.
    // The previous implementation used `filter` every frame.
    tracersRef.current = activeTracers;

    // Update Remote Players
    if (remotePlayersGroupRef.current) {
      const group = remotePlayersGroupRef.current;
      const activeIds = new Set<string>();

      gameState.otherPlayers.forEach(p => {
         activeIds.add(p.id.toString());
         let mesh = group.getObjectByName(p.id.toString()) as THREE.Mesh;

         if (!mesh) {
           // Optimization: Reuse Geometry and Material
           mesh = new THREE.Mesh(remoteGeometry, remoteMaterial);
           mesh.name = p.id.toString();
           group.add(mesh);
         }

         mesh.visible = true;
         // NaN Guard
         const px = Number.isFinite(p.x) ? p.x : 0;
         const py = Number.isFinite(p.y) ? p.y : 0;
         const pa = Number.isFinite(p.angle) ? p.angle : 0;

         mesh.position.set(px, 0.5, py);
         mesh.rotation.y = -pa;
      });

      // Cleanup disconnected players (Memory Leak Fix)
      // Iterate backwards to safely remove
      for (let i = group.children.length - 1; i >= 0; i--) {
         const child = group.children[i];
         if (!activeIds.has(child.name)) {
            group.remove(child);
            // Since geometry/material are shared/managed globally in this component,
            // we do NOT dispose them here.
         }
      }
    }
  });

  return (
    <group>
      {/* Map Rendering */}
      <MapRenderer />

      {/* Local Player (Blue) */}
      <mesh ref={localPlayerRef} position={[0, -100, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#00ffff" />
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

      // NaN Guard: Ensure we never write NaN to the buffer
      const sx = Number.isFinite(t.startX) ? t.startX : 0;
      const sy = Number.isFinite(t.startY) ? t.startY : 0;
      const ex = Number.isFinite(t.endX) ? t.endX : 0;
      const ey = Number.isFinite(t.endY) ? t.endY : 0;

      // Start Point
      positions[idx] = sx;
      positions[idx + 1] = 0.5;
      positions[idx + 2] = sy;

      // End Point
      positions[idx + 3] = ex;
      positions[idx + 4] = 0.5;
      positions[idx + 5] = ey;
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
