// Weapon Definitions and Configuration

export enum WeaponType {
  FISTS = 0,
  BAT = 1,
  PISTOL = 2,
  UZI = 3,
  SHOTGUN = 4,
}

export interface WeaponConfig {
  name: string;
  type: WeaponType;
  damage: number;
  fireRate: number; // in ms
  ammoMax: number;
  knockback: number;
  spread: number; // in radians
  trauma: number; // Screen shake trauma per shot
  range: number; // Max distance in meters
  projectileCount: number; // Number of rays per shot (e.g. 1 for Pistol, 8 for Shotgun)
}

export const WEAPONS: Record<WeaponType, WeaponConfig> = {
  [WeaponType.FISTS]: {
    name: "FISTS",
    type: WeaponType.FISTS,
    damage: 34,
    fireRate: 250,
    ammoMax: 255, // Infinite represented as 255 or separate flag? 255 for now
    knockback: 25,
    spread: 0,
    trauma: 0.05,
    range: 1.5, // Melee range
    projectileCount: 1,
  },
  [WeaponType.BAT]: {
    name: "BAT",
    type: WeaponType.BAT,
    damage: 100,
    fireRate: 600,
    ammoMax: 100, // Durability? Using ammo field for simplicity
    knockback: 50,
    spread: 0.5, // Arc
    trauma: 0.30,
    range: 2.0,
    projectileCount: 1, // Or a sweep? Raycast sweep simulated as one wide ray or multiple?
                        // For raycast implementation, melee might just be a short thick ray or box.
                        // We will use 1 ray for now with logic handling.
  },
  [WeaponType.PISTOL]: {
    name: "PISTOL",
    type: WeaponType.PISTOL,
    damage: 50,
    fireRate: 400,
    ammoMax: 12,
    knockback: 15,
    spread: 0.02,
    trauma: 0.15,
    range: 20.0,
    projectileCount: 1,
  },
  [WeaponType.UZI]: {
    name: "UZI",
    type: WeaponType.UZI,
    damage: 30,
    fireRate: 90,
    ammoMax: 32,
    knockback: 5,
    spread: 0.15,
    trauma: 0.04,
    range: 15.0,
    projectileCount: 1,
  },
  [WeaponType.SHOTGUN]: {
    name: "SHOTGUN",
    type: WeaponType.SHOTGUN,
    damage: 15, // Per pellet
    fireRate: 1000,
    ammoMax: 6,
    knockback: 10,
    spread: 0.25,
    trauma: 0.50,
    range: 12.0,
    projectileCount: 8,
  },
};
