// Emberlight — boot + interactive loop.
// Shot mode (?shot=<scene>&seed=<n>): stage the scene deterministically,
// draw ONE frame, set window.__shotReady = true, no loop.
// Interactive mode: rAF loop with fixed 1/60 steps, letterboxed 1280x720.

import { FIELD_W, FIELD_H, STEP, BEST_KEY } from './config.js';
import {
  createWorld,
  startGame,
  step,
  pickUpgrade,
  SCREEN_TITLE,
  SCREEN_PLAY,
  SCREEN_UPGRADE,
  SCREEN_PAUSE,
  SCREEN_OVER,
  SCREEN_WIN,
  EVENT_PICKUP,
  EVENT_PULSE,
  EVENT_HIT,
  EVENT_KILL,
  EVENT_WAVE,
  EVENT_WIN,
  EVENT_LOSE,
  EVENT_UPGRADE,
} from './world.js';
import { draw, getUpgradeCardRects } from './render.js';
import {
  state as inputState,
  attachInput,
  moveVector,
  pulsePressed,
  consumeClick,
} from './input.js';
import {
  ensureAudio,
  toggleMute,
  playPickup,
  playPulse,
  playHit,
  playWaveHorn,
  playWin,
  playLose,
  playClick,
  playKill,
} from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusLine = document.getElementById('status');

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = parseInt(params.get('seed') || '1337', 10) || 1337;

let best = 0;
try {
  best = parseInt(window.localStorage.getItem(BEST_KEY) || '0', 10) || 0;
} catch (_e) {
  best = 0;
}

const world = createWorld(seed, best);

function saveBest() {
  try {
    window.localStorage.setItem(BEST_KEY, String(world.best));
  } catch (_e) {
    // Storage unavailable — best score just won't persist.
  }
}

function drainEvents() {
  for (const ev of world.events) {
    if (ev === EVENT_PICKUP) playPickup();
    else if (ev === EVENT_PULSE) playPulse();
    else if (ev === EVENT_HIT) playHit();
    else if (ev === EVENT_KILL) playKill();
    else if (ev === EVENT_WAVE) playWaveHorn();
    else if (ev === EVENT_WIN) { playWin(); saveBest(); }
    else if (ev === EVENT_LOSE) { playLose(); saveBest(); }
    else if (ev === EVENT_UPGRADE) playClick();
  }
}

function updateStatus() {
  if (!statusLine) return;
  const s = world.screen;
  if (s === SCREEN_PLAY) {
    statusLine.textContent =
      `Wave ${world.wave} of 8 — score ${world.score}, ${world.lives} lives, ${world.embers} embers.`;
  } else if (s === SCREEN_UPGRADE) {
    statusLine.textContent = `Wave ${world.wave} cleared — choose an upgrade.`;
  } else if (s === SCREEN_OVER) {
    statusLine.textContent = `Game over — score ${world.score}. Press Enter to play again.`;
  } else if (s === SCREEN_WIN) {
    statusLine.textContent = `Victory! Score ${world.score}. Press Enter to play again.`;
  } else if (s === SCREEN_PAUSE) {
    statusLine.textContent = 'Paused — press P to resume.';
  } else {
    statusLine.textContent = 'Emberlight — Keeper of the Last Lantern. Press Enter to start.';
  }
}

// --- Shot mode ------------------------------------------------------------
if (shotName) {
  const screen = stageShot(shotName, world);
  // Resize to the logical field for a clean 1280x720 capture.
  canvas.width = FIELD_W;
  canvas.height = FIELD_H;
  canvas.style.width = '1280px';
  canvas.style.height = '720px';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  draw(ctx, world, inputState, world.time);
  updateStatus();
  window.__shotReady = true;
  window.__shotScreen = screen;
} else {
  // --- Interactive mode ---------------------------------------------------
  attachInput(canvas, () => ensureAudio());

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
    const scale = Math.min(w / FIELD_W, h / FIELD_H);
    ctx.setTransform(scale, 0, 0, scale, (w - FIELD_W * scale) / 2, (h - FIELD_H * scale) / 2);
  }
  window.addEventListener('resize', resize);
  resize();

  // Edge-triggered keys: P pause, M mute, Enter start/restart.
  let prevP = false;
  let prevM = false;
  let prevEnter = false;

  function handleClick(click) {
    if (!click) return;
    ensureAudio();
    if (world.screen === SCREEN_TITLE) {
      playClick();
      startGame(world);
    } else if (world.screen === SCREEN_OVER || world.screen === SCREEN_WIN) {
      playClick();
      startGame(world);
    } else if (world.screen === SCREEN_UPGRADE) {
      const rects = getUpgradeCardRects();
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (
          click.x >= r.x && click.x <= r.x + r.w &&
          click.y >= r.y && click.y <= r.y + r.h &&
          world.upgradeChoices[i]
        ) {
          pickUpgrade(world, world.upgradeChoices[i]);
          break;
        }
      }
    }
  }

  let last = performance.now();
  let acc = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const dtMs = Math.min(100, now - last);
    last = now;

    // Edge-triggered keys.
    const pNow = inputState.keys.has('KeyP');
    if (pNow && !prevP) {
      if (world.screen === SCREEN_PLAY) world.screen = SCREEN_PAUSE;
      else if (world.screen === SCREEN_PAUSE) world.screen = SCREEN_PLAY;
    }
    prevP = pNow;
    const mNow = inputState.keys.has('KeyM');
    if (mNow && !prevM) toggleMute();
    prevM = mNow;
    const enterNow = inputState.keys.has('Enter');
    if (enterNow && !prevEnter) {
      ensureAudio();
      if (world.screen === SCREEN_TITLE) startGame(world);
      else if (world.screen === SCREEN_OVER || world.screen === SCREEN_WIN) startGame(world);
    }
    prevEnter = enterNow;

    handleClick(consumeClick());

    // Fixed-step simulation; wall clock only drives the loop.
    acc += dtMs / 1000;
    let guard = 0;
    while (acc >= STEP && guard < 5) {
      const mv = moveVector();
      step(world, STEP, {
        mx: mv.x,
        my: mv.y,
        aimX: inputState.mouseX,
        aimY: inputState.mouseY,
        pulse: pulsePressed(),
      });
      drainEvents();
      acc -= STEP;
      guard += 1;
    }
    if (guard >= 5) acc = 0; // drop backlog after a hitch

    draw(ctx, world, inputState, world.time);
    updateStatus();
  }
  requestAnimationFrame(frame);
}
