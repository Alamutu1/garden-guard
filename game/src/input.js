// Garden Guard — mouse and keyboard. Clicks on the canvas place flowers or
// pick one to upgrade; the keys do the same work without a mouse. The DOM
// buttons (tower bar, wave, swarm, pause) are wired in main.js and call the
// same world functions, so every action has two routes in.

import { CELL, VIEW } from './config.js';
import { placeTower, towerAt } from './world.js';

export function cellFromEvent(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * VIEW.width;
  const y = ((event.clientY - rect.top) / rect.height) * VIEW.height;
  return {
    col: Math.floor(x / CELL),
    row: Math.floor(y / CELL),
    x, y,
  };
}

/**
 * Wire canvas clicks and the keyboard. `hooks` is what the game does with
 * each gesture: onCanvasCell, onSelectTower, onClearSelection, and the
 * actions startWave, swarm, pause, mute, restart, selectTowerType.
 */
export function createInput(canvas, world, hooks) {
  canvas.addEventListener('click', (event) => {
    if (world.screen !== 'playing') return;
    const cell = cellFromEvent(canvas, event);
    if (world.placing) {
      // Clicking a flower that is already there selects it instead of
      // trying to plant on top of it — a failed plant never traps the
      // player in placing mode.
      const existing = towerAt(world, cell.col, cell.row);
      if (existing) {
        world.placing = null;
        world.selected = existing;
        hooks.onSelectTower(existing);
        return;
      }
      if (placeTower(world, world.placing, cell.col, cell.row)) {
        world.placing = null;
        hooks.onPlaced();
      } else {
        hooks.onPlaceFailed();
      }
      return;
    }
    const tower = towerAt(world, cell.col, cell.row);
    if (tower) {
      world.selected = tower;
      hooks.onSelectTower(tower);
    } else {
      world.selected = null;
      hooks.onClearSelection();
    }
  });

  canvas.addEventListener('mousemove', (event) => {
    const cell = cellFromEvent(canvas, event);
    world.hover = { col: cell.col, row: cell.row };
  });
  canvas.addEventListener('mouseleave', () => { world.hover = null; });

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const key = event.key.toLowerCase();
    if (key === '1' || key === '2' || key === '3') {
      hooks.selectTowerType(['sunflower', 'rose', 'lavender'][Number(key) - 1]);
    } else if (key === ' ') {
      event.preventDefault();
      hooks.startWave();
    } else if (key === 'b') {
      hooks.swarm();
    } else if (key === 'p') {
      hooks.pause();
    } else if (key === 'm') {
      hooks.mute();
    } else if (key === 'r') {
      hooks.restart();
    } else if (key === 'escape') {
      world.placing = null;
      world.selected = null;
      hooks.onClearSelection();
    }
  });
}
