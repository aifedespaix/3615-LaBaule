import { useEffect, useRef, useState } from "react";
import { useLevelStore } from "../../stores/levelStore";

export function DungeonMap() {
  const levelData = useLevelStore((state) => state.levelData);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Toggle Visibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'm') {
        setIsVisible(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Draw Map
  useEffect(() => {
    if (!isVisible || !levelData || !canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Reset
    const w = canvasRef.current.width;
    const h = canvasRef.current.height;
    ctx.fillStyle = '#000000'; // Minitel Black
    ctx.fillRect(0, 0, w, h);

    // Calculate Bounds
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    levelData.rooms.forEach(r => {
      minX = Math.min(minX, r.x);
      maxX = Math.max(maxX, r.x);
      minY = Math.min(minY, r.y);
      maxY = Math.max(maxY, r.y);
    });

    const PAD = 2; // Grid padding
    const gridW = (maxX - minX) + 1 + (PAD * 2);
    const gridH = (maxY - minY) + 1 + (PAD * 2);

    const cellSize = Math.min(w / gridW, h / gridH) * 0.8;
    const offsetX = (w - (gridW * cellSize)) / 2;
    const offsetY = (h - (gridH * cellSize)) / 2;

    const getPixel = (gx: number, gy: number) => ({
      x: offsetX + (gx - minX + PAD) * cellSize,
      y: offsetY + (gy - minY + PAD) * cellSize // Minitel coordinates: Y down? Yes canvas is Y down.
      // Actually standard coords are fine.
    });

    // Draw Rooms
    ctx.strokeStyle = '#00FF00'; // Minitel Green
    ctx.lineWidth = 2;
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    levelData.rooms.forEach(r => {
      const pos = getPixel(r.x, r.y);

      // Fill based on type
      if (r.templateId === 'START_ROOM') ctx.fillStyle = '#003300';
      else if (r.templateId === 'BOSS_ROOM') ctx.fillStyle = '#330000';
      else ctx.fillStyle = '#001100';

      ctx.fillRect(pos.x, pos.y, cellSize, cellSize);
      ctx.strokeRect(pos.x, pos.y, cellSize, cellSize);

      // Label
      ctx.fillStyle = '#00FF00';
      ctx.fillText(`${r.distanceToStart}`, pos.x + cellSize/2, pos.y + cellSize/2);
    });

    // Draw Doors
    ctx.fillStyle = '#FFFF00'; // Yellow doors
    levelData.doors.forEach(d => {
       // Door coordinates are in World Units (x12).
       // Need to convert back to Grid Units roughly?
       // x = d.x / 12, y = d.y / 12

       const gx = d.x / 12;
       const gy = d.y / 12;

       const pos = getPixel(gx, gy);

       // Draw a small rect
       const size = cellSize / 4;

       // Adjust pos because getPixel assumes top-left of a cell
       // But gx/gy might be fractional (e.g. 0.5)

       // Actually getPixel implementation:
       // x: offset + (gx - min + PAD) * cellSize
       // If gx is 0.5, it renders correctly between 0 and 1.

       // Center the door rect
       ctx.fillRect(pos.x - size/2, pos.y - size/2, size, size);
    });

  }, [isVisible, levelData]);

  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto">
      <div className="relative bg-black border-2 border-green-500 p-4 shadow-[0_0_20px_#00FF00] rounded-lg">
        <h2 className="text-green-500 font-mono text-center mb-2 animate-pulse">3615 PLAN</h2>
        <canvas
          ref={canvasRef}
          width={600}
          height={600}
          className="bg-black"
        />
        <div className="text-green-500 font-mono text-xs mt-2 text-center">
          [M] FERMER | ROOMS: {levelData?.rooms.length} | DOORS: {levelData?.doors.length}
        </div>
      </div>
    </div>
  );
}
