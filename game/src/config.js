// Garden Guard — shared numbers: the board, the winding path, the towers,
// the pests and the ten waves. Every other module reads from here so the
// whole game can be retuned by editing one file.

export const VIEW = { width: 960, height: 640 };
export const CELL = 40;
export const COLS = VIEW.width / CELL; // 24
export const ROWS = VIEW.height / CELL; // 16

export const START_NECTAR = 200;
export const START_LIVES = 20;
export const TOTAL_WAVES = 10;
export const SWARM_COOLDOWN = 25; // seconds between bee swarms
export const SWARM_BEES = 12;
export const SWARM_SECONDS = 7;
export const SELL_RATE = 0.7;

// The cream path winds in an S from the left edge to the garden gate on the
// right. Pests walk it waypoint by waypoint; towers may only stand on grass.
export const PATH_POINTS = [
  { x: -30, y: 120 },
  { x: 780, y: 120 },
  { x: 780, y: 320 },
  { x: 180, y: 320 },
  { x: 180, y: 520 },
  { x: 990, y: 520 },
];
export const PATH_HALF_WIDTH = 30;
export const GATE = { x: 930, y: 520 };

// Flower-towers. cost is nectar; rate is shots per second; splash is the
// radius the shot hurts around its target (0 = single pest); slow is the
// speed multiplier applied by lavender (1 = no slow).
export const TOWER_TYPES = {
  sunflower: {
    name: 'Sunflower', key: '1', cost: 50, damage: 7, rate: 2.4, range: 135,
    splash: 0, slow: 1, slowSeconds: 0, colour: '#f7b500',
    blurb: 'Fast, long reach',
  },
  rose: {
    name: 'Rose', key: '2', cost: 100, damage: 24, rate: 0.8, range: 115,
    splash: 58, slow: 1, slowSeconds: 0, colour: '#e75480',
    blurb: 'Splash damage',
  },
  lavender: {
    name: 'Lavender', key: '3', cost: 150, damage: 5, rate: 1.3, range: 125,
    splash: 0, slow: 0.5, slowSeconds: 1.4, colour: '#8b6fc0',
    blurb: 'Slows pests',
  },
};

// An upgrade multiplies damage and adds a little range. Level caps at 3.
export const UPGRADE = { damageMul: 1.6, rangeAdd: 16, maxLevel: 3 };

// Cross-pollination: towers of different types on orthogonally adjacent
// grass cells feed each other. A connected group holding at least two types
// is cross-pollinated; a group holding all three types is a Rainbow Bed.
export const POLLINATION = {
  crossDamageMul: 1.4, crossRangeMul: 1.15,
  rainbowDamageMul: 2.0, rainbowRangeMul: 1.25,
};
export function upgradeCost(type) {
  return Math.round(TOWER_TYPES[type].cost * 0.75);
}

// Pests. hp is the wave-1 value; waves scale it. reward is nectar on defeat.
export const ENEMY_TYPES = {
  aphid: { name: 'Aphid', hp: 22, speed: 58, reward: 6, radius: 11, colour: '#d9382b' },
  beetle: { name: 'Beetle', hp: 95, speed: 34, reward: 12, radius: 14, colour: '#5a3a1e' },
  snail: { name: 'Snail', hp: 280, speed: 19, reward: 26, radius: 16, colour: '#7a9a4d' },
  queen: { name: 'Queen Aphid', hp: 950, speed: 23, reward: 160, radius: 26, colour: '#b3122e' },
};
export const HP_SCALE_PER_WAVE = 0.13; // +13% hp each wave after the first

// What each wave sends. counts grow with the wave number; beetles join from
// wave 2, snails from wave 4, and the Queen Aphid closes wave 10.
export function wavePlan(wave) {
  const plan = [];
  const aphids = 5 + 3 * wave;
  for (let i = 0; i < aphids; i += 1) plan.push('aphid');
  if (wave >= 2) {
    const beetles = 2 + 2 * (wave - 1);
    for (let i = 0; i < beetles; i += 1) plan.push('beetle');
  }
  if (wave >= 4) {
    const snails = wave - 2;
    for (let i = 0; i < snails; i += 1) plan.push('snail');
  }
  if (wave === TOTAL_WAVES) plan.push('queen');
  // Shuffle the queue so the wave arrives mixed, queen last.
  const body = plan.slice(0, plan.length - (wave === TOTAL_WAVES ? 1 : 0));
  for (let i = body.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [body[i], body[j]] = [body[j], body[i]];
  }
  if (wave === TOTAL_WAVES) body.push('queen');
  return body;
}

export function waveClearBonus(wave) {
  return 30 + 15 * wave;
}

export function spawnGap(wave) {
  return Math.max(0.45, 0.95 - wave * 0.05);
}

// Warm golden-hour garden palette.
export const PALETTE = {
  skyTop: '#ffe9a8',
  lawnA: '#8fce62',
  lawnB: '#82c655',
  lawnDark: '#6fb344',
  path: '#f7e8c3',
  pathEdge: '#e8cf9a',
  fence: '#b07a45',
  gate: '#8a5a2b',
  soil: '#7a4a26',
  pot: '#c96f3f',
  potRim: '#a8542c',
  hudCream: '#fff8e6',
  ink: '#4a2f14',
};
