import { useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useLevelStore } from '../../stores/levelStore';
import { TEMPLATES } from '@3615/shared/maps/templates/registry';
import { ROOM_SIZE } from '@3615/shared/maps/constants';
import { TileType } from '@3615/shared/maps/types';

const TILE_SIZE = 2; // 2 Meters
const WALL_HEIGHT = 3; // 3 Meters
const WALL_Y = WALL_HEIGHT / 2; // Center at 1.5

const COLOR_WALL = "cyan";
const COLOR_FLOOR = "#444444";

const tempMatrix = new THREE.Matrix4();

export function MapRenderer() {
  const levelData = useLevelStore((state) => state.levelData);

  // Refs for InstancedMeshes
  const wallsRef = useRef<THREE.InstancedMesh>(null);
  const floorsRef = useRef<THREE.InstancedMesh>(null);

  // State for instance counts
  const [counts, setCounts] = useState({ walls: 0, floors: 0 });

  useLayoutEffect(() => {
    if (!levelData) return;

    // Sanity Check: Log room count to detect explosive generation loop
    if (levelData.rooms.length > 50) {
       console.warn(`[MapRenderer] High room count detected: ${levelData.rooms.length}. Potential generation infinite loop?`);
    } else {
       console.log(`[MapRenderer] Generating geometry for ${levelData.rooms.length} rooms.`);
    }

    const rooms = levelData.rooms;
    let wallCount = 0;
    let floorCount = 0;

    // 1. Pass: Count instances
    for (const room of rooms) {
      const template = TEMPLATES[room.templateId];
      if (!template) continue;

      for (let r = 0; r < ROOM_SIZE; r++) {
        for (let c = 0; c < ROOM_SIZE; c++) {
          const tile = template.layout[r][c];
          if (tile === TileType.WALL) {
            wallCount++;
          } else {
            // All non-wall tiles get a floor
            floorCount++;
          }
        }
      }
    }

    setCounts({ walls: wallCount, floors: floorCount });

  }, [levelData]);

  // Update Matrices when counts/data ready
  useLayoutEffect(() => {
    if (!levelData || !wallsRef.current || !floorsRef.current) return;
    if (counts.walls === 0 && counts.floors === 0) return;

    // Safe Mode: Set render count to actual, but cap at 5000 (buffer size)
    const MAX_INSTANCES = 5000;
    wallsRef.current.count = Math.min(counts.walls, MAX_INSTANCES);
    floorsRef.current.count = Math.min(counts.floors, MAX_INSTANCES);

    const rooms = levelData.rooms;
    let wIndex = 0;
    let fIndex = 0;

    console.log(`[MapRenderer] Starting Matrix Update. Walls: ${counts.walls}, Floors: ${counts.floors}. Capped at ${MAX_INSTANCES}.`);

    try {
      for (const room of rooms) {
        const template = TEMPLATES[room.templateId];
        if (!template) continue;

        // Calculate Room Origin (Top-Left of the grid) in World Space
        // Room Coords (x,y) * (12 tiles * 2 meters)
        const roomWorldX = room.x * ROOM_SIZE * TILE_SIZE;
        const roomWorldZ = room.y * ROOM_SIZE * TILE_SIZE;

        for (let r = 0; r < ROOM_SIZE; r++) {
          for (let c = 0; c < ROOM_SIZE; c++) {
            const tile = template.layout[r][c];

            // Loop Guard: Stop if we exceed buffer
            if (tile === TileType.WALL && wIndex >= MAX_INSTANCES) {
                console.warn('[MapRenderer] Max WALL instance limit reached!');
                break;
            }
            if (tile !== TileType.WALL && fIndex >= MAX_INSTANCES) {
                console.warn('[MapRenderer] Max FLOOR instance limit reached!');
                break;
            }

            // Calculate Tile Center
            const tileCenterX = roomWorldX + (c * TILE_SIZE) + (TILE_SIZE / 2);
            const tileCenterZ = roomWorldZ + (r * TILE_SIZE) + (TILE_SIZE / 2);

            tempMatrix.identity();

            // Safety Check: Skip invalid coordinates
            if (!Number.isFinite(tileCenterX) || !Number.isFinite(tileCenterZ)) {
               console.error(`[MapRenderer] Invalid coordinates detected: ${tileCenterX}, ${tileCenterZ}. Hiding instance.`);
               continue;
            } else {
                // Valid Coordinate Calculation
                if (tile === TileType.WALL) {
                  tempMatrix.setPosition(tileCenterX, WALL_Y, tileCenterZ);
                } else {
                  tempMatrix.makeRotationX(-Math.PI / 2);
                  tempMatrix.setPosition(tileCenterX, 0, tileCenterZ);
                }
            }

            // Apply Matrix
            if (tile === TileType.WALL) {
              if (wIndex < MAX_INSTANCES) {
                  wallsRef.current.setMatrixAt(wIndex, tempMatrix);
                  // Log progress
                  if (wIndex % 100 === 0) {
                      console.log(`[MapRenderer] Processing wall ${wIndex}/${counts.walls} at ${tileCenterX},${tileCenterZ}.`);
                  }
                  wIndex++;
              }
            } else {
              if (fIndex < MAX_INSTANCES) {
                  floorsRef.current.setMatrixAt(fIndex, tempMatrix);
                   // Log progress
                   if (fIndex % 100 === 0) {
                      console.log(`[MapRenderer] Processing floor ${fIndex}/${counts.floors} at ${tileCenterX},${tileCenterZ}.`);
                  }
                  fIndex++;
              }
            }
          }
        }
      }
    } catch (e) {
        console.error("[MapRenderer] CRITICAL ERROR during matrix update:", e);
    }

    wallsRef.current.instanceMatrix.needsUpdate = true;
    floorsRef.current.instanceMatrix.needsUpdate = true;

  }, [levelData, counts]);

  if (!levelData) return null;

  return (
    <group>
      {/* Walls */}
      <instancedMesh
        ref={wallsRef}
        args={[undefined, undefined, 5000]} // Hardcoded Buffer Size
        frustumCulled={false}
      >
        <boxGeometry args={[TILE_SIZE, WALL_HEIGHT, TILE_SIZE]} />
        <meshStandardMaterial color={COLOR_WALL} />
      </instancedMesh>

      {/* Floors */}
      <instancedMesh
        ref={floorsRef}
        args={[undefined, undefined, 5000]} // Hardcoded Buffer Size
        frustumCulled={false}
      >
        <planeGeometry args={[TILE_SIZE, TILE_SIZE]} />
        <meshStandardMaterial color={COLOR_FLOOR} side={THREE.DoubleSide} />
      </instancedMesh>
    </group>
  );
}
