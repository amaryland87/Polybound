// Tiny synthesized sound effects via WebAudio, so the game ships with no audio assets.
let ctx: AudioContext | null = null;
let muted = false;

try {
  muted = localStorage.getItem('polybound-muted') === '1';
} catch {
  // storage unavailable; default to sound on
}

export const isMuted = () => muted;

export function setMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem('polybound-muted', value ? '1' : '0');
  } catch {
    // ignore
  }
}

function tone(freq: number, duration: number, type: OscillatorType = 'sine', gain = 0.08, delay = 0) {
  if (muted) return;
  try {
    ctx ??= new AudioContext();
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(gain, t + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(amp).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  } catch {
    // audio not available
  }
}

export const sfx = {
  select: () => tone(660, 0.08, 'triangle', 0.05),
  rotate: () => tone(520, 0.06, 'triangle', 0.04),
  place: (player: 1 | 2) => {
    const base = player === 1 ? 220 : 262;
    tone(base, 0.18, 'square', 0.05);
    tone(base * 1.5, 0.22, 'triangle', 0.06, 0.04);
  },
  invalid: () => tone(140, 0.15, 'sawtooth', 0.04),
  surround: () => [523, 659, 784].forEach((f, i) => tone(f, 0.2, 'triangle', 0.06, i * 0.07)),
  skip: () => tone(300, 0.25, 'sine', 0.05),
  gameOver: (won: boolean) =>
    (won ? [523, 659, 784, 1047] : [392, 330, 262, 196]).forEach((f, i) => tone(f, 0.35, 'triangle', 0.07, i * 0.12)),
};
