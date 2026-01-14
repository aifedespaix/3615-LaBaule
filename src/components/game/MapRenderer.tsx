import { useMemo, useLayoutEffect, useRef } from 'react'
import { Object3D, InstancedMesh, Color } from 'three'
import { useLevelStore } from '../../stores/levelStore'
import { TEMPLATES } from '@3615/shared/maps/templates/registry'
import { TileType } from '@3615/shared/maps/types'
import { ROOM_SIZE } from '@3615/shared/maps/constants'

// Constants
const TILE_SIZE = 2 // 2 meters per tile
const WALL_HEIGHT = 3 // 3 meters tall
const MAX_INSTANCES = 5000 // Hard limit to prevent buffer overflows

export function MapRenderer() {
  const levelData = useLevelStore(state => state.levelData)

  // Refs for InstancedMeshes
  const wallMeshRef = useRef<InstancedMesh>(null)
  const floorMeshRef = useRef<InstancedMesh>(null)

  // Memoize geometry counts to avoid re-calculating on every render
  // This is purely for debug/logging, the actual count is dynamic
  const counts = useMemo(() => {
    if (!levelData) return { walls: 0, floors: 0 }
    // We could pre-calculate exact counts here if we wanted to match args perfectly,
    // but we use a fixed capacity for safety.
    return { walls: 0, floors: 0 }
  }, [levelData])

  useLayoutEffect(() => {
    if (!levelData || !wallMeshRef.current || !floorMeshRef.current) return

    const walls = wallMeshRef.current
    const floors = floorMeshRef.current
    const dummy = new Object3D()

    let wallCount = 0
    let floorCount = 0

    try {
      // Iterate through all rooms
      levelData.rooms.forEach(room => {
        const template = TEMPLATES[room.templateId]
        if (!template) {
          console.warn(`[MapRenderer] Missing template for room ${room.id} (${room.templateId})`)
          return
        }

        // Room Origin in World Space
        // Grid X/Y * Room Width (12 * 2 = 24m)
        const roomOriginX = room.x * ROOM_SIZE * TILE_SIZE
        const roomOriginY = room.y * ROOM_SIZE * TILE_SIZE

        // Iterate through 12x12 grid
        template.layout.forEach((row, rY) => {
          row.forEach((tile, rX) => {
             // Calculate World Position for this Tile
             // rX is local grid X, rY is local grid Y
             const x = roomOriginX + (rX * TILE_SIZE)
             const z = roomOriginY + (rY * TILE_SIZE)

             // 1. FLOOR (Everywhere except explicit holes if any? Assuming everywhere for now)
             // Check capacity
             if (floorCount < MAX_INSTANCES) {
               dummy.position.set(x, 0, z) // Floor at Y=0
               dummy.rotation.set(-Math.PI / 2, 0, 0) // Rotate to be flat (PlaneGeometry is XY aligned)
               dummy.scale.set(1, 1, 1)
               dummy.updateMatrix()

               // Verify matrix is valid
               if (isValidMatrix(dummy.matrix.elements)) {
                 floors.setMatrixAt(floorCount, dummy.matrix)
                 floorCount++
               }
             }

             // 2. WALLS
             if (tile === TileType.WALL) {
                if (wallCount < MAX_INSTANCES) {
                   dummy.position.set(x, WALL_HEIGHT / 2, z) // Center is at half height
                   dummy.rotation.set(0, 0, 0) // Reset rotation
                   dummy.scale.set(1, 1, 1)
                   dummy.updateMatrix()

                   if (isValidMatrix(dummy.matrix.elements)) {
                      walls.setMatrixAt(wallCount, dummy.matrix)
                      wallCount++
                   }
                }
             }
          })
        })
      })

      // Update Instance Counts
      walls.count = wallCount
      floors.count = floorCount

      // Notify Three.js to update buffers
      walls.instanceMatrix.needsUpdate = true
      floors.instanceMatrix.needsUpdate = true

      console.log(`[MapRenderer] Generated ${wallCount} walls and ${floorCount} floors.`)

    } catch (e) {
      console.error('[MapRenderer] Error generating map geometry:', e)
    }

  }, [levelData])

  if (!levelData) return null

  return (
    <group>
      {/* WALLS: BoxGeometry 2x3x2 */}
      {/* Note: args are Width, Height, Depth */}
      <instancedMesh ref={wallMeshRef} args={[undefined, undefined, MAX_INSTANCES]}>
        <boxGeometry args={[TILE_SIZE, WALL_HEIGHT, TILE_SIZE]} />
        <meshStandardMaterial color="#ff00ff" roughness={0.8} />
      </instancedMesh>

      {/* FLOORS: PlaneGeometry 2x2 */}
      <instancedMesh ref={floorMeshRef} args={[undefined, undefined, MAX_INSTANCES]}>
        <planeGeometry args={[TILE_SIZE, TILE_SIZE]} />
        <meshStandardMaterial color="#222222" roughness={0.8} />
      </instancedMesh>
    </group>
  )
}

// Helper to prevent NaN propagation to GPU
function isValidMatrix(elements: number[]): boolean {
  for (let i = 0; i < elements.length; i++) {
    if (!Number.isFinite(elements[i])) return false
  }
  return true
}
