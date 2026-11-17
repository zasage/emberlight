// Upgrade pool: 6 upgrades, 3 rolled per wave clear, 1 chosen.
// Pure logic — no DOM, safe to import from Node.

export const UPGRADES = [
  {
    id: 'wider-light',
    name: 'Wider Light',
    desc: '+25% lantern light radius',
    icon: '☀',
  },
  {
    id: 'swift-pulse',
    name: 'Swift Pulse',
    desc: '-35% pulse cooldown',
    icon: '✦',
  },
  {
    id: 'swift-boots',
    name: 'Swift Boots',
    desc: '+15% movement speed',
    icon: '➤',
  },
  {
    id: 'ember-magnet',
    name: 'Ember Magnet',
    desc: '+90 ember pickup radius',
    icon: '🧲',
  },
  {
    id: 'extra-heart',
    name: 'Extra Heart',
    desc: '+1 life (max 5)',
    icon: '♥',
  },
  {
    id: 'thorn-ring',
    name: 'Thorn Ring',
    desc: 'Shadows that touch you take 1 damage',
    icon: '❋',
  },
];

export function getUpgrade(id) {
  return UPGRADES.find((u) => u.id === id) || null;
}

// Roll 3 distinct upgrades using the world's seeded rng.
export function rollUpgrades(rng) {
  const pool = UPGRADES.map((u) => u.id);
  // Fisher-Yates with seeded rng, take first 3.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  return pool.slice(0, 3);
}

export function applyUpgrade(world, id) {
  switch (id) {
    case 'wider-light':
      world.lightMult *= 1.25;
      break;
    case 'swift-pulse':
      world.pulseCooldownMax *= 0.65;
      break;
    case 'swift-boots':
      world.speedMult *= 1.15;
      break;
    case 'ember-magnet':
      world.pickupRadius += 90;
      world.magnetRadius += 90;
      break;
    case 'extra-heart':
      world.maxLives = Math.min(5, world.maxLives + 1);
      world.lives = Math.min(world.maxLives, world.lives + 1);
      break;
    case 'thorn-ring':
      world.thorn = true;
      break;
    default:
      return false;
  }
  world.upgradesTaken.push(id);
  return true;
}
