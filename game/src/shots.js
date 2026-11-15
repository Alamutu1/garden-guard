// Garden Guard — the staged scenes behind ?shot=title|play|swarm|end.
// Each one plays the real rules forward from a fresh world in fixed steps,
// steered by a simple gardener autopilot (buy the next planned flower when
// the nectar allows, upgrade when the bed is full, send the next wave when
// the garden is quiet), so every frame is what a real game looks like and
// the same seed always gives the same frame. The renderer then paints the
// staged world twice and sets window.__shotReady for the screenshot.

import { TOWER_TYPES } from './config.js';
import { STEP, createWorld, placeTower, startWave, step, triggerSwarm, upgradeTower } from './world.js';

// Flower beds in planting order: sunny spots beside each bend of the path.
// Neighbouring beds hold different flowers, so the garden grows into
// cross-pollinated clusters and Rainbow Beds as the autopilot plants.
const BUILD_PLAN = [
  { type: 'sunflower', col: 6, row: 1 },
  { type: 'rose', col: 7, row: 1 },
  { type: 'lavender', col: 8, row: 1 }, // Rainbow Bed
  { type: 'sunflower', col: 12, row: 1 },
  { type: 'rose', col: 13, row: 1 }, // cross pair
  { type: 'sunflower', col: 10, row: 4 },
  { type: 'rose', col: 11, row: 4 },
  { type: 'lavender', col: 12, row: 4 }, // Rainbow Bed
  { type: 'sunflower', col: 17, row: 1 },
  { type: 'rose', col: 18, row: 1 }, // cross pair
  { type: 'sunflower', col: 6, row: 6 },
  { type: 'rose', col: 7, row: 6 }, // cross pair
  { type: 'sunflower', col: 21, row: 1 },
  { type: 'rose', col: 16, row: 4 },
  { type: 'sunflower', col: 17, row: 4 }, // cross pair
  { type: 'sunflower', col: 12, row: 6 },
  { type: 'rose', col: 13, row: 6 },
  { type: 'lavender', col: 14, row: 6 }, // Rainbow Bed
  { type: 'sunflower', col: 8, row: 9 },
  { type: 'rose', col: 9, row: 9 },
  { type: 'lavender', col: 8, row: 10 }, // Rainbow Bed
  { type: 'sunflower', col: 20, row: 9 },
  { type: 'sunflower', col: 6, row: 11 },
  { type: 'rose', col: 7, row: 11 }, // cross pair
  { type: 'sunflower', col: 12, row: 11 },
  { type: 'lavender', col: 13, row: 11 }, // cross pair
  { type: 'sunflower', col: 17, row: 11 },
  { type: 'rose', col: 18, row: 11 },
  { type: 'lavender', col: 17, row: 10 }, // Rainbow Bed
  { type: 'sunflower', col: 8, row: 14 },
  { type: 'rose', col: 9, row: 14 }, // cross pair
  { type: 'sunflower', col: 14, row: 14 },
  { type: 'lavender', col: 15, row: 14 }, // cross pair
  { type: 'sunflower', col: 20, row: 14 },
  { type: 'rose', col: 21, row: 14 }, // cross pair
];

const MAX_SIM_SECONDS = 1500;

/** One autopilot decision: buy the next flower if it is affordable, else
 * upgrade one, else send the next wave — never sit waiting for nectar
 * that only a wave can earn. */
function autopilot(world, planIndex, targetWave) {
  if (planIndex.value < BUILD_PLAN.length) {
    const spot = BUILD_PLAN[planIndex.value];
    const cost = TOWER_TYPES[spot.type].cost;
    if (world.nectar >= cost && placeTower(world, spot.type, spot.col, spot.row)) {
      planIndex.value += 1;
      return;
    }
  }
  const upgradable = world.towers.find((t) => t.level < 3);
  // Only attempt the upgrade when it is affordable, so a failed attempt
  // never flashes a "Not enough nectar" hint mid-wave.
  const upgradePrice = upgradable ? Math.round(TOWER_TYPES[upgradable.type].cost * 0.75) : 0;
  if (upgradable && world.nectar >= upgradePrice && upgradeTower(world, upgradable)) return;
  if (!world.waveActive && world.wave < targetWave) startWave(world);
}

/** Step the world until `done(world)` is true or time runs out. */
function runUntil(world, planIndex, targetWave, done) {
  let elapsed = 0;
  let think = 0;
  while (elapsed < MAX_SIM_SECONDS) {
    if (world.screen === 'won' || world.screen === 'lost') break;
    if (done(world)) break;
    step(world, STEP);
    elapsed += STEP;
    think += STEP;
    if (think >= 0.25) {
      think = 0;
      autopilot(world, planIndex, targetWave);
    }
  }
  return elapsed;
}

/**
 * Stage the named scene on a fresh world and return the screen to show
 * over it ('title' | 'playing' | 'won' | 'lost').
 */
export function stageShot(name, world) {
  const planIndex = { value: 0 };
  if (name === 'title') {
    // A lively garden behind the title: pests strolling, flowers planted.
    world.screen = 'playing';
    startWave(world);
    // The cross-pollinated opening bed kills wave-1 aphids faster than
    // they spawn, so a pest count alone may never be reached: stop after
    // a few seconds of play instead, with whatever is strolling then.
    runUntil(world, planIndex, 1, (w) => w.enemies.length >= 6 || w.time >= 7);
    // Freeze the garden for the title: the pests keep strolling behind
    // the overlay, but the HUD reads like a fresh game — no wave in
    // progress, no pest count — so the title frame stays clean.
    world.waveActive = false;
    world.spawnQueue = [];
    world.wave = 0;
    world.screen = 'title';
    return 'title';
  }
  if (name === 'play') {
    world.screen = 'playing';
    runUntil(world, planIndex, 5, (w) => w.wave === 5 && w.enemies.length >= 8);
    return 'playing';
  }
  if (name === 'swarm') {
    world.screen = 'playing';
    let swarmAt = -1;
    runUntil(world, planIndex, 7, (w) => {
      if (swarmAt < 0 && w.wave === 7 && w.enemies.length >= 9 && w.swarmCooldown <= 0) {
        if (triggerSwarm(w)) swarmAt = w.time;
      }
      // Wait out the 1.6 s "Bee Swarm!" banner so the frame shows the
      // swarm over the open garden, then catch the bees still flying.
      return swarmAt >= 0 && w.time >= swarmAt + 2.0;
    });
    return 'playing';
  }
  // 'end': first try to win honestly with the autopilot gardener. If the
  // garden falls anyway, the honest fallback is a game over reached by
  // planting nothing and letting the pests through the gate.
  world.screen = 'playing';
  runUntil(world, planIndex, 10, (w) => w.screen === 'won');
  if (world.screen === 'won') return 'won';
  const fresh = createWorld(world.seed);
  fresh.screen = 'playing';
  Object.keys(fresh).forEach((k) => { world[k] = fresh[k]; });
  let elapsed = 0;
  while (elapsed < MAX_SIM_SECONDS && world.screen !== 'lost') {
    if (!world.waveActive) startWave(world);
    step(world, STEP);
    elapsed += STEP;
  }
  return world.screen === 'lost' ? 'lost' : 'playing';
}
