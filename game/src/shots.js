// Deterministic staging + autopilot for screenshots and headless checks.
// No DOM, no Math.random, no Date.now — only the world's seeded rng.
// stageShot(name, world) drives the simulation and returns the screen
// the shot should be captured on:
//
//   'start' -> 5 s of title demo,            returns SCREEN_TITLE
//   'play'  -> 26 s of strong autopilot,     returns SCREEN_PLAY (lives intact)
//   'end'   -> passive autopilot until over, returns SCREEN_OVER (cap 600 s)
//   'win'   -> strong autopilot until win,   returns SCREEN_WIN   (cap 900 s)

import { STEP } from './config.js';
import {
  createWorld,
  startGame,
  step,
  pickUpgrade,
  SCREEN_TITLE,
  SCREEN_PLAY,
  SCREEN_UPGRADE,
  SCREEN_OVER,
  SCREEN_WIN,
} from './world.js';

export { SCREEN_TITLE, SCREEN_PLAY, SCREEN_OVER, SCREEN_WIN };

const UPGRADE_PRIORITY = [
  'wider-light',
  'extra-heart',
  'swift-pulse',
  'ember-magnet',
  'swift-boots',
  'thorn-ring',
];

function nearest(list, x, y) {
  let best = null;
  let bestD2 = Infinity;
  for (const e of list) {
    const dx = e.x - x;
    const dy = e.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = e;
    }
  }
  return { item: best, d: Math.sqrt(bestD2) };
}

// Strong autopilot: kite, collect, pulse when crowded, chase stragglers.
function strongInput(world) {
  const p = world.player;
  let mx = 0;
  let my = 0;
  let pulse = false;

  const nearEnemy = nearest(world.enemies, p.x, p.y);
  const nearEmber = nearest(world.embersList, p.x, p.y);
  const nearOrb = nearest(world.orbs, p.x, p.y);

  // 1. Dodge dark orbs first.
  if (nearOrb.item && nearOrb.d < 130) {
    const dx = p.x - nearOrb.item.x;
    const dy = p.y - nearOrb.item.y;
    const d = Math.hypot(dx, dy) || 1;
    // Sidestep perpendicular to the orb's travel so it can't track us.
    const px = -nearOrb.item.vy;
    const py = nearOrb.item.vx;
    const pd = Math.hypot(px, py) || 1;
    mx += (dx / d) * 0.7 + (px / pd) * 0.8;
    my += (dy / d) * 0.7 + (py / pd) * 0.8;
  }

  // 2. Flee enemies that are close enough to touch us soon.
  if (nearEnemy.item && nearEnemy.d < 150) {
    const dx = p.x - nearEnemy.item.x;
    const dy = p.y - nearEnemy.item.y;
    const d = Math.hypot(dx, dy) || 1;
    const w = (150 - nearEnemy.d) / 60; // stronger the closer they are
    mx += (dx / d) * w;
    my += (dy / d) * w;
  }

  // 3. Pulse when crowded.
  let inPulseRange = 0;
  for (const e of world.enemies) {
    if (Math.hypot(e.x - p.x, e.y - p.y) < 170) inPulseRange += 1;
  }
  if (inPulseRange >= 3 && world.pulseCooldown <= 0) pulse = true;

  // 4. Otherwise: nearest ember if one is safe, else hunt the nearest
  //    shadow (needed to drag spitters into the light).
  if (Math.hypot(mx, my) < 0.4) {
    if (nearEmber.item && (!nearEnemy.item || nearEnemy.d > 130)) {
      const dx = nearEmber.item.x - p.x;
      const dy = nearEmber.item.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      mx += dx / d;
      my += dy / d;
    } else if (nearEnemy.item) {
      const dx = nearEnemy.item.x - p.x;
      const dy = nearEnemy.item.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      // Close in, but stop at the edge of the light so it burns.
      if (nearEnemy.d > 120) {
        mx += dx / d;
        my += dy / d;
      }
    } else {
      // Nothing around: drift to the centre.
      const dx = 640 - p.x;
      const dy = 360 - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > 40) {
        mx += dx / d;
        my += dy / d;
      }
    }
  }

  // Stay inside the field: steer back from the edges.
  if (p.x < 80) mx += 1;
  if (p.x > 1200) mx -= 1;
  if (p.y < 80) my += 1;
  if (p.y > 640) my -= 1;

  const m = Math.hypot(mx, my);
  if (m > 1) {
    mx /= m;
    my /= m;
  }

  // Aim the lantern at the nearest shadow, else at the move direction.
  let aimX = p.x + mx * 100;
  let aimY = p.y + my * 100;
  if (nearEnemy.item) {
    aimX = nearEnemy.item.x;
    aimY = nearEnemy.item.y;
  }
  return { mx, my, aimX, aimY, pulse };
}

