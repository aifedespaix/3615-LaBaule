"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useNetworkGame } from "../../lib/network/useNetworkGame";
import * as THREE from "three";
import { MapRenderer } from "./MapRenderer";

export function NetworkedWorld() {
  const gameState = useNetworkGame();

  // Refs for meshes to update them without React re-renders (Performance)
  const localPlayerRef = useRef<THREE.Mesh>(null);
  const remotePlayersGroupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    // 1. Update Local Player
    if (gameState.localPlayer && localPlayerRef.current) {
      // Use Fixed Point conversion factor? No, physics uses float meters internally.
      // Schema converts to Fixed Point for transport.
      localPlayerRef.current.position.set(gameState.localPlayer.x, 0.5, gameState.localPlayer.y);
    }

    // 2. Update Remote Players
    if (remotePlayersGroupRef.current) {
      // Naive reconciliation of React Children vs Data?
      // For "Walking Skeleton", we can just clear and rebuild or pool.
      // Let's use a simple mapping if ID stays stable.
      // Actually, standard R3F pattern is to map state to components.
      // But `gameState` is a Mutable Ref, not State.
      // So we must manually manage the scene graph or force re-render?
      // Since we want 60fps smooth, manual manipulation is better.

      const group = remotePlayersGroupRef.current;

      // Simple pool strategy:
      // Hide all children.
      // Show/Move based on data.
      // Create new if needed.

      // First, map existing children by name (we'll use ID as name)
      const childrenMap = new Map<string, THREE.Object3D>();
      group.children.forEach(c => childrenMap.set(c.name, c));

      // Mark all as unused
      group.children.forEach(c => c.visible = false);

      gameState.otherPlayers.forEach(p => {
        let mesh = childrenMap.get(p.id.toString());
        if (!mesh) {
          // Create new mesh (Geometry/Material shared ideally)
          // For now, clone a template or create new
          const geom = new THREE.BoxGeometry(1, 1, 1);
          const mat = new THREE.MeshStandardMaterial({ color: 'red' });
          mesh = new THREE.Mesh(geom, mat);
          mesh.name = p.id.toString();
          group.add(mesh);
        }

        mesh.visible = true;
        mesh.position.set(p.x, 0.5, p.y);
        mesh.rotation.y = p.angle;
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

      {/* Floor Grid for Reference */}
      <gridHelper args={[100, 100, 0x444444, 0x222222]} />
    </group>
  );
}
