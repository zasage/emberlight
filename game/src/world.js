// Emberlight — world simulation. DOM-free and deterministic: the only
// randomness is the seeded rng, the only clock is the dt passed in.
// Node-importable: world.js + shots.js are verified headlessly.
//
// Input shape consumed by step():
//   { mx, my, aimX, aimY, pulse } — movement vector, lantern aim
//   (logical 1280x720 coords), pulse held.
// Events produced per step in world.events (drained by main.js for audio):
//   EVENT_PICKUP, EVENT_PULSE, EVENT_HIT, EVENT_KILL, EVENT_WAVE,
//   EVENT_WIN, EVENT_LOSE, EVENT_UPGRADE.

import {
  FIELD_W,
  FIELD_H,
  PLAYER_SPEED,
  PLAYER_RADIUS,
  PLAYER_START_LIVES,
  LIGHT_RADIUS_BASE,
  LIGHT_RADIUS_MAX,
  LIGHT_DPS,
  EMBER_LIGHT_BONUS,
  PULSE_COOLDOWN,
  PULSE_RADIUS,
  PULSE_DAMAGE,
  PULSE_KNOCKBACK,
  PULSE_ACTIVE_TIME,
  INVULN_TIME,
  KNOCKBACK_ON_HIT,
  COMBO_WINDOW,
  COMBO_MAX,
  EMBER_SPAWN_INTERVAL,
  EMBER_MAX_ON_FIELD,
  EMBER_PICKUP_RADIUS,
  EMBER_MAGNET_RADIUS,
  EMBER_SCORE,
  EMBER_DROP_CHANCE,
  SCORE_KILL,
  WAVE_BONUS,
  WAVES,
  TOTAL_WAVES,
  ENEMY,
  SPITTER_SHOOT_INTERVAL,
  SPITTER_ORB_SPEED,
  SPITTER_KEEP_MIN,
  SPITTER_KEEP_MAX,
  ORB_RADIUS,
  ORB_LIFE,
} from './config.js';
import { makeRng, range, rangeInt, shuffle } from './random.js';
import { rollUpgrades, applyUpgrade } from './upgrades.js';

export const KIND_DRIFTER = 'drifter';
export const KIND_SKITTER = 'skitter';
export const KIND_SPITTER = 'spitter';
export const KIND_BRUTE = 'brute';

export const EVENT_PICKUP = 'pickup';
export const EVENT_PULSE = 'pulse';
export const EVENT_HIT = 'hit';
export const EVENT_KILL = 'kill';
export const EVENT_WAVE = 'wave';
export const EVENT_WIN = 'win';
export const EVENT_LOSE = 'lose';
export const EVENT_UPGRADE = 'upgrade';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const TAU = Math.PI * 2;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(seed = 1337, best = 0) {
  const rng = makeRng(seed);
  const world = {
    seed,
    rng,
    screen: SCREEN_TITLE,
    time: 0,
    score: 0,
    best,
    lives: PLAYER_START_LIVES,
    maxLives: PLAYER_START_LIVES,
    wave: 0,
    embers: 0,
    kills: 0,
    combo: 1,
    comboChain: 0,
    comboTimer: 0,
    lastKillTime: -99,
    player: {
      x: FIELD_W / 2,
      y: FIELD_H / 2,
      angle: -Math.PI / 2,
      invuln: 0,
      speedMult: 1,
    },
    lightMult: 1,
    lightBonus: 0, // +radius from collected embers
    speedMult: 1,
    pulseCooldownMax: PULSE_COOLDOWN,
    pulseCooldown: 0,
    pulseT: 0, // >0 while the pulse ring is expanding
    pickupRadius: EMBER_PICKUP_RADIUS,
    magnetRadius: EMBER_MAGNET_RADIUS,
    thorn: false,
    upgradesTaken: [],
    upgradeChoices: [],
    enemies: [],
    embersList: [],
    orbs: [],
    particles: [],
    texts: [],
    spawnQueue: [],
    spawnTimer: 0,
    spawnInterval: 1,
    waveSpeed: 1,
    emberTimer: 0,
    shake: 0,
    banner: null, // { text, sub, t, dur }
    events: [],
    prevPulse: false,
    demoWander: { x: FIELD_W / 2, y: FIELD_H / 2, t: 0 },
    stats: { timePlayed: 0, wavesCleared: 0 },
  };
  return world;
}

