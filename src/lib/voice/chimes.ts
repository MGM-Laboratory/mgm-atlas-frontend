'use client';

/**
 * Tiny synthesized chimes for voice events. Generated on-the-fly via
 * Web Audio so we don't ship binary assets in the bundle and so the
 * tones are deterministic across browsers.
 *
 * Three chimes, all ~80ms, played at volume 0.15 so they sit under
 * conversation. Calls are no-ops when the AudioContext isn't allowed
 * (e.g. before any user gesture) and silently swallow failures.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
  } catch {
    return null;
  }
  return ctx;
}

interface Tone {
  freq: number;
  duration: number;
}

function playTones(tones: Tone[], gain = 0.15) {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  // Some browsers suspend the context until a user gesture. The
  // soundboard / mic toggle gestures unlock it; we just try here.
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume().catch(() => undefined);
  }
  const now = audioCtx.currentTime;
  let cursor = now;
  for (const t of tones) {
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(t.freq, cursor);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0, cursor);
    g.gain.linearRampToValueAtTime(gain, cursor + 0.005);
    g.gain.linearRampToValueAtTime(0, cursor + t.duration);
    osc.connect(g).connect(audioCtx.destination);
    osc.start(cursor);
    osc.stop(cursor + t.duration);
    cursor += t.duration;
  }
}

/** Two ascending tones — someone joined. */
export function playJoinChime() {
  playTones([
    { freq: 523.25, duration: 0.08 }, // C5
    { freq: 783.99, duration: 0.1 }, // G5
  ]);
}

/** Two descending tones — someone left. */
export function playLeaveChime() {
  playTones([
    { freq: 783.99, duration: 0.08 }, // G5
    { freq: 523.25, duration: 0.1 }, // C5
  ]);
}

/** Soft single tone — you toggled your own mute. */
export function playMuteChime() {
  playTones([{ freq: 392.0, duration: 0.07 }], 0.12); // G4, quieter
}

/** Soft single tone, slightly higher — you toggled unmute. */
export function playUnmuteChime() {
  playTones([{ freq: 523.25, duration: 0.07 }], 0.12); // C5
}
