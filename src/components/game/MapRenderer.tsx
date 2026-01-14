import { useRef, useEffect, useState } from 'react'
import { Object3D } from 'three'

export function MapRenderer() {
  // DEBUG: Start with 0 count to see if the mesh MOUNTS without crashing
  const [ready, setReady] = useState(false)
  const meshRef = useRef(null)

  useEffect(() => {
    // Delay the heavy lifting by 1 second to let the specific "Context Lost" frame pass
    const timer = setTimeout(() => setReady(true), 1000)
    return () => clearTimeout(timer)
  }, [])

  if (!ready) return null // Render NOTHING first

  return (
    <group>
        {/* TEST 1: Use meshBasicMaterial (No lighting calculations) */}
        {/* TEST 2: Hardcode geometry args to standard 1x1x1 */}
        {/* TEST 3: Hardcode count to 10 to test VRAM allocation */}
        <instancedMesh ref={meshRef} args={[undefined, undefined, 10]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="red" wireframe />
        </instancedMesh>
    </group>
  )
}