export function lightRadius(world) {
  return Math.min(
    LIGHT_RADIUS_MAX,
    LIGHT_RADIUS_BASE * world.lightMult + world.lightBonus,
  );
}

export function playerSpeed(world) {
  return PLAYER_SPEED * world.speedMult;
}

function resetRun(world) {
  world.score = 0;
  world.lives = PLAYER_START_LIVES;
  world.maxLives = PLAYER_START_LIVES;
  world.wave = 0;
  world.embers = 0;
  world.kills = 0;
  world.combo = 1;
  world.comboChain = 0;
  world.comboTimer = 0;
  world.lastKillTime = -99;
  world.player.x = FIELD_W / 2;
  world.player.y = FIELD_H / 2;
  world.player.angle = -Math.PI / 2;
  world.player.invuln = 0;
  world.lightMult = 1;
  world.lightBonus = 0;
  world.speedMult = 1;
  world.pulseCooldownMax = PULSE_COOLDOWN;
  world.pulseCooldown = 0;
  world.pulseT = 0;
  world.pickupRadius = EMBER_PICKUP_RADIUS;
  world.magnetRadius = EMBER_MAGNET_RADIUS;
  world.thorn = false;
  world.upgradesTaken = [];
  world.upgradeChoices = [];
  world.enemies = [];
  world.embersList = [];
  world.orbs = [];
  world.particles = [];
  world.texts = [];
  world.spawnQueue = [];
  world.shake = 0;
  world.banner = null;
  world.events = [];
  world.prevPulse = false;
  world.stats = { timePlayed: 0, wavesCleared: 0 };
}

export function startGame(world) {
  resetRun(world);
  world.screen = SCREEN_PLAY;
  startWave(world, 1);
}

export function startWave(world, n) {
  world.wave = n;
  const def = WAVES[n - 1];
  const queue = [];
  for (const kind of [KIND_DRIFTER, KIND_SKITTER, KIND_SPITTER, KIND_BRUTE]) {
    const count = def[kind] || 0;
    for (let i = 0; i < count; i++) queue.push(kind);
  }
  shuffle(world.rng, queue);
  world.spawnQueue = queue;
  world.spawnInterval = def.interval;
  world.waveSpeed = def.speed;
  world.spawnTimer = 0.8; // brief breather before the first shadow
  world.emberTimer = 1.0;
  setBanner(world, `WAVE ${n}`, n === TOTAL_WAVES ? 'The last wave — hold the light!' : 'The shadows are coming');
}

function setBanner(world, text, sub) {
  world.banner = { text, sub: sub || '', t: 0, dur: 2.2 };
}

// Spawn one enemy at a random field edge.
function spawnEnemy(world, kind) {
  const def = ENEMY[kind];
  const side = rangeInt(world.rng, 0, 3);
  let x;
  let y;
  const m = 30;
  if (side === 0) { x = range(world.rng, m, FIELD_W - m); y = m; }
  else if (side === 1) { x = range(world.rng, m, FIELD_W - m); y = FIELD_H - m; }
  else if (side === 2) { x = m; y = range(world.rng, m, FIELD_H - m); }
  else { x = FIELD_W - m; y = range(world.rng, m, FIELD_H - m); }
  world.enemies.push({
    kind,
    x,
    y,
    hp: def.hp,
    maxHp: def.hp,
    radius: def.radius,
    speed: def.speed * world.waveSpeed,
    shootTimer: range(world.rng, 1.2, 2.4),
    wobble: range(world.rng, 0, TAU),
    flash: 0,
    kx: 0,
    ky: 0, // knockback velocity, decays
  });
}

