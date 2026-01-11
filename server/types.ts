import { EntityState } from "../shared/netcode/schema";

export interface ClientData {
    id: number;
    inputQueue: { tick: number; inputMask: number; mouseAngle: number }[];
    lastProcessedTick: number;
    lastFireTime: number; // Timestamp of last shot
}

export interface ServerProjectile extends EntityState {
    ownerId: number;
    dx: number;
    dy: number;
    damage: number;
    spawnTime: number; // For safety cleanup
}
