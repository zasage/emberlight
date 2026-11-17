// Emberlight — all canvas drawing. Pure function of (world, input, t):
// background, entities, darkness with a hole of light around the player,
// HUD, wave banner, and every screen (title / upgrade / pause / over / win).

import {
  FIELD_W,
  FIELD_H,
  PLAYER_RADIUS,
  ENEMY,
  ORB_RADIUS,
  PULSE_RADIUS,
  TOTAL_WAVES,
} from './config.js';
import { lightRadius, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_PAUSE, SCREEN_OVER, SCREEN_WIN } from './world.js';
import { getUpgrade } from './upgrades.js';

export { SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_PAUSE, SCREEN_OVER, SCREEN_WIN };
export const SCREEN_PLAY = 'play';

const TAU = Math.PI * 2;

// Offscreen canvas for the darkness overlay (rebuilt lazily).
let darkCanvas = null;
let darkCtx = null;

function getDarkCanvas() {
  if (!darkCanvas) {
    darkCanvas = document.createElement('canvas');
    darkCanvas.width = FIELD_W;
    darkCanvas.height = FIELD_H;
    darkCtx = darkCanvas.getContext('2d');
  }
  return darkCanvas;
}

// Layout shared with main.js for upgrade-card click detection.
export function getUpgradeCardRects() {
  const w = 300;
  const h = 190;
  const gap = 30;
  const total = w * 3 + gap * 2;
  const x0 = (FIELD_W - total) / 2;
  const y = 250;
  return [0, 1, 2].map((i) => ({ x: x0 + i * (w + gap), y, w, h }));
}

function drawHeart(ctx, x, y, size, filled) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 16, size / 16);
  ctx.beginPath();
  ctx.moveTo(0, 5);
  ctx.bezierCurveTo(-8, -3, -4, -9, 0, -4);
  ctx.bezierCurveTo(4, -9, 8, -3, 0, 5);
  ctx.closePath();
  ctx.fillStyle = filled ? '#ff5d73' : 'rgba(255,93,115,0.25)';
  ctx.fill();
  ctx.restore();
}

