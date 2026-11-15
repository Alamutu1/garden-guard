// Garden Guard — the simulation. One world object holds every tower, pest,
// projectile, bee and particle; step() advances it in fixed 1/60 s slices
// so a slow frame never changes the outcome. Nothing here touches the DOM
// or the canvas: rendering and input live in their own modules.

import {
  CELL, COLS, ROWS, ENEMY_TYPES, GATE, HP_SCALE_PER_WAVE, PATH_HALF_WIDTH,
  PATH_POINTS, POLLINATION, SELL_RATE, START_LIVES, START_NECTAR, SWARM_BEES,
  SWARM_COOLDOWN, SWARM_SECONDS, TOTAL_WAVES, TOWER_TYPES, UPGRADE,
  spawnGap, waveClearBonus, wavePlan,
} from './config.js';
import { sfx } from './audio.js';

export const STEP = 1 / 60;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** True when the centre of grid cell (col, row) lies on the cream path. */
export function cellIsPath(col, row) {
  const x = col * CELL + CELL / 2, y = row * CELL + CELL / 2;
  for (let i = 0; i < PATH_POINTS.length - 1; i += 1) {
    const a = PATH_POINTS[i], b = PATH_POINTS[i + 1];
    if (distToSegment(x, y, a.x, a.y, b.x, b.y) < PATH_HALF_WIDTH + CELL / 2 - 6) return true;
  }
  return false;
}

export function towerAt(world, col, row) {
  return world.towers.find((t) => t.col === col && t.row === row) || null;
}

export function towerStats(tower) {
  const base = TOWER_TYPES[tower.type];
  const mul = Math.pow(UPGRADE.damageMul, tower.level - 1);
  let damage = base.damage * mul;
  let range = base.range + UPGRADE.rangeAdd * (tower.level - 1);
  // Cross-pollination feeds the whole bed: the bonus comes from the
  // tower's group only, never per pair, so it never stacks.
  if (tower.pollination === 'cross') {
    damage *= POLLINATION.crossDamageMul;
    range *= POLLINATION.crossRangeMul;
  } else if (tower.pollination === 'rainbow') {
    damage *= POLLINATION.rainbowDamageMul;
    range *= POLLINATION.rainbowRangeMul;
  }
  return {
    damage: Math.round(damage),
    range: Math.round(range),
    rate: base.rate,
  };
}

// Connected groups of orthogonally adjacent towers, found by flood fill.
// Each group reports its kind: 'none' (one type only), 'cross' (two
// types) or 'rainbow' (all three). Links join each pair of neighbours.
export function computePollination(world) {
  const seen = new Set();
  const groups = [];
  const links = [];
  for (const tower of world.towers) {
    if (seen.has(tower)) continue;
    const group = [];
    const queue = [tower];
    seen.add(tower);
    while (queue.length > 0) {
      const t = queue.pop();
      group.push(t);
      for (const other of world.towers) {
        if (seen.has(other)) continue;
        if (Math.abs(other.col - t.col) + Math.abs(other.row - t.row) === 1) {
          seen.add(other);
          queue.push(other);
          links.push({ a: t, b: other });
        }
      }
    }
    const types = new Set(group.map((t) => t.type));
    const kind = types.size >= 3 ? 'rainbow' : types.size === 2 ? 'cross' : 'none';
    groups.push({ towers: group, kind });
  }
  return { groups, links };
}

// Recompute every tower's pollination bonus from the current garden and
// refresh the golden links the renderer draws. A tower that gains a boost
// for the first time chimes (cross) or plays a bright arpeggio (Rainbow
// Bed) and floats a little announcement over the bed — at most one sound
// per change, so growing an existing bed stays quiet.
export function recomputePollination(world) {
  const { groups, links } = computePollination(world);
  const kindOf = new Map();
  for (const group of groups) {
    for (const tower of group.towers) kindOf.set(tower, group.kind);
  }
  let crossAt = null;
  let rainbowAt = null;
  for (const tower of world.towers) {
    const before = tower.pollination || 'none';
    const after = kindOf.get(tower) || 'none';
    tower.pollination = after;
    if (before !== after && after !== 'none') {
      if (after === 'rainbow') rainbowAt = rainbowAt || { x: tower.x, y: tower.y };
      else if (before === 'none') crossAt = crossAt || { x: tower.x, y: tower.y };
    }
  }
  // Only pairs of different flowers get a golden link: a link marks two
  // neighbours whose kinds mix, which is what earns the bonus. Same-type
  // neighbours show no link and no motes, even inside a mixed bed.
  world.pollenLinks = links
    .filter(({ a, b }) => a.type !== b.type)
    .map(({ a, b }) => ({
      x1: a.x, y1: a.y, x2: b.x, y2: b.y,
      rainbow: kindOf.get(a) === 'rainbow',
    }));
  if (rainbowAt) {
    addFloat(world, rainbowAt.x, rainbowAt.y - 34, '🌈 Rainbow Bed!', '#e8a100');
    sfx.rainbow();
  } else if (crossAt) {
    addFloat(world, crossAt.x, crossAt.y - 34, '🌼 Cross-pollination!', '#e8a100');
    sfx.cross();
  }
}

