// Emberlight — tuning constants. Single source of truth for balance.
// All simulation code imports from here; no magic numbers elsewhere.

export const FIELD_W = 1280;
export const FIELD_H = 720;
export const STEP = 1 / 60;

// Player
export const PLAYER_SPEED = 260;
export const PLAYER_RADIUS = 18;
export const PLAYER_START_LIVES = 3;
export const PLAYER_MAX_LIVES = 5;
export const INVULN_TIME = 1.5;
export const KNOCKBACK_ON_HIT = 260;

// Lantern light
export const LIGHT_RADIUS_BASE = 150;
export const LIGHT_RADIUS_MAX = 320;
export const LIGHT_DPS = 2.0;
export const EMBER_LIGHT_BONUS = 4; // permanent radius gained per ember

// Pulse (click / Space)
export const PULSE_COOLDOWN = 2.5;
export const PULSE_RADIUS = 280;
export const PULSE_DAMAGE = 2;
export const PULSE_KNOCKBACK = 340;
export const PULSE_ACTIVE_TIME = 0.28;

// Combo
export const COMBO_WINDOW = 3; // seconds between kills to keep the chain
export const COMBO_MAX = 5;

// Embers
export const EMBER_SPAWN_INTERVAL = 1.8;
export const EMBER_MAX_ON_FIELD = 8;
export const EMBER_PICKUP_RADIUS = 26;
export const EMBER_MAGNET_RADIUS = 130;
export const EMBER_SCORE = 10;
export const EMBER_DROP_CHANCE = 0.35;

// Score
export const SCORE_KILL = { drifter: 10, skitter: 15, spitter: 25, brute: 50 };
export const WAVE_BONUS = 100; // x wave number

// Enemy definitions: hp, speed (px/s), radius, score, colour
export const ENEMY = {
  drifter: { hp: 1, speed: 55, radius: 16, color: '#4b3a78', eye: '#cfc4ff' },
  skitter: { hp: 2, speed: 145, radius: 13, color: '#5d3f8e', eye: '#ffd76a' },
  spitter: { hp: 2, speed: 70, radius: 17, color: '#3d2b63', eye: '#ff7ad9' },
  brute: { hp: 5, speed: 42, radius: 30, color: '#2e2148', eye: '#ff5d5d' },
};
export const SPITTER_SHOOT_INTERVAL = 2.4;
export const SPITTER_ORB_SPEED = 200;
export const SPITTER_KEEP_MIN = 200; // back away closer than this
export const SPITTER_KEEP_MAX = 300; // approach farther than this
export const ORB_RADIUS = 8;
export const ORB_LIFE = 5;

// 8 waves: counts per kind, spawn interval, global speed multiplier.
export const WAVES = [
  { drifter: 6, skitter: 0, spitter: 0, brute: 0, interval: 1.4, speed: 1.0 },
  { drifter: 8, skitter: 3, spitter: 0, brute: 0, interval: 1.2, speed: 1.03 },
  { drifter: 8, skitter: 5, spitter: 2, brute: 0, interval: 1.1, speed: 1.06 },
  { drifter: 10, skitter: 6, spitter: 3, brute: 1, interval: 1.0, speed: 1.09 },
  { drifter: 12, skitter: 8, spitter: 4, brute: 1, interval: 0.95, speed: 1.12 },
  { drifter: 12, skitter: 10, spitter: 5, brute: 2, interval: 0.9, speed: 1.15 },
  { drifter: 14, skitter: 12, spitter: 6, brute: 2, interval: 0.85, speed: 1.18 },
  { drifter: 14, skitter: 14, spitter: 8, brute: 3, interval: 0.8, speed: 1.21 },
];
export const TOTAL_WAVES = WAVES.length;

// Palette
export const PALETTE = {
  bg: '#0d1026',
  bgEdge: '#07081a',
  groundLine: '#1a2044',
  lantern: '#ffd76a',
  lanternCore: '#fff3c4',
  ember: '#ff8c2e',
  emberCore: '#ffd23e',
  shadow: '#4b3a78',
  text: '#f2ead8',
  dimText: '#9a93b8',
  heart: '#ff5d73',
  cardBg: '#1c2140',
  cardBorder: '#3a4470',
  cardHover: '#2a3260',
  banner: '#ffd76a',
};

export const BEST_KEY = 'emberlight-best';