function spawnEmber(world, x, y) {
  world.embersList.push({
    x: x !== undefined ? x : range(world.rng, 60, FIELD_W - 60),
    y: y !== undefined ? y : range(world.rng, 60, FIELD_H - 60),
    t: range(world.rng, 0, TAU),
    life: 25,
  });
}

function burst(world, x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = range(world.rng, 0, TAU);
    const s = range(world.rng, speed * 0.3, speed);
    world.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      t: 0,
      life: range(world.rng, 0.3, 0.7),
      color,
      size: range(world.rng, 2, 4.5),
    });
  }
}

function addText(world, x, y, text, color) {
  world.texts.push({ x, y, text, color: color || '#f2ead8', t: 0, life: 1.0 });
}

function killEnemy(world, enemy, index) {
  const def = ENEMY[enemy.kind];
  // Combo: chain kills inside the window, multiplier caps at x5.
  if (world.time - world.lastKillTime <= COMBO_WINDOW) world.comboChain += 1;
  else world.comboChain = 1;
  world.lastKillTime = world.time;
  world.comboTimer = COMBO_WINDOW;
  world.combo = Math.min(COMBO_MAX, world.comboChain);
  const pts = SCORE_KILL[enemy.kind] * world.combo;
  world.score += pts;
  world.kills += 1;
  addText(world, enemy.x, enemy.y - 14, `+${pts}`, world.combo > 1 ? '#ffd76a' : '#f2ead8');
  burst(world, enemy.x, enemy.y, '#8f7bd8', enemy.kind === KIND_BRUTE ? 18 : 10, 160);
  burst(world, enemy.x, enemy.y, '#ffd76a', 4, 90);
  world.events.push(EVENT_KILL);
  // Brute splits into 2 drifters.
  if (enemy.kind === KIND_BRUTE) {
    for (let i = 0; i < 2; i++) {
      const a = range(world.rng, 0, TAU);
      world.enemies.push({
        kind: KIND_DRIFTER,
        x: enemy.x + Math.cos(a) * 24,
        y: enemy.y + Math.sin(a) * 24,
        hp: 1,
        maxHp: 1,
        radius: ENEMY.drifter.radius,
        speed: ENEMY.drifter.speed * world.waveSpeed,
        shootTimer: 0,
        wobble: range(world.rng, 0, TAU),
        flash: 0,
        kx: 0,
        ky: 0,
      });
    }
  } else if (world.rng() < EMBER_DROP_CHANCE) {
    spawnEmber(world, enemy.x, enemy.y);
  }
  world.enemies.splice(index, 1);
}

function damageEnemy(world, enemy, index, dmg) {
  enemy.hp -= dmg;
  enemy.flash = 0.12;
  if (enemy.hp <= 0) killEnemy(world, enemy, index);
}

function hurtPlayer(world, fromX, fromY) {
  if (world.player.invuln > 0) return;
  world.lives -= 1;
  world.player.invuln = INVULN_TIME;
  world.shake = 10;
  world.comboChain = 0;
  world.combo = 1;
  world.comboTimer = 0;
  // Knock the player away from the source of the hit.
  const dx = world.player.x - fromX;
  const dy = world.player.y - fromY;
  const d = Math.hypot(dx, dy) || 1;
  world.player.x += (dx / d) * 46;
  world.player.y += (dy / d) * 46;
  world.player.x = Math.max(24, Math.min(FIELD_W - 24, world.player.x));
  world.player.y = Math.max(24, Math.min(FIELD_H - 24, world.player.y));
  burst(world, world.player.x, world.player.y, '#ff5d73', 14, 200);
  world.events.push(EVENT_HIT);
  if (world.lives <= 0) {
    world.lives = 0;
    world.screen = SCREEN_OVER;
    if (world.score > world.best) world.best = world.score;
    world.events.push(EVENT_LOSE);
  }
}

