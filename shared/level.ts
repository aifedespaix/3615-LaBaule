export interface Room {
  id: string;
  x: number; // Grid X
  y: number; // Grid Y
  templateId: string;
  distanceToStart: number;
}

export interface Door {
  x: number; // World X (approx, or grid boundary)
  y: number; // World Y
  orientation: 'horizontal' | 'vertical';
}

export interface LevelData {
  rooms: Room[];
  doors: Door[];
}