export function createWorld(seed) {
  return {
    seed,
    random: mulberry32(seed),
    screen: 'title', // title | playing | paused | won | lost
    time: 0,
    nectar: START_NECTAR,
    lives: START_LIVES,
    wave: 0,
    wavesCleared: 0,
    waveLeaks: 0, // pests that reached the gate during the current wave
    kills: 0,
    score: 0,
    waveActive: false,
    spawnQueue: [],
    spawnTimer: 0,
    enemies: [],
    towers: [],
    projectiles: [],
    particles: [],
    floats: [],
    bees: [],
    swarmActive: 0,
    swarmCooldown: 0,
    pollenLinks: [], // golden links between cross-pollinated neighbours
    shake: 0,
    banner: null, // { text, sub, until }
    placing: null, // tower type the player is about to place, or null
    selected: null, // tower object selected for upgrade/sell, or null
    hover: null, // { col, row } cell under the mouse, or null
    muted: false,
    message: null, // short hint line, e.g. "Not enough nectar"
    messageUntil: 0,
  };
}

export function resetWorld(world) {
  const fresh = createWorld(world.seed);
  fresh.muted = world.muted;
  Object.keys(fresh).forEach((k) => { world[k] = fresh[k]; });
  world.random = mulberry32(world.seed);
}

function showBanner(world, text, sub, seconds = 2.2) {
  world.banner = { text, sub, until: world.time + seconds };
}

function showMessage(world, text) {
  world.message = text;
  world.messageUntil = world.time + 2;
}

function addFloat(world, x, y, text, colour) {
  world.floats.push({ x, y, text, colour, life: 1.1, max: 1.1 });
}

function burst(world, x, y, colour, count, speed = 90) {
  for (let i = 0; i < count; i += 1) {
    const a = world.random() * Math.PI * 2;
    const v = speed * (0.4 + world.random() * 0.8);
    world.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30,
      life: 0.45 + world.random() * 0.35, max: 0.8, colour,
      size: 2 + world.random() * 3,
    });
  }
}

function spawnEnemy(world, kind) {
  const def = ENEMY_TYPES[kind];
  const hpScale = 1 + HP_SCALE_PER_WAVE * (world.wave - 1);
  const hp = Math.round(def.hp * hpScale);
  world.enemies.push({
    kind, x: PATH_POINTS[0].x, y: PATH_POINTS[0].y, wp: 1,
    dist: 0, hp, maxHp: hp, speed: def.speed, radius: def.radius,
    reward: def.reward, slowUntil: 0, slowFactor: 1,
    wobble: world.random() * Math.PI * 2,
  });
}

export function startWave(world) {
  if (world.screen !== 'playing' || world.waveActive) return false;
  if (world.wave >= TOTAL_WAVES) return false;
  world.wave += 1;
  world.waveLeaks = 0;
  // Starting a wave dismisses the selected-tower panel: it sits over the
  // bottom-right garden, and a click aimed at a cell under it would hit
  // its Upgrade/Sell buttons instead of the garden.
  world.selected = null;
  world.spawnQueue = wavePlan(world.wave);
  world.spawnTimer = 0.4;
  world.waveActive = true;
  showBanner(world, `Wave ${world.wave}`, world.wave === TOTAL_WAVES ? 'The Queen Aphid approaches!' : 'Hold the garden!');
  sfx.waveStart();
  return true;
}

export function placeTower(world, type, col, row) {
  if (world.screen !== 'playing') return false;
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
  if (cellIsPath(col, row) || towerAt(world, col, row)) {
    showMessage(world, 'Flowers only grow on grass!');
    sfx.denied();
    return false;
  }
  const cost = TOWER_TYPES[type].cost;
  if (world.nectar < cost) {
    showMessage(world, 'Not enough nectar!');
    sfx.denied();
    return false;
  }
  world.nectar -= cost;
  world.towers.push({
    type, col, row, x: col * CELL + CELL / 2, y: row * CELL + CELL / 2,
    level: 1, invested: cost, cooldown: 0, angle: -Math.PI / 2, bloom: 0,
    pollination: 'none',
  });
  recomputePollination(world);
  burst(world, col * CELL + CELL / 2, row * CELL + CELL / 2, '#ffd94d', 10, 70);
  sfx.plant();
  return true;
}

