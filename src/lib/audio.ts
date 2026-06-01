/**
 * Argus Audio Manager
 * Minimal ambient audio using Web Audio API synthesis (no external files needed).
 * Default: muted. User enables via Settings.
 */

let audioCtx: AudioContext | null = null;

function getContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

/**
 * Play a gentle transition tone (A4 chord) when moving between steps.
 * Duration: ~600ms, gentle fade in/out.
 */
export function playTransitionTone(volume: number = 0.15): void {
  if (volume <= 0) return;
  try {
    const ctx = getContext();
    const now = ctx.currentTime;

    // A major chord: A4(440), C#5(554.37), E5(659.26)
    const frequencies = [440, 554.37, 659.26];
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * 0.3, now + 0.1);
    gain.gain.linearRampToValueAtTime(0, now + 0.6);
    gain.connect(ctx.destination);

    for (const freq of frequencies) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.7);
    }
  } catch {
    // Silently fail if audio not supported
  }
}

/**
 * Play a subtle "success" tone (ascending).
 */
export function playSuccessTone(volume: number = 0.15): void {
  if (volume <= 0) return;
  try {
    const ctx = getContext();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * 0.25, now + 0.05);
    gain.gain.linearRampToValueAtTime(0, now + 0.4);
    gain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.linearRampToValueAtTime(659.26, now + 0.15); // E5
    osc.frequency.linearRampToValueAtTime(783.99, now + 0.3); // G5
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.5);
  } catch {
    // Silently fail
  }
}

/**
 * Play a subtle "checkpoint" attention tone.
 */
export function playCheckpointTone(volume: number = 0.15): void {
  if (volume <= 0) return;
  try {
    const ctx = getContext();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * 0.2, now + 0.05);
    gain.gain.linearRampToValueAtTime(volume * 0.1, now + 0.2);
    gain.gain.linearRampToValueAtTime(0, now + 0.5);
    gain.connect(ctx.destination);

    // Two-note pattern: G4 → D5
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(392, now); // G4
    osc.frequency.setValueAtTime(587.33, now + 0.15); // D5
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.6);
  } catch {
    // Silently fail
  }
}

// ─── Ambient drone (warm pad, pure synthesis) ───

let ambientNodes: { oscs: OscillatorNode[]; gain: GainNode } | null = null;

/**
 * Start a soft ambient drone — a warm harbor pad using additive synthesis.
 * No external files needed. Evokes a quiet harbor before setting sail.
 */
export function startAmbient(volume: number = 0.15): void {
  if (volume <= 0 || ambientNodes) return;
  try {
    const ctx = getContext();
    const now = ctx.currentTime;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * 0.08, now + 3); // Very slow fade in
    gain.connect(ctx.destination);

    // Warm pad: A3 + E4 + A4, detuned slightly for warmth
    const freqs = [220, 329.63, 440];
    const detunes = [0, -4, 3]; // Slight detuning for organic feel
    const oscs: OscillatorNode[] = [];

    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.detune.setValueAtTime(detunes[i], now);
      osc.connect(gain);
      osc.start(now);
      oscs.push(osc);
    });

    // Add a very subtle second harmonic layer
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(440, now);
    osc2.detune.setValueAtTime(7, now);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(volume * 0.02, now);
    osc2.connect(subGain);
    subGain.connect(ctx.destination);
    osc2.start(now);
    oscs.push(osc2);

    ambientNodes = { oscs, gain };
  } catch {
    // Silently fail
  }
}

/**
 * Stop the ambient drone with a gentle fade out.
 */
export function stopAmbient(): void {
  if (!ambientNodes) return;
  try {
    const ctx = getContext();
    const now = ctx.currentTime;
    ambientNodes.gain.gain.linearRampToValueAtTime(0, now + 2);
    const nodes = ambientNodes;
    ambientNodes = null;
    setTimeout(() => {
      nodes.oscs.forEach((osc) => { try { osc.stop(); } catch { /* already stopped */ } });
    }, 2500);
  } catch {
    ambientNodes = null;
  }
}

/**
 * Check if ambient is currently playing.
 */
export function isAmbientPlaying(): boolean {
  return ambientNodes !== null;
}

/**
 * Resume audio context (must be called from user interaction).
 */
export function resumeAudioContext(): void {
  if (audioCtx?.state === 'suspended') {
    audioCtx.resume();
  }
}
