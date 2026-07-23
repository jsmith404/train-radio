/**
 * Single AudioContext for the whole app. Plays 30s previews with a crossfade
 * between the outgoing and incoming track, and exposes an AnalyserNode split
 * into low/mid/high energy bands that drive the visuals.
 */

export interface Bands {
  /** 0..1 smoothed energy per band */
  low: number;
  mid: number;
  high: number;
  /** overall 0..1 level */
  level: number;
}

interface Voice {
  el: HTMLAudioElement;
  source: MediaElementAudioSourceNode;
  gain: GainNode;
}

const FFT_SIZE = 1024;
const CROSSFADE_MS = 900;
// Band edges as fractions of the frequency bin range (~0..~11kHz for 22.05k Nyquist).
const LOW_END = 0.08;
const MID_END = 0.4;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private freq: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  private current: Voice | null = null;
  private bands: Bands = { low: 0, mid: 0, high: 0, level: 0 };

  /** Lazily create the context (must follow a user gesture per autoplay rules). */
  private ensure(): AudioContext {
    if (this.ctx) return this.ctx;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.8;
    analyser.connect(ctx.destination);
    this.analyser = analyser;
    this.freq = new Uint8Array(analyser.frequencyBinCount);
    this.ctx = ctx;
    return ctx;
  }

  private makeVoice(url: string): Voice {
    const ctx = this.ensure();
    const el = new Audio();
    el.crossOrigin = "anonymous";
    el.src = url;
    el.loop = true;
    el.preload = "auto";
    const source = ctx.createMediaElementSource(el);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(this.analyser!);
    return { el, source, gain };
  }

  /** Crossfade to a new preview. Resolves once playback has actually started. */
  async play(url: string): Promise<void> {
    const ctx = this.ensure();
    if (ctx.state === "suspended") await ctx.resume();

    const next = this.makeVoice(url);
    const now = ctx.currentTime;
    const fade = CROSSFADE_MS / 1000;

    try {
      await next.el.play();
    } catch (err) {
      next.source.disconnect();
      next.gain.disconnect();
      throw err;
    }

    next.gain.gain.cancelScheduledValues(now);
    next.gain.gain.setValueAtTime(0, now);
    next.gain.gain.linearRampToValueAtTime(1, now + fade);

    const outgoing = this.current;
    if (outgoing) {
      outgoing.gain.gain.cancelScheduledValues(now);
      outgoing.gain.gain.setValueAtTime(outgoing.gain.gain.value, now);
      outgoing.gain.gain.linearRampToValueAtTime(0, now + fade);
      window.setTimeout(() => this.disposeVoice(outgoing), CROSSFADE_MS + 60);
    }

    this.current = next;
  }

  stop(): void {
    if (this.current) {
      this.disposeVoice(this.current);
      this.current = null;
    }
  }

  private disposeVoice(v: Voice): void {
    try {
      v.el.pause();
      v.el.src = "";
      v.gain.disconnect();
      v.source.disconnect();
    } catch {
      /* already torn down */
    }
  }

  /** Sample the analyser and update smoothed bands. Call once per animation frame. */
  sample(): Bands {
    if (!this.analyser) return this.bands;
    this.analyser.getByteFrequencyData(this.freq);
    const n = this.freq.length;
    const lowEnd = Math.floor(n * LOW_END);
    const midEnd = Math.floor(n * MID_END);

    const low = avg(this.freq, 0, lowEnd);
    const mid = avg(this.freq, lowEnd, midEnd);
    const high = avg(this.freq, midEnd, n);
    const level = (low + mid + high) / 3;

    // Extra smoothing on top of the analyser's own, for calm visuals.
    const k = 0.25;
    this.bands = {
      low: lerp(this.bands.low, low, k),
      mid: lerp(this.bands.mid, mid, k),
      high: lerp(this.bands.high, high, k),
      level: lerp(this.bands.level, level, k),
    };
    return this.bands;
  }

  get isPlaying(): boolean {
    return !!this.current && !this.current.el.paused;
  }
}

function avg(data: Uint8Array, start: number, end: number): number {
  if (end <= start) return 0;
  let sum = 0;
  for (let i = start; i < end; i++) sum += data[i];
  return sum / (end - start) / 255;
}

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}