export function upgradeTower(world, tower) {
  if (tower.level >= UPGRADE.maxLevel) {
    showMessage(world, 'Already at full bloom!');
    return false;
  }
  const cost = Math.round(TOWER_TYPES[tower.type].cost * 0.75);
  if (world.nectar < cost) {
    showMessage(world, 'Not enough nectar!');
    sfx.denied();
    return false;
  }
  world.nectar -= cost;
  tower.invested += cost;
  tower.level += 1;
  recomputePollination(world);
  burst(world, tower.x, tower.y, '#fff3a0', 14, 100);
  sfx.coin();
  return true;
}

export function sellTower(world, tower) {
  const refund = Math.floor(tower.invested * SELL_RATE);
  world.nectar += refund;
  world.towers = world.towers.filter((t) => t !== tower);
  if (world.selected === tower) world.selected = null;
  recomputePollination(world);
  addFloat(world, tower.x, tower.y - 10, `+${refund}`, '#e8a100');
  sfx.coin();
  return refund;
}

export function triggerSwarm(world) {
  if (world.screen !== 'playing') return false;
  if (world.swarmCooldown > 0) {
    showMessage(world, 'The bees are resting…');
    return false;
  }
  if (world.enemies.length === 0) {
    showMessage(world, 'No pests to chase yet!');
    return false;
  }
  world.swarmCooldown = SWARM_COOLDOWN;
  world.swarmActive = SWARM_SECONDS;
  for (let i = 0; i < SWARM_BEES; i += 1) {
    world.bees.push({
      x: 60 + world.random() * 120, y: 560 + world.random() * 50,
      target: null, stingCd: world.random() * 0.4, life: SWARM_SECONDS,
      wobble: world.random() * Math.PI * 2,
    });
  }
  showBanner(world, 'Bee Swarm!', 'The hive answers the call', 1.6);
  sfx.swarm();
  return true;
}

function damageEnemy(world, enemy, amount, slow, slowSeconds) {
  enemy.hp -= amount;
  if (slow < 1) {
    enemy.slowFactor = slow;
    enemy.slowUntil = world.time + slowSeconds;
  }
  if (enemy.hp <= 0 && !enemy.dead) {
    enemy.dead = true;
    world.kills += 1;
    world.nectar += enemy.reward;
    world.score += 10;
    addFloat(world, enemy.x, enemy.y - 14, `+${enemy.reward}`, '#e8a100');
    burst(world, enemy.x, enemy.y, ENEMY_TYPES[enemy.kind].colour, 12, 110);
    burst(world, enemy.x, enemy.y, '#ffd94d', 6, 80);
    sfx.pop();
    sfx.coin();
  }
}

function fireTower(world, tower) {
  const stats = towerStats(tower);
  let best = null;
  for (const e of world.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - tower.x, e.y - tower.y);
    if (d <= stats.range && (!best || e.dist > best.dist)) best = e;
  }
  if (!best) return;
  tower.angle = Math.atan2(best.y - tower.y, best.x - tower.x);
  tower.bloom = 0.12;
  const base = TOWER_TYPES[tower.type];
  world.projectiles.push({
    x: tower.x, y: tower.y - 6, target: best, speed: 340,
    damage: stats.damage, kind: tower.type, splash: base.splash,
    slow: base.slow, slowSeconds: base.slowSeconds,
  });
  sfx.shoot(tower.type);
}

function stepProjectiles(world, dt) {
  for (const p of world.projectiles) {
    if (p.target.dead) { p.spent = true; continue; }
    const dx = p.target.x - p.x, dy = p.target.y - p.y;
    const d = Math.hypot(dx, dy);
    const move = p.speed * dt;
    if (d <= move + p.target.radius * 0.5) {
      p.spent = true;
      if (p.splash > 0) {
        burst(world, p.target.x, p.target.y, '#ff9ebb', 10, 90);
        for (const e of world.enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x - p.target.x, e.y - p.target.y) <= p.splash + e.radius) {
            damageEnemy(world, e, p.damage, p.slow, p.slowSeconds);
          }
        }
      } else {
        burst(world, p.target.x, p.target.y, '#ffe27a', 5, 70);
        damageEnemy(world, p.target, p.damage, p.slow, p.slowSeconds);
      }
    } else {
      p.x += (dx / d) * move;
      p.y += (dy / d) * move;
    }
  }
  world.projectiles = world.projectiles.filter((p) => !p.spent);
}