function firePulse(world) {
  world.pulseCooldown = world.pulseCooldownMax;
  world.pulseT = PULSE_ACTIVE_TIME;
  world.shake = Math.max(world.shake, 4);
  world.events.push(EVENT_PULSE);
  const px = world.player.x;
  const py = world.player.y;
  const r = PULSE_RADIUS;
  // Damage + knockback shadows in range.
  for (let i = world.enemies.length - 1; i >= 0; i--) {
    const e = world.enemies[i];
    const d = Math.hypot(e.x - px, e.y - py);
    if (d < r + e.radius) {
      const ux = d > 0.01 ? (e.x - px) / d : 1;
      const uy = d > 0.01 ? (e.y - py) / d : 0;
      e.kx += ux * PULSE_KNOCKBACK;
      e.ky += uy * PULSE_KNOCKBACK;
      damageEnemy(world, e, i, PULSE_DAMAGE);
    }
  }
  // Pulse also clears dark orbs.
  for (let i = world.orbs.length - 1; i >= 0; i--) {
    const o = world.orbs[i];
    if (Math.hypot(o.x - px, o.y - py) < r) {
      burst(world, o.x, o.y, '#b9a7ff', 5, 90);
      world.orbs.splice(i, 1);
    }
  }
}

// --- Demo mode behind the title screen ---------------------------------
function stepDemo(world, dt) {
  const p = world.player;
  world.demoWander.t -= dt;
  if (world.demoWander.t <= 0) {
    world.demoWander.x = range(world.rng, 200, FIELD_W - 200);
    world.demoWander.y = range(world.rng, 160, FIELD_H - 160);
    world.demoWander.t = range(world.rng, 2, 4);
  }
  const dx = world.demoWander.x - p.x;
  const dy = world.demoWander.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d > 8) {
    p.x += (dx / d) * 120 * dt;
    p.y += (dy / d) * 120 * dt;
  }
  p.angle = Math.atan2(dy, dx);
  // Trickle in a few drifters to burn in the lantern light.
  world.spawnTimer -= dt;
  if (world.spawnTimer <= 0 && world.enemies.length < 5) {
    spawnEnemy(world, KIND_DRIFTER);
    world.spawnTimer = range(world.rng, 1.5, 3);
  }
  updateEnemies(world, dt, true);
  updateParticles(world, dt);
}

// --- Shared enemy update (demo + play) ---------------------------------
function updateEnemies(world, dt, demo) {
  const p = world.player;
  const lr = lightRadius(world);
  for (let i = world.enemies.length - 1; i >= 0; i--) {
    const e = world.enemies[i];
    if (e.flash > 0) e.flash -= dt;
    // Knockback decay.
    e.x += e.kx * dt;
    e.y += e.ky * dt;
    e.kx *= Math.pow(0.001, dt);
    e.ky *= Math.pow(0.001, dt);
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    if (e.kind === KIND_SPITTER) {
      if (!demo) {
        if (d > SPITTER_KEEP_MAX) { e.x += ux * e.speed * dt; e.y += uy * e.speed * dt; }
        else if (d < SPITTER_KEEP_MIN) { e.x -= ux * e.speed * dt; e.y -= uy * e.speed * dt; }
        else {
          // Strafe sideways while holding range.
          e.wobble += dt;
          e.x += -uy * Math.sin(e.wobble * 1.3) * e.speed * 0.5 * dt;
          e.y += ux * Math.sin(e.wobble * 1.3) * e.speed * 0.5 * dt;
        }
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && d < 560) {
          e.shootTimer = SPITTER_SHOOT_INTERVAL;
          world.orbs.push({
            x: e.x, y: e.y,
            vx: ux * SPITTER_ORB_SPEED,
            vy: uy * SPITTER_ORB_SPEED,
            t: 0, life: ORB_LIFE,
          });
        }
      } else {
        e.x += ux * e.speed * dt;
        e.y += uy * e.speed * dt;
      }
    } else {
      let mx = ux;
      let my = uy;
      if (e.kind === KIND_SKITTER) {
        e.wobble += dt * 3;
        const perp = Math.sin(e.wobble) * 0.35;
        mx = ux - uy * perp;
        my = uy + ux * perp;
        const m = Math.hypot(mx, my) || 1;
        mx /= m;
        my /= m;
      }
      e.x += mx * e.speed * dt;
      e.y += my * e.speed * dt;
    }
    e.x = Math.max(12, Math.min(FIELD_W - 12, e.x));
    e.y = Math.max(12, Math.min(FIELD_H - 12, e.y));
    // Lantern light burns shadows inside its radius.
    if (d < lr + e.radius) {
      const before = world.enemies.length;
      damageEnemy(world, e, i, LIGHT_DPS * dt);
      // If the shadow died to the light, skip the rest of its update.
      // (In demo mode the score/combo side effects are harmless: the
      // title screen never shows them and resetRun() zeroes them on start.)
      if (world.enemies.length !== before) continue;
    }
  }
  // Gentle separation so shadows don't stack exactly.
  const list = world.enemies;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      const min = a.radius + b.radius - 4;
      if (d2 > 0.01 && d2 < min * min) {
        const d = Math.sqrt(d2);
        const push = (min - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }
}

