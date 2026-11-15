// Garden Guard — boot and the one loop. Input is read every frame, the
// world advances in fixed 1/60 s steps, the canvas paints what is there,
// and the DOM bars show nectar, lives, wave, foes and score. The game moves
// between five screens — title, playing, paused, won, lost — each with its
// own overlay and buttons.
//
// ?seed=N fixes the garden's decoration. ?shot=title|play|swarm|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.

import { TOTAL_WAVES, TOWER_TYPES, VIEW } from './config.js';
import { STEP, createWorld, enemiesRemaining, placeTower, sellTower, startWave, step, towerStats, triggerSwarm, upgradeTower } from './world.js';
import { drawWorld } from './render.js';
import { createInput } from './input.js';
import { stageShot } from './shots.js';
import { isMuted, setMuted, sfx } from './audio.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW.width;
canvas.height = VIEW.height;

const world = createWorld(seed);
window.__garden = world; // for play-testing and debugging

const $ = (id) => document.getElementById(id);
const hud = {
  nectar: $('hud-nectar'), lives: $('hud-lives'), wave: $('hud-wave'),
  foes: $('hud-foes'), score: $('hud-score'), swarm: $('btn-swarm'),
  waveBtn: $('btn-wave'), selected: $('selected-panel'),
  selName: $('sel-name'), selStats: $('sel-stats'),
  selUpgrade: $('btn-upgrade'), selSell: $('btn-sell'),
};
const overlays = {
  title: $('overlay-title'), paused: $('overlay-paused'),
  won: $('overlay-won'), lost: $('overlay-lost'),
};
const endStats = { won: $('won-stats'), lost: $('lost-stats') };

function showOverlay(name) {
  for (const [key, el] of Object.entries(overlays)) {
    el.classList.toggle('hidden', key !== name);
  }
}

function refreshHud() {
  hud.nectar.textContent = `🍯 ${world.nectar}`;
  hud.lives.textContent = `❤️ ${world.lives}`;
  hud.wave.textContent = `Wave ${Math.max(1, world.wave)}/${TOTAL_WAVES}`;
  hud.foes.textContent = world.waveActive ? `🐛 ${enemiesRemaining(world)} pests` : '🐛 —';
  hud.score.textContent = `⭐ ${world.score}`;
  const cd = world.swarmCooldown;
  hud.swarm.textContent = cd > 0 ? `🐝 Swarm (${Math.ceil(cd)}s)` : '🐝 Bee Swarm (B)';
  hud.swarm.disabled = cd > 0 || world.screen !== 'playing';
  hud.waveBtn.disabled = world.waveActive || world.wave >= TOTAL_WAVES || world.screen !== 'playing';
  hud.waveBtn.textContent = world.wave >= TOTAL_WAVES ? '✔ All Waves Clear'
    : world.wave === 0 ? '▶ Send Wave 1 (Space)' : `▶ Send Wave ${world.wave + 1} (Space)`;
  for (const type of Object.keys(TOWER_TYPES)) {
    const btn = $(`btn-${type}`);
    btn.classList.toggle('picked', world.placing === type);
    btn.classList.toggle('poor', world.nectar < TOWER_TYPES[type].cost);
  }
  // Selected-tower panel.
  const tower = world.selected;
  hud.selected.classList.toggle('hidden', !tower);
  if (tower) {
    const stats = towerStats(tower);
    hud.selName.textContent = `${TOWER_TYPES[tower.type].name} ${'★'.repeat(tower.level)}`;
    const pol = tower.pollination === 'rainbow' ? ' · 🌈 Rainbow Bed: +100% dmg, +25% range'
      : tower.pollination === 'cross' ? ' · 🌼 Cross-pollinated: +40% dmg, +15% range' : '';
    hud.selStats.textContent = `Damage ${stats.damage} · Range ${stats.range} · ${stats.rate}/s${pol}`;
    const cost = Math.round(TOWER_TYPES[tower.type].cost * 0.75);
    hud.selUpgrade.textContent = tower.level >= 3 ? 'Full Bloom ★★★' : `⬆ Upgrade (${cost} 🍯)`;
    hud.selUpgrade.disabled = tower.level >= 3;
    hud.selSell.textContent = `💰 Sell (+${Math.floor(tower.invested * 0.7)} 🍯)`;
  }
}