function stepBees(world, dt) {
  for (const bee of world.bees) {
    bee.life -= dt;
    bee.wobble += dt * 9;
    if (!bee.target || bee.target.dead) {
      let best = null;
      for (const e of world.enemies) {
        if (e.dead) continue;
        if (!best || e.dist > best.dist) best = e;
      }
      bee.target = best;
    }
    if (!bee.target) continue;
    const dx = bee.target.x - bee.x, dy = bee.target.y - bee.y;
    const d = Math.hypot(dx, dy) || 1;
    const speed = 260;
    bee.x += (dx / d) * speed * dt + Math.cos(bee.wobble) * 22 * dt;
    bee.y += (dy / d) * speed * dt + Math.sin(bee.wobble) * 22 * dt;
    bee.stingCd -= dt;
    if (d < bee.target.radius + 8 && bee.stingCd <= 0) {
      bee.stingCd = 0.55;
      damageEnemy(world, bee.target, 10, 1, 0);
      burst(world, bee.target.x, bee.target.y, '#fff0a0', 4, 60);
    }
  }
  world.bees = world.bees.filter((b) => b.life > 0);
}

function stepEnemies(world, dt) {
  for (const e of world.enemies) {
    if (e.dead) continue;
    e.wobble += dt * 6;
    const slowed = world.time < e.slowUntil;
    const speed = e.speed * (slowed ? e.slowFactor : 1);
    let remaining = speed * dt;
    while (remaining > 0 && e.wp < PATH_POINTS.length) {
      const target = PATH_POINTS[e.wp];
      const dx = target.x - e.x, dy = target.y - e.y;
      const d = Math.hypot(dx, dy);
      if (d <= remaining) {
        e.x = target.x; e.y = target.y;
        e.dist += d;
        remaining -= d;
        e.wp += 1;
      } else {
        e.x += (dx / d) * remaining;
        e.y += (dy / d) * remaining;
        e.dist += remaining;
        remaining = 0;
      }
    }
    if (e.wp >= PATH_POINTS.length) {
      // Reached the garden gate: one life lost, the pest is gone.
      e.dead = true;
      e.leaked = true;
      world.waveLeaks += 1;
      world.lives -= 1;
      world.shake = 14;
      burst(world, GATE.x - 10, GATE.y, '#ff5a4d', 16, 130);
      sfx.hurt();
      if (world.lives <= 0) {
        world.lives = 0;
        world.screen = 'lost';
        sfx.lose();
      }
    }
  }
  world.enemies = world.enemies.filter((e) => !e.dead);
}

export function step(world, dt) {
  if (world.screen !== 'playing') return;
  world.time += dt;
  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 30);
  if (world.swarmCooldown > 0) world.swarmCooldown = Math.max(0, world.swarmCooldown - dt);
  if (world.swarmActive > 0) world.swarmActive = Math.max(0, world.swarmActive - dt);

  if (world.waveActive) {
    if (world.spawnQueue.length > 0) {
      world.spawnTimer -= dt;
      if (world.spawnTimer <= 0) {
        spawnEnemy(world, world.spawnQueue.shift());
        world.spawnTimer = spawnGap(world.wave);
      }
    } else if (world.enemies.length === 0) {
      // The wave ends when the queue is empty and no pests remain — but
      // the clear bonus and banner are earned only by a leak-free wave.
      // A wave every pest leaked through simply ends, with no bonus.
      world.waveActive = false;
      world.wavesCleared += 1;
      const clean = world.waveLeaks === 0;
      let bonus = 0;
      if (clean) {
        bonus = waveClearBonus(world.wave);
        world.nectar += bonus;
        world.score += 100;
        addFloat(world, 480, 300, `Wave clear! +${bonus} nectar`, '#e8a100');
        sfx.waveClear();
      } else {
        addFloat(world, 480, 300, 'Wave over', '#e8a100');
      }
      if (world.wave >= TOTAL_WAVES) {
        world.screen = 'won';
        world.score += world.lives * 25;
        showBanner(world, 'Harvest Saved!', '', 3);
        sfx.win();
      } else if (clean) {
        showBanner(world, `Wave ${world.wave} clear!`, `+${bonus} nectar — build, then send wave ${world.wave + 1}`, 2.4);
      }
    }
  }

  for (const tower of world.towers) {
    tower.cooldown -= dt;
    if (tower.bloom > 0) tower.bloom = Math.max(0, tower.bloom - dt);
    if (tower.cooldown <= 0) {
      const before = world.projectiles.length;
      fireTower(world, tower);
      if (world.projectiles.length > before) tower.cooldown = 1 / towerStats(tower).rate;
    }
  }

  stepEnemies(world, dt);
  stepProjectiles(world, dt);
  stepBees(world, dt);

  for (const p of world.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 160 * dt;
  }
  world.particles = world.particles.filter((p) => p.life > 0);
  for (const f of world.floats) {
    f.life -= dt;
    f.y -= 34 * dt;
  }
  world.floats = world.floats.filter((f) => f.life > 0);
}

export function enemiesRemaining(world) {
  return world.spawnQueue.length + world.enemies.length;
}