function updateParticles(world, dt) {
  for (let i = world.particles.length - 1; i >= 0; i--) {
    const pt = world.particles[i];
    pt.t += dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= Math.pow(0.01, dt);
    pt.vy *= Math.pow(0.01, dt);
    if (pt.t >= pt.life) world.particles.splice(i, 1);
  }
  for (let i = world.texts.length - 1; i >= 0; i--) {
    const t = world.texts[i];
    t.t += dt;
    t.y -= 28 * dt;
    if (t.t >= t.life) world.texts.splice(i, 1);
  }
  if (world.banner) {
    world.banner.t += dt;
    if (world.banner.t >= world.banner.dur) world.banner = null;
  }
  if (world.shake > 0) world.shake = Math.max(0, world.shake - 30 * dt);
}

// --- Main step ------------------------------------------------------------
export function step(world, dt, input) {
  world.events = [];
  world.time += dt;

  if (world.screen === SCREEN_TITLE) {
    stepDemo(world, dt);
    return;
  }
  if (world.screen !== SCREEN_PLAY) {
    // upgrade / pause / over / win: keep particles + banner alive.
    updateParticles(world, dt);
    return;
  }

  world.stats.timePlayed += dt;
  const p = world.player;
  const lr = lightRadius(world);

  // Combo decay.
  if (world.comboTimer > 0) {
    world.comboTimer -= dt;
    if (world.comboTimer <= 0) {
      world.comboChain = 0;
      world.combo = 1;
    }
  }
  if (p.invuln > 0) p.invuln -= dt;
  if (world.pulseCooldown > 0) world.pulseCooldown -= dt;
  if (world.pulseT > 0) world.pulseT -= dt;

  // Movement.
  const mx = input.mx || 0;
  const my = input.my || 0;
  const spd = playerSpeed(world);
  p.x = Math.max(24, Math.min(FIELD_W - 24, p.x + mx * spd * dt));
  p.y = Math.max(24, Math.min(FIELD_H - 24, p.y + my * spd * dt));
  if (input.aimX !== undefined && input.aimY !== undefined) {
    p.angle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
  }

  // Pulse on rising edge.
  const pulseNow = !!input.pulse;
  if (pulseNow && !world.prevPulse && world.pulseCooldown <= 0) {
    firePulse(world);
  }
  world.prevPulse = pulseNow;

  // Spawning.
  if (world.spawnQueue.length > 0) {
    world.spawnTimer -= dt;
    if (world.spawnTimer <= 0) {
      spawnEnemy(world, world.spawnQueue.shift());
      world.spawnTimer = world.spawnInterval;
    }
  }

  // Ember trickle.
  world.emberTimer -= dt;
  if (world.emberTimer <= 0 && world.embersList.length < EMBER_MAX_ON_FIELD) {
    spawnEmber(world);
    world.emberTimer = EMBER_SPAWN_INTERVAL;
  }

  // Enemies (move, shoot, burn in the light).
  updateEnemies(world, dt, false);
  if (world.screen !== SCREEN_PLAY) return; // died to... (safety; light can't kill player)

  // Orbs.
  for (let i = world.orbs.length - 1; i >= 0; i--) {
    const o = world.orbs[i];
    o.t += dt;
    o.x += o.vx * dt;
    o.y += o.vy * dt;
    if (o.t >= o.life || o.x < -20 || o.x > FIELD_W + 20 || o.y < -20 || o.y > FIELD_H + 20) {
      world.orbs.splice(i, 1);
      continue;
    }
    if (dist2(o.x, o.y, p.x, p.y) < (ORB_RADIUS + PLAYER_RADIUS) * (ORB_RADIUS + PLAYER_RADIUS)) {
      world.orbs.splice(i, 1);
      hurtPlayer(world, o.x - o.vx * 0.1, o.y - o.vy * 0.1);
      if (world.screen !== SCREEN_PLAY) return;
    }
  }

  // Enemy <-> player contact.
  for (let i = world.enemies.length - 1; i >= 0; i--) {
    const e = world.enemies[i];
    const rr = e.radius + PLAYER_RADIUS;
    if (dist2(e.x, e.y, p.x, p.y) < rr * rr) {
      // Thorn ring burns the shadow first — it may die before it hits.
      if (world.thorn) {
        damageEnemy(world, e, i, 1);
        if (world.enemies.indexOf(e) === -1) continue; // died to thorns
      }
      // Push the shadow back a little so it can't stick to the player.
      const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
      e.kx += ((e.x - p.x) / d) * 160;
      e.ky += ((e.y - p.y) / d) * 160;
      hurtPlayer(world, e.x, e.y);
      if (world.screen !== SCREEN_PLAY) return;
    }
  }

  // Embers: magnet drift + pickup.
  for (let i = world.embersList.length - 1; i >= 0; i--) {
    const em = world.embersList[i];
    em.t += dt;
    em.life -= dt;
    if (em.life <= 0) {
      world.embersList.splice(i, 1);
      continue;
    }
    const d = Math.hypot(p.x - em.x, p.y - em.y);
    if (d < world.magnetRadius && d > 1) {
      const pull = 260 * dt;
      em.x += ((p.x - em.x) / d) * pull;
      em.y += ((p.y - em.y) / d) * pull;
    }
    if (d < world.pickupRadius + 10) {
      world.embersList.splice(i, 1);
      world.embers += 1;
      world.score += EMBER_SCORE;
      world.lightBonus = Math.min(
        LIGHT_RADIUS_MAX - LIGHT_RADIUS_BASE * world.lightMult,
        world.lightBonus + EMBER_LIGHT_BONUS,
      );
      burst(world, em.x, em.y, '#ff8c2e', 8, 120);
      addText(world, em.x, em.y - 12, `+${EMBER_SCORE}`, '#ff8c2e');
      world.events.push(EVENT_PICKUP);
    }
  }

  updateParticles(world, dt);

  // Wave clear: queue empty and no shadows left.
  if (world.spawnQueue.length === 0 && world.enemies.length === 0) {
    world.stats.wavesCleared += 1;
    world.score += WAVE_BONUS * world.wave;
    if (world.wave >= TOTAL_WAVES) {
      world.screen = SCREEN_WIN;
      if (world.score > world.best) world.best = world.score;
      world.events.push(EVENT_WIN);
    } else {
      world.screen = SCREEN_UPGRADE;
      world.upgradeChoices = rollUpgrades(world.rng);
      world.events.push(EVENT_WAVE);
    }
  }
}

// Choose an upgrade on the upgrade screen, then start the next wave.
// Returns false if the id is not one of the offered choices.
export function pickUpgrade(world, id) {
  if (world.screen !== SCREEN_UPGRADE) return false;
  if (!world.upgradeChoices.includes(id)) return false;
  if (!applyUpgrade(world, id)) return false;
  world.upgradeChoices = [];
  world.events.push(EVENT_UPGRADE);
  startWave(world, world.wave + 1);
  world.screen = SCREEN_PLAY;
  return true;
}
