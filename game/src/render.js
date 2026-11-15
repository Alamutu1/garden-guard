// Garden Guard — everything the player sees, drawn procedurally on one
// canvas. No images, no fonts from the network: shapes, gradients and the
// system font stack only. The garden is a warm golden-hour lawn with a
// cream S-path, terracotta pots and a wooden gate.

import {
  CELL, COLS, ENEMY_TYPES, GATE, PALETTE, PATH_HALF_WIDTH, PATH_POINTS,
  TOTAL_WAVES, TOWER_TYPES, VIEW,
} from './config.js';
import { cellIsPath, towerStats } from './world.js';

// Decorative grass tufts and wildflowers, fixed by the world's seed so the
// garden looks the same every visit.
function decorFor(seed) {
  let a = seed >>> 0;
  const rnd = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const items = [];
  for (let i = 0; i < 130; i += 1) {
    const col = Math.floor(rnd() * COLS);
    const row = Math.floor(rnd() * 16);
    if (cellIsPath(col, row)) continue;
    items.push({
      x: col * CELL + 6 + rnd() * (CELL - 12),
      y: row * CELL + 6 + rnd() * (CELL - 12),
      kind: rnd() < 0.72 ? 'tuft' : 'wild',
      hue: ['#ff8fb3', '#ffd94d', '#c9a7eb', '#ffffff'][Math.floor(rnd() * 4)],
      s: 0.7 + rnd() * 0.6,
    });
  }
  return items;
}

let decorCache = { seed: -1, items: [] };
function decor(seed) {
  if (decorCache.seed !== seed) decorCache = { seed, items: decorFor(seed) };
  return decorCache.items;
}

function circle(ctx, x, y, r, colour) {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function petal(ctx, x, y, angle, length, width, colour) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.ellipse(length / 2 + 4, 0, length / 2, width / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLawn(ctx, world) {
  // Golden light from the top, mow stripes down the lawn.
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  sky.addColorStop(0, '#ffe9a8');
  sky.addColorStop(0.12, '#bfe07e');
  sky.addColorStop(1, '#8fce62');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  for (let c = 0; c < COLS; c += 1) {
    if (c % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(c * CELL, 0, CELL, VIEW.height);
    }
  }
  // Fence along the top and bottom edges.
  ctx.fillStyle = PALETTE.fence;
  ctx.fillRect(0, 0, VIEW.width, 10);
  ctx.fillRect(0, VIEW.height - 10, VIEW.width, 10);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let x = 20; x < VIEW.width; x += 60) {
    ctx.fillRect(x, 0, 4, 10);
    ctx.fillRect(x, VIEW.height - 10, 4, 10);
  }
  // Grass tufts and wildflowers.
  for (const d of decor(world.seed)) {
    if (d.kind === 'tuft') {
      ctx.strokeStyle = '#5da53a';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(d.x - 3 * d.s, d.y);
      ctx.lineTo(d.x - 4 * d.s, d.y - 7 * d.s);
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x, d.y - 9 * d.s);
      ctx.moveTo(d.x + 3 * d.s, d.y);
      ctx.lineTo(d.x + 4 * d.s, d.y - 7 * d.s);
      ctx.stroke();
    } else {
      circle(ctx, d.x, d.y, 3 * d.s, d.hue);
      circle(ctx, d.x, d.y, 1.2 * d.s, '#fff3a0');
    }
  }
  // Terracotta pots in the corners, out of the path's way.
  for (const [px, py] of [[36, 580], [924, 36], [924, 580]]) {
    ctx.fillStyle = PALETTE.potRim;
    ctx.fillRect(px - 16, py - 12, 32, 8);
    ctx.fillStyle = PALETTE.pot;
    ctx.beginPath();
    ctx.moveTo(px - 13, py - 4);
    ctx.lineTo(px + 13, py - 4);
    ctx.lineTo(px + 9, py + 14);
    ctx.lineTo(px - 9, py + 14);
    ctx.closePath();
    ctx.fill();
    circle(ctx, px - 5, py - 14, 5, '#ff8fb3');
    circle(ctx, px + 5, py - 16, 5, '#ffd94d');
    circle(ctx, px, py - 10, 4, '#ffffff');
  }
}

