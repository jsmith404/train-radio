/**
 * Emits steam puffs from the chimney into the #fl-steam group. Puff *rate*
 * tracks BPM (one puff per beat); puff *size* tracks low-band energy, so a
 * heavy bass line gives fatter chimney bursts. Each puff rises, drifts, grows,
 * and fades, then is recycled.
 */

interface Puff {
  node: SVGCircleElement;
  life: number; // 0..1, 1 = just born
  x: number;
  y: number;
  vx: number;
  vy: number;
  r0: number;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const MAX_PUFFS = 24;

export class Steam {
  private puffs: Puff[] = [];
  private pool: SVGCircleElement[] = [];
  private lastEmit = 0;
  private lastTs = performance.now();

  constructor(private group: SVGGElement) {}

  private acquire(): SVGCircleElement {
    const node = this.pool.pop() ?? document.createElementNS(SVG_NS, "circle");
    node.setAttribute("class", "fl-puff");
    this.group.appendChild(node);
    return node;
  }

  private release(node: SVGCircleElement) {
    node.remove();
    this.pool.push(node);
  }

  /** @param bpm 0 to stop emitting. @param bass 0..1 low-band energy. */
  update(bpm: number, bass: number) {
    const now = performance.now();
    const dt = Math.min((now - this.lastTs) / 1000, 0.05);
    this.lastTs = now;

    if (bpm > 0) {
      const interval = 60000 / bpm; // ms per beat
      if (now - this.lastEmit >= interval && this.puffs.length < MAX_PUFFS) {
        this.lastEmit = now;
        this.emit(bass);
      }
    }

    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.life -= dt * 0.55;
      if (p.life <= 0) {
        this.release(p.node);
        this.puffs.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy *= 0.98;
      const grow = 1 + (1 - p.life) * 2.2;
      p.node.setAttribute("cx", p.x.toFixed(1));
      p.node.setAttribute("cy", p.y.toFixed(1));
      p.node.setAttribute("r", (p.r0 * grow).toFixed(1));
      p.node.setAttribute("opacity", (p.life * 0.5).toFixed(2));
    }
  }

  private emit(bass: number) {
    const node = this.acquire();
    const r0 = 5 + bass * 12;
    const p: Puff = {
      node,
      life: 1,
      x: (Math.random() - 0.5) * 6,
      y: 0,
      vx: 6 + Math.random() * 8, // drift back over the boiler
      vy: -34 - Math.random() * 16,
      r0,
    };
    node.setAttribute("cx", "0");
    node.setAttribute("cy", "0");
    node.setAttribute("r", String(r0));
    this.puffs.push(p);
  }
}