// Passive autopilot for the 'end' shot: wanders after embers, never
// pulses, never dodges — the shadows catch up with it eventually.
function passiveInput(world) {
  const p = world.player;
  const nearEmber = nearest(world.embersList, p.x, p.y);
  let mx = 0;
  let my = 0;
  if (nearEmber.item) {
    const dx = nearEmber.item.x - p.x;
    const dy = nearEmber.item.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    mx = (dx / d) * 0.5;
    my = (dy / d) * 0.5;
  } else {
    mx = Math.sin(world.time * 0.4) * 0.4;
    my = Math.cos(world.time * 0.33) * 0.4;
  }
  const nearEnemy = nearest(world.enemies, p.x, p.y);
  const aimX = nearEnemy.item ? nearEnemy.item.x : p.x + 100;
  const aimY = nearEnemy.item ? nearEnemy.item.y : p.y;
  return { mx, my, aimX, aimY, pulse: false };
}

function applyUpgradeChoice(world, priority) {
  for (const id of priority) {
    if (world.upgradeChoices.includes(id)) {
      pickUpgrade(world, id);
      return;
    }
  }
  if (world.upgradeChoices.length > 0) pickUpgrade(world, world.upgradeChoices[0]);
}

function runSteps(world, inputFn, seconds) {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i++) {
    if (world.screen === SCREEN_UPGRADE) {
      applyUpgradeChoice(world, UPGRADE_PRIORITY);
    }
    step(world, STEP, inputFn(world));
    if (world.screen === SCREEN_OVER || world.screen === SCREEN_WIN) break;
  }
}

export function stageShot(name, world) {
  if (name === 'start') {
    // Title demo: 5 s of the garden running behind the title screen.
    runSteps(world, () => ({ mx: 0, my: 0, aimX: 640, aimY: 360, pulse: false }), 5);
    return SCREEN_TITLE;
  }

  if (name === 'play') {
    startGame(world);
    runSteps(world, strongInput, 26);
    // If wave 2 happened to clear on the last step, pick the upgrade so
    // the captured screen is gameplay, not the upgrade interstitial.
    if (world.screen === SCREEN_UPGRADE) {
      applyUpgradeChoice(world, UPGRADE_PRIORITY);
      step(world, STEP, strongInput(world));
    }
    return world.screen;
  }

  if (name === 'end') {
    startGame(world);
    const cap = Math.round(600 / STEP);
    for (let i = 0; i < cap; i++) {
      if (world.screen === SCREEN_UPGRADE) applyUpgradeChoice(world, UPGRADE_PRIORITY);
      step(world, STEP, passiveInput(world));
      if (world.screen === SCREEN_OVER) break;
    }
    return world.screen;
  }

  if (name === 'win') {
    startGame(world);
    const cap = Math.round(900 / STEP);
    for (let i = 0; i < cap; i++) {
      if (world.screen === SCREEN_UPGRADE) applyUpgradeChoice(world, UPGRADE_PRIORITY);
      step(world, STEP, strongInput(world));
      if (world.screen === SCREEN_WIN || world.screen === SCREEN_OVER) break;
    }
    return world.screen;
  }

  throw new Error(`unknown shot: ${name}`);
}

export function createShotWorld(seed) {
  return createWorld(seed === undefined ? 1337 : seed, 0);
}
