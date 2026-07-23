import type { Bands } from "./lib/audio";

/**
 * A layered "frequency landscape": three parallax ridgelines whose heights are
 * displaced by the low/mid/high bands. Back ridge = lows (slow, tall), mid ridge
 * = mids, front ridge = highs (fast, jittery). Purely decorative; reads current
 * accent colours from CSS variables so it recolours with the rest of the app.
 */
export class Landscape {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private t = 0;
  private phase = [0, 0, 0];

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  private resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    this.w = r.width;
    this.h = r.height;
    this.canvas.width = r.width * dpr;
    this.canvas.height = r.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private accent(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#5eead4";
  }

  draw(bands: Bands) {
    const { ctx, w, h } = this;
    this.t += 0.006;
    ctx.clearRect(0, 0, w, h);

    const layers = [
      { band: bands.low, color: this.accent("--accent-low"), amp: 0.34, speed: 0.4, base: 0.92, freq: 1.4 },
      { band: bands.mid, color: this.accent("--accent-mid"), amp: 0.26, speed: 0.8, base: 0.82, freq: 2.6 },
      { band: bands.high, color: this.accent("--accent-high"), amp: 0.2, speed: 1.5, base: 0.72, freq: 4.8 },
    ];

    layers.forEach((L, i) => {
      this.phase[i] += L.speed * 0.01;
      const baseY = h * L.base;
      const amp = h * L.amp * (0.15 + L.band);

      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) {
        const nx = x / w;
        const y =
          baseY -
          Math.sin(nx * Math.PI * L.freq + this.phase[i]) * amp * 0.5 -
          Math.sin(nx * Math.PI * L.freq * 2.3 + this.t * L.speed) * amp * 0.5;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();

      const g = ctx.createLinearGradient(0, baseY - amp, 0, h);
      g.addColorStop(0, hexA(L.color, 0.14 + L.band * 0.22));
      g.addColorStop(1, hexA(L.color, 0.02));
      ctx.fillStyle = g;
      ctx.fill();

      ctx.strokeStyle = hexA(L.color, 0.35 + L.band * 0.35);
      ctx.lineWidth = 1.4;
      ctx.stroke();
    });
  }
}

/** Apply an alpha to a hex or rgb color string. */
function hexA(color: string, a: number): string {
  const c = color.trim();
  if (c.startsWith("#")) {
    const n = c.slice(1);
    const full = n.length === 3 ? n.split("").map((x) => x + x).join("") : n;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  return c;
}
