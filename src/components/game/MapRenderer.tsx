import { useEffect, useRef, useState, useMemo } from 'react'
import { Object3D, InstancedMesh } from 'three'
import { useLevelStore } from '../../stores/levelStore'
import { TEMPLATES } from '@3615/shared/maps/templates/registry'
import { TileType } from '@3615/shared/maps/types'
import { ROOM_SIZE } from '@3615/shared/maps/constants'

// Constants
const TILE_SIZE = 2 // 2 meters per tile
const WALL_HEIGHT = 3 // 3 meters tall
const MAX_INSTANCES = 300 // Reduced from 5000 for safety (Progressive Rendering)

export function MapRenderer() {
  const levelData = useLevelStore(state => state.levelData)

  // Refs for InstancedMeshes
  const wallMeshRef = useRef<InstancedMesh>(null)
  const floorMeshRef = useRef<InstancedMesh>(null)

  const [ready, setReady] = useState(false)

  // Delay mount to let the browser breathe (GPU Timeout Prevention)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 500)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!ready || !levelData || !wallMeshRef.current || !floorMeshRef.current) return

    const walls = wallMeshRef.current
    const floors = floorMeshRef.current
    const dummy = new Object3D()

    let wallCount = 0
    let floorCount = 0

    console.log('[MapRenderer] Starting generation...')

    try {
      // Iterate through all rooms
      outerLoop: for (const room of levelData.rooms) {
        const template = TEMPLATES[room.templateId]
        if (!template) {
          console.warn(`[MapRenderer] Missing template for room ${room.id} (${room.templateId})`)
          continue
        }

        // Room Origin in World Space
        // Grid X/Y * Room Width (12 * 2 = 24m)
        const roomOriginX = room.x * ROOM_SIZE * TILE_SIZE
        const roomOriginY = room.y * ROOM_SIZE * TILE_SIZE

        // Iterate through 12x12 grid
        for (let rY = 0; rY < template.layout.length; rY++) {
          const row = template.layout[rY]
          for (let rX = 0; rX < row.length; rX++) {
            // Optimization: Stop if we hit the limit
            if (wallCount >= MAX_INSTANCES && floorCount >= MAX_INSTANCES) {
               break outerLoop;
            }

            const tile = row[rX]

             // Calculate World Position for this Tile
             // rX is local grid X, rY is local grid Y
             const x = roomOriginX + (rX * TILE_SIZE)
             const z = roomOriginY + (rY * TILE_SIZE)

             // Strict NaN Protection
             if (!Number.isFinite(x) || !Number.isFinite(z)) {
               console.warn('[MapRenderer] Skipping invalid coordinate:', x, z);
               continue;
             }

             // 1. FLOOR (Everywhere)
             if (floorCount < MAX_INSTANCES) {
               dummy.position.set(x, 0, z) // Floor at Y=0
               dummy.rotation.set(-Math.PI / 2, 0, 0) // Rotate to be flat
               dummy.scale.set(1, 1, 1)
               dummy.updateMatrix()

               floors.setMatrixAt(floorCount, dummy.matrix)
               floorCount++
             }

             // 2. WALLS
             if (tile === TileType.WALL) {
                if (wallCount < MAX_INSTANCES) {
                   dummy.position.set(x, WALL_HEIGHT / 2, z) // Center is at half height
                   dummy.rotation.set(0, 0, 0) // Reset rotation
                   dummy.scale.set(1, 1, 1)
                   dummy.updateMatrix()

                   walls.setMatrixAt(wallCount, dummy.matrix)
                   wallCount++
                }
             }
          }
        }
      }

      // Update Instance Counts
      walls.count = wallCount
      floors.count = floorCount

      // Buffer Flush: Notify Three.js to update buffers ONCE
      walls.instanceMatrix.needsUpdate = true
      floors.instanceMatrix.needsUpdate = true

      console.log(`[MapRenderer] Safe Render: ${wallCount} walls, ${floorCount} floors`)

    } catch (e) {
      console.error('[MapRenderer] Error generating map geometry:', e)
    }

  }, [levelData, ready])

  if (!ready || !levelData) return null

  return (
    <group>
      {/* WALLS: BoxGeometry 2x3x2 */}
      <instancedMesh ref={wallMeshRef} args={[undefined, undefined, MAX_INSTANCES]} frustumCulled={false}>
        <boxGeometry args={[TILE_SIZE, WALL_HEIGHT, TILE_SIZE]} />
        <meshBasicMaterial color="#00ffff" />
      </instancedMesh>

      {/* FLOORS: PlaneGeometry 2x2 */}
      <instancedMesh ref={floorMeshRef} args={[undefined, undefined, MAX_INSTANCES]} frustumCulled={false}>
        <planeGeometry args={[TILE_SIZE, TILE_SIZE]} />
        <meshBasicMaterial color="#ff0000" />
      </instancedMesh>
    </group>
  )
}