function drawBackground(ctx, t) {
  const g = ctx.createRadialGradient(
    FIELD_W / 2, FIELD_H / 2, 80,
    FIELD_W / 2, FIELD_H / 2, 900,
  );
  g.addColorStop(0, '#141a3a');
  g.addColorStop(1, '#07081a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);

  // Faint garden paths / tiles.
  ctx.strokeStyle = 'rgba(58,68,112,0.35)';
  ctx.lineWidth = 1;
  for (let x = 80; x < FIELD_W; x += 160) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, FIELD_H);
    ctx.stroke();
  }
  for (let y = 80; y < FIELD_H; y += 160) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(FIELD_W, y);
    ctx.stroke();
  }
  // A few still bushes (dark blobs with a rim).
  const bushes = [
    [90, 90, 46], [1190, 80, 54], [80, 640, 58], [1200, 630, 48],
    [420, 60, 34], [880, 670, 40], [640, 40, 26],
  ];
  for (const [bx, by, br] of bushes) {
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, TAU);
    ctx.fillStyle = '#10152e';
    ctx.fill();
    ctx.strokeStyle = 'rgba(70,90,60,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // Fireflies drifting far from the lantern (purely cosmetic, from t).
  ctx.fillStyle = 'rgba(255,215,106,0.5)';
  for (let i = 0; i < 14; i++) {
    const fx = (i * 173 + Math.sin(t * 0.3 + i * 2.1) * 40 + 140) % FIELD_W;
    const fy = (i * 97 + Math.cos(t * 0.22 + i * 1.7) * 30 + 90) % FIELD_H;
    ctx.globalAlpha = 0.25 + 0.25 * Math.sin(t * 1.5 + i);
    ctx.beginPath();
    ctx.arc(fx, fy, 2, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawEmber(ctx, em, t) {
  const pulse = 1 + 0.18 * Math.sin(t * 5 + em.t);
  const r = 9 * pulse;
  const g = ctx.createRadialGradient(em.x, em.y, 1, em.x, em.y, r * 2.2);
  g.addColorStop(0, '#ffd23e');
  g.addColorStop(0.4, '#ff8c2e');
  g.addColorStop(1, 'rgba(255,140,46,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(em.x, em.y, r * 2.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.arc(em.x, em.y, r * 0.55, 0, TAU);
  ctx.fill();
}

function drawEnemy(ctx, e, t) {
  const def = ENEMY[e.kind];
  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.flash > 0) {
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(e.flash * 60);
  }
  // Wobbly shadow body.
  const wob = e.kind === 'skitter' ? Math.sin(t * 9 + e.wobble) * 2 : Math.sin(t * 3 + e.wobble) * 1.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, e.radius + wob * 0.3, e.radius * 0.92, 0, 0, TAU);
  ctx.fillStyle = def.color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(143,123,216,0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Eyes: two glowing dots facing the player is overkill; face up-left.
  const ex = e.radius * 0.38;
  const ey = -e.radius * 0.18;
  ctx.fillStyle = def.eye;
  ctx.beginPath();
  ctx.arc(-ex, ey, 3, 0, TAU);
  ctx.arc(ex, ey, 3, 0, TAU);
  ctx.fill();
  if (e.kind === 'brute') {
    // Heavy brow + spikes.
    ctx.strokeStyle = '#1a1230';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-ex - 4, ey - 6);
    ctx.lineTo(-ex + 4, ey - 3);
    ctx.moveTo(ex + 4, ey - 6);
    ctx.lineTo(ex - 4, ey - 3);
    ctx.stroke();
  }
  if (e.kind === 'spitter') {
    ctx.fillStyle = 'rgba(255,122,217,0.5)';
    ctx.beginPath();
    ctx.arc(0, e.radius * 0.45, 4, 0, TAU);
    ctx.fill();
  }
  // HP pips for tough shadows.
  if (e.maxHp > 1) {
    ctx.fillStyle = 'rgba(242,234,216,0.8)';
    for (let i = 0; i < e.maxHp; i++) {
      ctx.beginPath();
      ctx.arc((i - (e.maxHp - 1) / 2) * 9, -e.radius - 10, i < Math.ceil(e.hp) ? 2.6 : 1.6, 0, TAU);
      ctx.fillStyle = i < Math.ceil(e.hp) ? '#ff8c2e' : 'rgba(242,234,216,0.35)';
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawPlayer(ctx, world, t) {
  const p = world.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  // Blink while invulnerable.
  if (p.invuln > 0 && Math.floor(t * 12) % 2 === 0) ctx.globalAlpha = 0.45;
  // Cloak.
  ctx.beginPath();
  ctx.ellipse(0, 2, PLAYER_RADIUS, PLAYER_RADIUS * 1.05, 0, 0, TAU);
  ctx.fillStyle = '#2c3a6e';
  ctx.fill();
  ctx.strokeStyle = '#4a5da0';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Lantern held in the aim direction.
  const lx = Math.cos(p.angle) * 24;
  const ly = Math.sin(p.angle) * 24;
  ctx.strokeStyle = '#8a6d2f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(lx, ly);
  ctx.stroke();
  const lg = ctx.createRadialGradient(lx, ly, 1, lx, ly, 20);
  lg.addColorStop(0, '#fff3c4');
  lg.addColorStop(0.5, '#ffd76a');
  lg.addColorStop(1, 'rgba(255,180,60,0)');
  ctx.fillStyle = lg;
  ctx.beginPath();
  ctx.arc(lx, ly, 20, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#3a2c10';
  ctx.beginPath();
  ctx.arc(lx, ly, 6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(lx, ly, 3.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawOrbs(ctx, world) {
  for (const o of world.orbs) {
    const g = ctx.createRadialGradient(o.x, o.y, 1, o.x, o.y, ORB_RADIUS * 2);
    g.addColorStop(0, '#e6dcff');
    g.addColorStop(0.45, '#8f7bd8');
    g.addColorStop(1, 'rgba(80,50,160,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(o.x, o.y, ORB_RADIUS * 2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#2a1a55';
    ctx.beginPath();
    ctx.arc(o.x, o.y, ORB_RADIUS * 0.6, 0, TAU);
    ctx.fill();
  }
}

function drawParticles(ctx, world) {
  for (const pt of world.particles) {
    ctx.globalAlpha = Math.max(0, 1 - pt.t / pt.life);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const tx of world.texts) {
    ctx.globalAlpha = Math.max(0, 1 - tx.t / tx.life);
    ctx.fillStyle = tx.color;
    ctx.fillText(tx.text, tx.x, tx.y);
  }
  ctx.globalAlpha = 1;
}

function drawPulseRing(ctx, world) {
  if (world.pulseT <= 0) return;
  const prog = 1 - world.pulseT / 0.28;
  const r = PULSE_RADIUS * (0.25 + 0.75 * prog);
  ctx.save();
  ctx.globalAlpha = (1 - prog) * 0.8;
  ctx.strokeStyle = '#ffd76a';
  ctx.lineWidth = 6 * (1 - prog) + 2;
  ctx.beginPath();
  ctx.arc(world.player.x, world.player.y, r, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = (1 - prog) * 0.25;
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath();
  ctx.arc(world.player.x, world.player.y, r, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// Darkness overlay: near-black everywhere except a soft hole of light
// around the player (radius = lantern light radius).
function drawDarkness(ctx, world) {
  const dc = getDarkCanvas();
  const dctx = darkCtx;
  dctx.clearRect(0, 0, FIELD_W, FIELD_H);
  dctx.fillStyle = 'rgba(5,6,20,0.86)';
  dctx.fillRect(0, 0, FIELD_W, FIELD_H);
  dctx.globalCompositeOperation = 'destination-out';
  const lr = lightRadius(world);
  const p = world.player;
  const g = dctx.createRadialGradient(p.x, p.y, lr * 0.25, p.x, p.y, lr);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.7, 'rgba(0,0,0,0.85)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  dctx.fillStyle = g;
  dctx.beginPath();
  dctx.arc(p.x, p.y, lr, 0, TAU);
  dctx.fill();
  dctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(dc, 0, 0);
}

function drawHUD(ctx, world) {
  ctx.save();
  ctx.textBaseline = 'top';
  // Top bar background.
  ctx.fillStyle = 'rgba(7,8,26,0.55)';
  ctx.fillRect(0, 0, FIELD_W, 44);
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.fillStyle = '#f2ead8';
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE ${world.score}`, 16, 12);
  ctx.fillStyle = '#9a93b8';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText(`BEST ${world.best}`, 190, 15);
  ctx.fillStyle = '#f2ead8';
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`WAVE ${Math.max(1, world.wave)} / ${TOTAL_WAVES}`, FIELD_W / 2, 12);
  // Hearts.
  for (let i = 0; i < world.maxLives; i++) {
    drawHeart(ctx, FIELD_W / 2 + 110 + i * 26, 22, 15, i < world.lives);
  }
  // Right side: embers + combo + pulse cooldown.
  ctx.textAlign = 'right';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillStyle = '#ff8c2e';
  ctx.fillText(`● ${world.embers} embers`, FIELD_W - 16, 12);
  if (world.combo > 1) {
    ctx.fillStyle = '#ffd76a';
    ctx.fillText(`COMBO x${world.combo}`, FIELD_W - 16, 30);
  }
  // Pulse cooldown bar (bottom centre).
  const frac = world.pulseCooldownMax > 0
    ? 1 - Math.max(0, world.pulseCooldown) / world.pulseCooldownMax
    : 1;
  const bw = 160;
  const bx = (FIELD_W - bw) / 2;
  const by = FIELD_H - 26;
  ctx.fillStyle = 'rgba(7,8,26,0.6)';
  ctx.fillRect(bx - 4, by - 4, bw + 8, 16);
  ctx.fillStyle = frac >= 1 ? '#ffd76a' : '#3a4470';
  ctx.fillRect(bx, by, bw * frac, 8);
  ctx.fillStyle = '#9a93b8';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(frac >= 1 ? 'PULSE READY — click / Space' : 'pulse recharging…', FIELD_W / 2, by + 12);
  ctx.restore();
}

function drawBanner(ctx, world) {
  if (!world.banner) return;
  const b = world.banner;
  const a = b.t < 0.2 ? b.t / 0.2 : b.t > b.dur - 0.4 ? Math.max(0, (b.dur - b.t) / 0.4) : 1;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 54px system-ui, sans-serif';
  ctx.fillText(b.text, FIELD_W / 2, 150);
  if (b.sub) {
    ctx.fillStyle = '#f2ead8';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText(b.sub, FIELD_W / 2, 215);
  }
  ctx.restore();
}

function dimScreen(ctx, alpha) {
  ctx.fillStyle = `rgba(5,6,20,${alpha})`;
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);
}

function drawTitle(ctx, world, t) {
  dimScreen(ctx, 0.45);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 64px Georgia, serif';
  ctx.fillText('EMBERLIGHT', FIELD_W / 2, 150);
  ctx.fillStyle = '#f2ead8';
  ctx.font = 'italic 26px Georgia, serif';
  ctx.fillText('Keeper of the Last Lantern', FIELD_W / 2, 205);
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillStyle = '#cfc8e8';
  const lines = [
    'WASD / arrows — move      Mouse — aim the lantern      Click / Space — pulse of light',
    'Your lantern burns shadows inside its glow. Gather fallen embers to grow the light.',
    'Survive all 8 waves. You have 3 lives. After each wave, choose 1 of 3 upgrades.',
    'P — pause      M — mute',
  ];
  lines.forEach((ln, i) => ctx.fillText(ln, FIELD_W / 2, 270 + i * 28));
  ctx.fillStyle = '#9a93b8';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(`BEST SCORE  ${world.best}`, FIELD_W / 2, 420);
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 24px system-ui, sans-serif';
  const blink = 0.7 + 0.3 * Math.sin(t * 3);
  ctx.globalAlpha = blink;
  ctx.fillText('Click or press Enter to start', FIELD_W / 2, 470);
  ctx.restore();
}

function drawUpgrade(ctx, world) {
  dimScreen(ctx, 0.72);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillText(`WAVE ${world.wave} CLEARED!`, FIELD_W / 2, 120);
  ctx.fillStyle = '#f2ead8';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('Choose one upgrade', FIELD_W / 2, 175);
  const rects = getUpgradeCardRects();
  world.upgradeChoices.forEach((id, i) => {
    const u = getUpgrade(id);
    if (!u) return;
    const r = rects[i];
    ctx.fillStyle = '#1c2140';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = '#3a4470';
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = '#ffd76a';
    ctx.font = '44px system-ui, sans-serif';
    ctx.fillText(u.icon, r.x + r.w / 2, r.y + 30);
    ctx.fillStyle = '#f2ead8';
    ctx.font = 'bold 21px system-ui, sans-serif';
    ctx.fillText(u.name, r.x + r.w / 2, r.y + 92);
    ctx.fillStyle = '#9a93b8';
    ctx.font = '15px system-ui, sans-serif';
    wrapText(ctx, u.desc, r.x + r.w / 2, r.y + 126, r.w - 32, 20);
  });
  ctx.fillStyle = '#9a93b8';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Click a card to continue', FIELD_W / 2, 480);
  ctx.restore();
}

function wrapText(ctx, text, cx, y, maxW, lh) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  lines.forEach((ln, i) => ctx.fillText(ln, cx, y + i * lh));
}

function drawPause(ctx) {
  dimScreen(ctx, 0.6);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2ead8';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('PAUSED', FIELD_W / 2, 300);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillStyle = '#9a93b8';
  ctx.fillText('Press P to resume', FIELD_W / 2, 360);
  ctx.restore();
}

function drawEndScreen(ctx, world, won) {
  dimScreen(ctx, 0.7);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = won ? '#ffd76a' : '#ff5d73';
  ctx.font = 'bold 52px Georgia, serif';
  ctx.fillText(won ? 'THE DAWN RETURNS' : 'THE LIGHT GOES OUT', FIELD_W / 2, 170);
  ctx.fillStyle = '#f2ead8';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(
    won
      ? 'Eight waves survived — the garden glows again.'
      : 'The shadows close in… but the lantern can be relit.',
    FIELD_W / 2, 225,
  );
  ctx.font = 'bold 22px system-ui, sans-serif';
  const rows = [
    `SCORE  ${world.score}`,
    `BEST  ${world.best}`,
    `WAVE REACHED  ${world.wave} / ${TOTAL_WAVES}`,
    `SHADOWS BURNED  ${world.kills}`,
    `EMBERS GATHERED  ${world.embers}`,
    `TIME  ${formatTime(world.stats.timePlayed)}`,
  ];
  rows.forEach((row, i) => ctx.fillText(row, FIELD_W / 2, 290 + i * 34));
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText('Click or press Enter — Play again', FIELD_W / 2, 540);
  ctx.restore();
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function draw(ctx, world, input, t) {
  ctx.save();
  // Screen shake: deterministic wobble from t, scaled by world.shake.
  if (world.shake > 0.1) {
    const s = world.shake;
    ctx.translate(
      Math.sin(t * 71) * s * 0.5,
      Math.cos(t * 89) * s * 0.5,
    );
  }
  drawBackground(ctx, t);
  for (const em of world.embersList) drawEmber(ctx, em, t);
  for (const e of world.enemies) drawEnemy(ctx, e, t);
  drawOrbs(ctx, world);
  drawPlayer(ctx, world, t);
  drawParticles(ctx, world);
  drawPulseRing(ctx, world);
  // The lantern's glow is part of the world; darkness sits above it.
  if (world.screen !== SCREEN_TITLE) drawDarkness(ctx, world);
  else {
    // Title: softer darkness so the demo garden reads through.
    ctx.save();
    ctx.globalAlpha = 0.35;
    drawDarkness(ctx, world);
    ctx.restore();
  }
  if (world.screen === SCREEN_PLAY || world.screen === SCREEN_PAUSE || world.screen === SCREEN_UPGRADE) {
    drawHUD(ctx, world);
  }
  drawBanner(ctx, world);

  if (world.screen === SCREEN_TITLE) drawTitle(ctx, world, t);
  else if (world.screen === SCREEN_UPGRADE) drawUpgrade(ctx, world);
  else if (world.screen === SCREEN_PAUSE) drawPause(ctx);
  else if (world.screen === SCREEN_OVER) drawEndScreen(ctx, world, false);
  else if (world.screen === SCREEN_WIN) drawEndScreen(ctx, world, true);
  ctx.restore();
}