function drawPath(ctx) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Stone border, then the cream path itself.
  ctx.strokeStyle = PALETTE.pathEdge;
  ctx.lineWidth = PATH_HALF_WIDTH * 2 + 10;
  ctx.beginPath();
  PATH_POINTS.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
  ctx.strokeStyle = PALETTE.path;
  ctx.lineWidth = PATH_HALF_WIDTH * 2;
  ctx.beginPath();
  PATH_POINTS.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
  // Dashes down the middle, like stepping stones.
  ctx.strokeStyle = 'rgba(190,150,80,0.5)';
  ctx.lineWidth = 3;
  ctx.setLineDash([2, 26]);
  ctx.beginPath();
  PATH_POINTS.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawGate(ctx, world) {
  const { x, y } = GATE;
  ctx.save();
  ctx.translate(x, y);
  // Wooden arch over the path's end.
  ctx.fillStyle = PALETTE.gate;
  ctx.fillRect(-14, -46, 10, 46);
  ctx.fillRect(4, -46, 10, 46);
  ctx.fillStyle = '#a06a35';
  ctx.beginPath();
  ctx.arc(0, -44, 16, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#7a4a26';
  ctx.beginPath();
  ctx.arc(0, -44, 16, Math.PI, 0);
  ctx.arc(0, -44, 11, 0, Math.PI, true);
  ctx.fill();
  // A sunflower planted by the gate.
  circle(ctx, -26, 6, 7, '#f7b500');
  circle(ctx, -26, 6, 3.5, '#6b3f12');
  circle(ctx, 26, 8, 7, '#f7b500');
  circle(ctx, 26, 8, 3.5, '#6b3f12');
  ctx.restore();
  // "Gate" label so the goal is obvious.
  ctx.fillStyle = 'rgba(74,47,20,0.85)';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GATE', x - 4, y - 58);
}

function drawPollen(ctx, world) {
  const links = world.pollenLinks || [];
  if (links.length === 0) return;
  ctx.save();
  ctx.lineCap = 'round';
  for (const link of links) {
    // A golden pollen arc bowing under the two flower pots, dotted and
    // marching: a straight line hides behind the heads, and an upward
    // arc hides behind the level stars — but the lawn below the bed
    // is always empty, so the link reads in every frame.
    const mx = (link.x1 + link.x2) / 2;
    const my = Math.max(link.y1, link.y2) + 36;
    ctx.strokeStyle = link.rainbow ? 'rgba(255,190,0,0.9)' : 'rgba(255,200,40,0.85)';
    ctx.lineWidth = link.rainbow ? 3 : 2;
    ctx.setLineDash([2, 8]);
    ctx.lineDashOffset = -world.time * 18;
    ctx.beginPath();
    ctx.moveTo(link.x1, link.y1 + 12);
    ctx.quadraticCurveTo(mx, my, link.x2, link.y2 + 12);
    ctx.stroke();
    // Pollen motes drifting along the arc.
    for (let m = 0; m < 3; m += 1) {
      const t = (world.time * 0.22 + m / 3) % 1;
      const u = 1 - t;
      const px = u * u * link.x1 + 2 * u * t * mx + t * t * link.x2;
      const py = u * u * (link.y1 + 12) + 2 * u * t * my + t * t * (link.y2 + 12)
        + Math.sin(world.time * 3 + m * 2.1) * 2;
      circle(ctx, px, py, 2.2, 'rgba(255,228,120,0.95)');
    }
  }
  ctx.setLineDash([]);
  ctx.restore();
}

function drawTower(ctx, world, tower) {
  const base = TOWER_TYPES[tower.type];
  const stats = towerStats(tower);
  const { x, y } = tower;
  const bloom = 1 + tower.bloom * 1.6;
  // Rainbow Bed shimmer: slow rainbow arcs circling the flower.
  if (tower.pollination === 'rainbow') {
    const pulse = 0.45 + 0.25 * Math.sin(world.time * 3 + tower.col);
    const cols = ['#ff5a5a', '#ffb400', '#7ed321', '#7fb2ff'];
    cols.forEach((c, i) => {
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 20 + i * 3, world.time * 0.6 + i * 1.7, world.time * 0.6 + i * 1.7 + Math.PI * 1.2);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  } else if (tower.pollination === 'cross') {
    // A soft gold ring marks a cross-pollinated flower.
    ctx.strokeStyle = 'rgba(255,210,0,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 19, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Soft shadow and soil mound.
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(x, y + 12, 15, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  circle(ctx, x, y + 10, 13, '#8a5a2b');
  // Stem.
  ctx.strokeStyle = '#3f8f2f';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, y + 10);
  ctx.lineTo(x, y - 6);
  ctx.stroke();
  // Leaves.
  ctx.fillStyle = '#4da33a';
  ctx.beginPath();
  ctx.ellipse(x - 8, y + 2, 7, 3.5, -0.6, 0, Math.PI * 2);
  ctx.ellipse(x + 8, y + 4, 7, 3.5, 0.6, 0, Math.PI * 2);
  ctx.fill();
  if (tower.type === 'sunflower') {
    for (let i = 0; i < 10; i += 1) {
      petal(ctx, x, y - 10, (i / 10) * Math.PI * 2, 13 * bloom, 7, '#ffc21a');
    }
    circle(ctx, x, y - 10, 8, '#6b3f12');
    circle(ctx, x - 2, y - 12, 1.5, '#3d2408');
    circle(ctx, x + 2, y - 8, 1.5, '#3d2408');
  } else if (tower.type === 'rose') {
    for (let i = 0; i < 6; i += 1) {
      petal(ctx, x, y - 10, (i / 6) * Math.PI * 2, 11 * bloom, 8, '#f06292');
    }
    circle(ctx, x, y - 10, 6, '#e75480');
    circle(ctx, x, y - 10, 3, '#c2185b');
  } else {
    // Lavender: three purple spikes.
    ctx.strokeStyle = '#7d5ba6';
    ctx.lineWidth = 3;
    for (const dx of [-7, 0, 7]) {
      ctx.beginPath();
      ctx.moveTo(x + dx, y - 4);
      ctx.lineTo(x + dx * 0.6, y - 22);
      ctx.stroke();
      for (let k = 0; k < 3; k += 1) {
        circle(ctx, x + dx * 0.6, y - 12 - k * 5, 3.4, k === 0 ? '#9b7ed9' : '#8b6fc0');
      }
    }
  }
  // Level stars above the flower.
  if (tower.level > 1) {
    ctx.fillStyle = '#fff3a0';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★'.repeat(tower.level), x, y - 26);
  }
  // Gold flower badge beside the head of a boosted tower.
  if (tower.pollination === 'cross' || tower.pollination === 'rainbow') {
    const bx = x + 18, by = y - 12;
    ctx.fillStyle = tower.pollination === 'rainbow' ? '#ff9d00' : '#ffd94d';
    ctx.strokeStyle = 'rgba(74,47,20,0.55)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(bx + Math.cos(a) * 4, by + Math.sin(a) * 4, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    circle(ctx, bx, by, 2.6, '#e8a100');
  }
  // Range ring when selected or being placed nearby.
  if (world.selected === tower) {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(x, y, stats.range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawEnemy(ctx, world, e) {
  const def = ENEMY_TYPES[e.kind];
  const bob = Math.sin(e.wobble) * 1.5;
  const slowed = world.time < e.slowUntil;
  ctx.save();
  ctx.translate(e.x, e.y + bob);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, e.radius * 0.7, e.radius, e.radius * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  if (e.kind === 'aphid' || e.kind === 'queen') {
    // Round red body, six legs, two antennae.
    ctx.strokeStyle = '#7a0d0d';
    ctx.lineWidth = 2;
    for (const s of [-1, 1]) {
      for (let k = -1; k <= 1; k += 1) {
        ctx.beginPath();
        ctx.moveTo(s * e.radius * 0.6, k * 5);
        ctx.lineTo(s * (e.radius + 6), k * 8 + 4);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(s * 4, -e.radius + 3);
      ctx.quadraticCurveTo(s * 8, -e.radius - 8, s * 12, -e.radius - 6);
      ctx.stroke();
    }
    circle(ctx, 0, 0, e.radius, def.colour);
    circle(ctx, -e.radius * 0.35, -e.radius * 0.25, e.radius * 0.45, 'rgba(255,255,255,0.25)');
    circle(ctx, -5, -3, 2.2, '#1c0a0a');
    circle(ctx, 5, -3, 2.2, '#1c0a0a');
    if (e.kind === 'queen') {
      // Golden crown.
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.moveTo(-10, -e.radius + 2);
      ctx.lineTo(-10, -e.radius - 10);
      ctx.lineTo(-5, -e.radius - 4);
      ctx.lineTo(0, -e.radius - 12);
      ctx.lineTo(5, -e.radius - 4);
      ctx.lineTo(10, -e.radius - 10);
      ctx.lineTo(10, -e.radius + 2);
      ctx.closePath();
      ctx.fill();
    }
  } else if (e.kind === 'beetle') {
    circle(ctx, 0, 0, e.radius, def.colour);
    ctx.fillStyle = '#3d2410';
    ctx.beginPath();
    ctx.ellipse(0, 0, e.radius * 0.9, e.radius * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2a1808';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -e.radius * 0.8);
    ctx.lineTo(0, e.radius * 0.8);
    ctx.stroke();
    circle(ctx, -e.radius * 0.55, -e.radius * 0.55, 3, '#ffd94d');
    circle(ctx, e.radius * 0.55, -e.radius * 0.55, 3, '#ffd94d');
  } else {
    // Snail: soft body under a spiral shell.
    ctx.fillStyle = '#c9a86a';
    ctx.beginPath();
    ctx.ellipse(0, e.radius * 0.45, e.radius * 1.1, e.radius * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    circle(ctx, e.radius * 0.9, -e.radius * 0.1, 3, '#1c0a0a');
    ctx.strokeStyle = '#8a6a35';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(e.radius * 0.8, -e.radius * 0.2);
    ctx.lineTo(e.radius * 0.95, -e.radius * 0.75);
    ctx.stroke();
    circle(ctx, 0, -e.radius * 0.15, e.radius * 0.85, '#a8763e');
    ctx.strokeStyle = '#7a4a26';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -e.radius * 0.15, e.radius * 0.55, 0, Math.PI * 1.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -e.radius * 0.15, e.radius * 0.28, 0, Math.PI * 1.5);
    ctx.stroke();
  }
  if (slowed) {
    // Frosty sparkles while lavender holds the pest.
    circle(ctx, -e.radius * 0.5, -e.radius * 0.6, 3, 'rgba(180,220,255,0.9)');
    circle(ctx, e.radius * 0.5, -e.radius * 0.4, 2.5, 'rgba(180,220,255,0.9)');
  }
  ctx.restore();
  // Health bar, only when hurt.
  if (e.hp < e.maxHp) {
    const w = e.radius * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w, 5);
    ctx.fillStyle = e.hp / e.maxHp > 0.5 ? '#7ed321' : '#ff5a4d';
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w * (e.hp / e.maxHp), 5);
  }
}

function drawBee(ctx, bee) {
  ctx.save();
  ctx.translate(bee.x, bee.y);
  // Wings, blurred by speed.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(-2, -5, 5, 3, -0.5, 0, Math.PI * 2);
  ctx.ellipse(3, -5, 5, 3, 0.5, 0, Math.PI * 2);
  ctx.fill();
  // Striped body.
  circle(ctx, 0, 0, 6, '#ffcf3d');
  ctx.fillStyle = '#3a2a00';
  ctx.fillRect(-6, -3, 3, 6);
  ctx.fillRect(0, -5, 3, 10);
  ctx.fillStyle = '#1c0a0a';
  circle(ctx, 5, -1, 1.2, '#1c0a0a');
  ctx.restore();
}

function drawProjectiles(ctx, world) {
  for (const p of world.projectiles) {
    if (p.kind === 'rose') {
      circle(ctx, p.x, p.y, 6, 'rgba(255,120,160,0.5)');
      circle(ctx, p.x, p.y, 4, '#ff6b9d');
      circle(ctx, p.x, p.y, 1.8, '#ffd0dd');
    } else if (p.kind === 'lavender') {
      circle(ctx, p.x, p.y, 6, 'rgba(178,148,222,0.55)');
      circle(ctx, p.x, p.y, 3.5, '#b294de');
    } else {
      circle(ctx, p.x, p.y, 5, 'rgba(255,217,77,0.55)');
      circle(ctx, p.x, p.y, 3, '#ffd94d');
      circle(ctx, p.x, p.y, 1.4, '#fff8d0');
    }
  }
}

export function drawWorld(ctx, world) {
  ctx.save();
  if (world.shake > 0) {
    ctx.translate((Math.random() - 0.5) * world.shake, (Math.random() - 0.5) * world.shake);
  }
  drawLawn(ctx, world);
  drawPath(ctx);
  drawGate(ctx, world);
  drawPollen(ctx, world);

  // Placement ghost: the flower the player is about to plant.
  if (world.placing && world.hover) {
    const gx = world.hover.col * CELL + CELL / 2;
    const gy = world.hover.row * CELL + CELL / 2;
    const ok = !cellIsPath(world.hover.col, world.hover.row);
    const stats = TOWER_TYPES[world.placing];
    ctx.globalAlpha = 0.45;
    circle(ctx, gx, gy, 14, ok ? stats.colour : '#ff5a4d');
    ctx.globalAlpha = 1;
    ctx.strokeStyle = ok ? 'rgba(255,255,255,0.9)' : 'rgba(255,90,77,0.9)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(gx, gy, stats.range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (const tower of world.towers) drawTower(ctx, world, tower);
  for (const e of world.enemies) drawEnemy(ctx, world, e);
  drawProjectiles(ctx, world);
  for (const bee of world.bees) drawBee(ctx, bee);

  for (const p of world.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    circle(ctx, p.x, p.y, p.size, p.colour);
  }
  ctx.globalAlpha = 1;

  // Floating "+nectar" text.
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const f of world.floats) {
    ctx.globalAlpha = Math.max(0, f.life / f.max);
    ctx.fillStyle = f.colour;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  // Wave banner across the middle of the garden.
  if (world.banner && world.time < world.banner.until) {
    const alpha = Math.min(1, (world.banner.until - world.time) / 0.4, (world.time - (world.banner.until - 2.2)) / 0.3 + 1);
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.fillStyle = 'rgba(74,47,20,0.72)';
    ctx.fillRect(0, 250, VIEW.width, world.banner.sub ? 84 : 56);
    ctx.fillStyle = '#fff3c4';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText(world.banner.text, VIEW.width / 2, 288);
    if (world.banner.sub) {
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText(world.banner.sub, VIEW.width / 2, 316);
    }
    ctx.globalAlpha = 1;
  }

  // Short hint line near the bottom.
  if (world.message && world.time < world.messageUntil) {
    ctx.fillStyle = 'rgba(74,47,20,0.8)';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(world.message, VIEW.width / 2, VIEW.height - 26);
  }
  ctx.restore();
}

// The title screen paints the garden behind the DOM overlay, with a few
// flowers already planted and pests strolling, so the first frame is alive.
export function drawTitleBackdrop(ctx, world) {
  drawWorld(ctx, world);
}
