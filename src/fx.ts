// Small, optional effects: quiet WebAudio blips. They respect user settings and reduced motion.
let ctx: AudioContext | null = null;

export function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function tone(freq: number, dur: number, vol: number, type: OscillatorType, delay = 0) {
  try {
    ctx ??= new AudioContext();
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch { /* audio is optional */ }
}

export function blip(freq = 400) { tone(freq, 0.05, 0.05, 'triangle'); }
export function chime() { tone(660, 0.12, 0.07, 'sine'); tone(990, 0.22, 0.07, 'sine', 0.09); }
