// Garden Guard — every sound is a small WebAudio synth voice. No audio
// files, no network: oscillators and noise shaped into pops, thuds and
// little fanfares. The context is created on the first user gesture, so
// browsers never complain, and M mutes everything at once.

let ctx = null;
let muted = false;

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = !!value;
}

function audio() {
  if (muted) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** A short oscillator note with a quick fade. */
function tone(freq, seconds, type, volume, when = 0, slideTo = 0) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + seconds);
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + seconds + 0.02);
}

/** A burst of filtered noise — the soft thud when a pest reaches the gate. */
function thud() {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime;
  const length = Math.floor(ac.sampleRate * 0.18);
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 320;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.5, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);
  src.start(t0);
}

export const sfx = {
  // A tower's pollen pellet leaving the flower.
  shoot(kind) {
    if (kind === 'rose') tone(520, 0.08, 'triangle', 0.10, 0, 300);
    else if (kind === 'lavender') tone(760, 0.09, 'sine', 0.08, 0, 520);
    else tone(880, 0.06, 'sine', 0.07, 0, 620);
  },
  // A pest pops when a shot lands.
  pop() {
    tone(340, 0.07, 'square', 0.08, 0, 180);
  },
  // Nectar earned: a bright little coin blip.
  coin() {
    tone(1180, 0.09, 'sine', 0.09);
    tone(1560, 0.12, 'sine', 0.07, 0.06);
  },
  // Two flowers meet: a soft two-note chime for cross-pollination.
  cross() {
    tone(880, 0.18, 'sine', 0.10);
    tone(1318, 0.28, 'sine', 0.08, 0.09);
  },
  // All three flowers together: a brighter little Rainbow Bed arpeggio.
  rainbow() {
    [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.25, 'triangle', 0.11, i * 0.08));
  },
  // A tower is planted.
  plant() {
    tone(300, 0.12, 'triangle', 0.14, 0, 620);
    tone(620, 0.1, 'sine', 0.08, 0.08);
  },
  // A pest slipped through the gate.
  hurt() {
    thud();
    tone(140, 0.3, 'sawtooth', 0.16, 0, 70);
  },
  // The bee swarm leaves the hive.
  swarm() {
    for (let i = 0; i < 6; i += 1) tone(240 + i * 60, 0.12, 'sawtooth', 0.05, i * 0.05, 480 + i * 60);
  },
  // A wave is cleared: a rising arpeggio.
  waveClear() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.12, i * 0.09));
  },
  // A wave begins: a short call to arms.
  waveStart() {
    tone(392, 0.12, 'triangle', 0.12);
    tone(523, 0.16, 'triangle', 0.12, 0.1);
  },
  // The harvest is saved.
  win() {
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.35, 'triangle', 0.13, i * 0.13));
  },
  // The garden is overrun.
  lose() {
    [392, 330, 262, 196].forEach((f, i) => tone(f, 0.4, 'sawtooth', 0.09, i * 0.18));
  },
  // A button click.
  click() {
    tone(700, 0.05, 'sine', 0.08);
  },
  // Not enough nectar.
  denied() {
    tone(220, 0.12, 'square', 0.07, 0, 160);
  },
};
