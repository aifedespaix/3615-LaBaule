export const SOUND_KEYS = {
  // Weapons
  SHOOT_PISTOL: 'shoot_pistol',
  SHOOT_SHOTGUN: 'shoot_shotgun',
  RELOAD: 'reload',
  // Gore/Impacts
  HIT_FLESH: 'hit_flesh',
  HIT_WALL: 'hit_wall',
  // UI (Minitel)
  UI_HOVER: 'ui_hover',
  UI_CONFIRM: 'ui_confirm',
  UI_CONNECT: 'ui_connect_v23'
} as const;

export type SoundKey = typeof SOUND_KEYS[keyof typeof SOUND_KEYS];
