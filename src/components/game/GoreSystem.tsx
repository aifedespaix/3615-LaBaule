import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import * as THREE from 'three';

const MAX_SPLATTERS = 2000;

export interface GoreSystemHandle {
  addSplatter: (x: number, y: number) => void;
}

// Procedural Texture Generation
function generateBloodTexture(): THREE.CanvasTexture {
  if (typeof document === 'undefined') return new THREE.CanvasTexture(new OffscreenCanvas(1, 1) as any);

  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Clear
  ctx.clearRect(0, 0, size, size);

  // Main Splat (Radial Gradient)
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size / 2 - 4;

  const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
  grad.addColorStop(0, 'rgba(180, 0, 0, 0.9)'); // Dark Red center
  grad.addColorStop(0.6, 'rgba(120, 0, 0, 0.8)');
  grad.addColorStop(1, 'rgba(100, 0, 0, 0)'); // Fade out

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();

  // Random Droplets
  const droplets = 8;
  for (let i = 0; i < droplets; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = (Math.random() * 0.5 + 0.3) * radius; // 30-80% of radius
    const r = Math.random() * 4 + 2; // Radius 2-6px

    const x = centerX + Math.cos(angle) * dist;
    const y = centerY + Math.sin(angle) * dist;

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(140, 0, 0, 0.85)';
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export const GoreSystem = forwardRef<GoreSystemHandle, {}>((_, ref) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const cursorRef = useRef(0);

  // Reusable Object3D to avoid allocations during loop
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Generate texture once
  const bloodTexture = useMemo(() => generateBloodTexture(), []);

  useImperativeHandle(ref, () => ({
    addSplatter: (x: number, y: number) => {
      if (!meshRef.current) return;

      // Position (Micro-offset Y to prevent Z-fighting)
      dummy.position.set(x, 0.01, y);

      // Rotation
      dummy.rotation.set(0, 0, 0);
      dummy.rotateX(-Math.PI / 2); // Lay flat (Local Z points Up)
      dummy.rotateZ(Math.random() * Math.PI * 2); // Spin around Local Z (World Y)

      // Scale (Random variation)
      const scale = 0.8 + Math.random() * 0.7; // 0.8 to 1.5
      dummy.scale.set(scale, scale, 1);

      dummy.updateMatrix();

      const index = cursorRef.current;
      meshRef.current.setMatrixAt(index, dummy.matrix);
      meshRef.current.instanceMatrix.needsUpdate = true;

      // Circular Buffer Increment
      cursorRef.current = (index + 1) % MAX_SPLATTERS;
    }
  }));

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, MAX_SPLATTERS]}
      frustumCulled={false} // Optimization: Always render if unsure, or rely on bounding sphere
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={bloodTexture}
        transparent
        depthWrite={false}
        color="#ffffff"
      />
    </instancedMesh>
  );
});

GoreSystem.displayName = 'GoreSystem';
