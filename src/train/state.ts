import type { JourneyPayload, Track } from "../lib/types";

/**
 * The train is a state machine. A new song is a "departure": the train
 * accelerates and runs while the data loads, then decelerates into a station
 * once BOTH the Last.fm similarity list and a playable Deezer preview resolve.
 *
 *   idle ──depart──▶ departing ──▶ cruising ──arrive──▶ arriving ──▶ stationed
 *     ▲                                                                  │
 *     └──────────────────────── depart (new song) ─────────────────────┘
 */
export type TrainPhase =
  | "idle"
  | "departing"
  | "cruising"
  | "arriving"
  | "stationed";

export interface TrainState {
  phase: TrainPhase;
  /** 0..1 normalized speed; drives wheel spin, track scroll, steam rate. */
  speed: number;
  /** The track we're travelling toward (known at departure). */
  destination: Track | null;
  /** Similar tracks, populated on arrival. */
  similar: Track[];
  /** BPM of the destination once known; scroll speed ties to this. */
  bpm: number;
}

type Listener = (s: Readonly<TrainState>) => void;

const CRUISE_SPEED = 1;
const DEPART_RAMP = 1.4; // speed units per second
const ARRIVE_RAMP = 0.9;
const DEFAULT_BPM = 120;

export class TrainMachine {
  private state: TrainState = {
    phase: "idle",
    speed: 0,
    destination: null,
    similar: [],
    bpm: DEFAULT_BPM,
  };
  private listeners = new Set<Listener>();
  private pending: Promise<JourneyPayload> | null = null;
  private lastTs = 0;
  private raf = 0;

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  get snapshot(): Readonly<TrainState> {
    return this.state;
  }

  /**
   * Begin a journey toward `destination`. `load` resolves when similarity +
   * preview are both ready; the train won't arrive until it does. The train
   * always runs for at least one full acceleration so short loads still feel
   * like a trip.
   */
  depart(destination: Track, load: Promise<JourneyPayload>): void {
    this.state = {
      ...this.state,
      phase: "departing",
      destination,
      similar: [],
      bpm: destination.bpm ?? this.state.bpm,
    };
    this.emit();

    const minRun = new Promise<void>((r) => setTimeout(r, 1200));
    this.pending = load;
    const thisRun = load;

    Promise.all([load, minRun]).then(([payload]) => {
      // Ignore if a newer departure superseded this one.
      if (this.pending !== thisRun) return;
      this.state = {
        ...this.state,
        similar: payload.similar,
        destination: payload.destination,
        bpm: payload.destination.bpm ?? this.state.bpm,
      };
      this.beginArrival();
    });

    this.ensureLoop();
  }

  private beginArrival(): void {
    if (this.state.phase === "arriving" || this.state.phase === "stationed") return;
    this.state = { ...this.state, phase: "arriving" };
    this.emit();
  }

  /** rAF-driven speed integration between discrete phase changes. */
  private ensureLoop(): void {
    if (this.raf) return;
    this.lastTs = performance.now();
    const tick = (ts: number) => {
      const dt = Math.min((ts - this.lastTs) / 1000, 0.05);
      this.lastTs = ts;
      this.integrate(dt);
      if (this.needsLoop()) {
        this.raf = requestAnimationFrame(tick);
      } else {
        this.raf = 0;
      }
    };
    this.raf = requestAnimationFrame(tick);
  }

  private needsLoop(): boolean {
    const p = this.state.phase;
    if (p === "departing" || p === "arriving") return true;
    if (p === "cruising") return true; // keep sampling; cheap
    return false;
  }

  private integrate(dt: number): void {
    const s = this.state;
    let { speed, phase } = s;

    switch (phase) {
      case "departing":
        speed = Math.min(CRUISE_SPEED, speed + DEPART_RAMP * dt);
        if (speed >= CRUISE_SPEED) phase = "cruising";
        break;
      case "cruising":
        speed = CRUISE_SPEED;
        break;
      case "arriving":
        speed = Math.max(0, speed - ARRIVE_RAMP * dt);
        if (speed <= 0.001) {
          speed = 0;
          phase = "stationed";
        }
        break;
      default:
        break;
    }

    if (speed !== s.speed || phase !== s.phase) {
      this.state = { ...s, speed, phase };
      this.emit();
    }
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.state);
  }
}