function endText() {
  return `Waves cleared ${world.wavesCleared}/${TOTAL_WAVES} · Pests defeated ${world.kills} · Lives left ${world.lives} · Score ${world.score}`;
}

function setScreen(screen) {
  world.screen = screen;
  if (screen === 'title') showOverlay('title');
  else if (screen === 'paused') showOverlay('paused');
  else if (screen === 'won') {
    endStats.won.textContent = endText();
    showOverlay('won');
  } else if (screen === 'lost') {
    endStats.lost.textContent = endText();
    showOverlay('lost');
  } else showOverlay(null);
}

function startGame() {
  const muted = isMuted();
  const keepSeed = world.seed;
  const fresh = createWorld(keepSeed);
  Object.keys(fresh).forEach((k) => { world[k] = fresh[k]; });
  setMuted(muted);
  world.muted = muted;
  setScreen('playing');
  sfx.click();
}

function togglePause() {
  if (world.screen === 'playing') {
    setScreen('paused');
    sfx.click();
  } else if (world.screen === 'paused') {
    setScreen('playing');
    sfx.click();
  }
}

function toggleMute() {
  setMuted(!isMuted());
  world.muted = isMuted();
  $('btn-mute').textContent = isMuted() ? '🔇 Muted (M)' : '🔊 Sound (M)';
  if (!isMuted()) sfx.click();
}

// --- Tower bar -------------------------------------------------------------
for (const type of Object.keys(TOWER_TYPES)) {
  $(`btn-${type}`).addEventListener('click', () => selectTowerType(type));
}
function selectTowerType(type) {
  if (world.screen !== 'playing') return;
  world.placing = world.placing === type ? null : type;
  world.selected = null;
  sfx.click();
  refreshHud();
}

$('btn-wave').addEventListener('click', () => { startWave(world); refreshHud(); });
$('btn-swarm').addEventListener('click', () => { triggerSwarm(world); refreshHud(); });
$('btn-pause').addEventListener('click', togglePause);
$('btn-mute').addEventListener('click', toggleMute);
$('btn-restart').addEventListener('click', startGame);
$('btn-start').addEventListener('click', startGame);
$('btn-resume').addEventListener('click', togglePause);
$('btn-again-won').addEventListener('click', startGame);
$('btn-again-lost').addEventListener('click', startGame);
hud.selUpgrade.addEventListener('click', () => {
  if (world.selected) upgradeTower(world, world.selected);
  refreshHud();
});
hud.selSell.addEventListener('click', () => {
  if (world.selected) sellTower(world, world.selected);
  refreshHud();
});

createInput(canvas, world, {
  onPlaced: refreshHud,
  onPlaceFailed: refreshHud,
  onSelectTower: refreshHud,
  onClearSelection: refreshHud,
  selectTowerType,
  startWave: () => { startWave(world); refreshHud(); },
  swarm: () => { triggerSwarm(world); refreshHud(); },
  pause: togglePause,
  mute: toggleMute,
  restart: startGame,
});

// --- Main loop -------------------------------------------------------------
let last = performance.now();
let acc = 0;
const MAX_FRAME = 0.25;

function frame(now) {
  const dt = Math.min(MAX_FRAME, (now - last) / 1000);
  last = now;
  if (world.screen === 'playing') {
    acc += dt;
    while (acc >= STEP) {
      step(world, STEP);
      acc -= STEP;
      if (world.screen === 'won' || world.screen === 'lost') {
        setScreen(world.screen);
        break;
      }
    }
  }
  drawWorld(ctx, world);
  refreshHud();
  requestAnimationFrame(frame);
}

// --- Shot mode -------------------------------------------------------------
if (shot) {
  setMuted(true); // screenshots stay silent
  const screen = stageShot(shot, world);
  if (screen === 'title') setScreen('title');
  else if (screen === 'won') setScreen('won');
  else if (screen === 'lost') setScreen('lost');
  else showOverlay(null);
  let painted = 0;
  (function paint() {
    drawWorld(ctx, world);
    refreshHud();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  })();
} else {
  setScreen('title');
  refreshHud();
  requestAnimationFrame(frame);
}
