import "./styles.css";
import { getSimilarTracks } from "./lib/lastfm";
import { getChartArtists, resolveTrack } from "./lib/deezer";
import { AudioEngine, type Bands } from "./lib/audio";
import type { ArtistCard, JourneyPayload, Track } from "./lib/types";
import { TrainMachine, type TrainState } from "./train/state";
import { locomotiveSVG } from "./train/locomotive";
import { Landscape } from "./landscape";
import { Steam } from "./train/steam";

const PROMPTS = [
  "Where does <b>Bonobo</b> take you next?",
  "Ride the line out from <b>Khruangbin</b>",
  "Find the neighbours of <b>Aphex Twin</b>",
  "Depart from <b>Sault</b>",
  "What sits beside <b>FKA twigs</b>?",
];

const audio = new AudioEngine();
const train = new TrainMachine();

function el<T extends HTMLElement>(html: string): T {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild as T;
}

function mount() {
  const app = document.getElementById("app")!;
  app.append(
    el(`
    <section class="lounge">
      <canvas id="landscape"></canvas>
      <div class="brand">
        <h1>Frequency<span class="dot">.</span>Lounge</h1>
        <small>similarity as a train journey</small>
      </div>
      <form class="search" id="search">
        <input id="q" placeholder="Artist — Song   (e.g. Bonobo — Kerala)" autocomplete="off" />
        <button type="submit">DEPART</button>
      </form>
      <div class="prompt-rotator" id="rotator"></div>
      <div class="matches" id="matches"></div>
    </section>
  `),
    el(`
    <section class="railway">
      ${locomotiveSVG()}
      <div class="genres" id="genres"></div>
    </section>
  `),
  );
}

/** Rotating placeholder prompt text. */
function startRotator() {
  const node = document.getElementById("rotator")!;
  let i = 0;
  const show = () => {
    node.innerHTML = PROMPTS[i % PROMPTS.length];
    i++;
  };
  show();
  setInterval(show, 3800);
}

function parseQuery(raw: string): { artist: string; title: string } | null {
  const parts = raw.split(/\s+[—–-]\s+/);
  if (parts.length < 2) return null;
  return { artist: parts[0].trim(), title: parts.slice(1).join(" - ").trim() };
}

/** Build the promise the train waits on: similarity + a playable preview. */
async function loadJourney(artist: string, title: string): Promise<JourneyPayload> {
  const [destination, similarRaw] = await Promise.all([
    resolveTrack(artist, title),
    getSimilarTracks(artist, title, 12),
  ]);

  const dest: Track = destination ?? { title, artist };

  // Resolve previews for the similar tracks in parallel; keep the playable ones.
  const resolved = await Promise.all(
    similarRaw.map(async (t): Promise<Track | null> => {
      const d = await resolveTrack(t.artist, t.title).catch(() => null);
      return d ? { ...d, match: t.match } : null;
    }),
  );
  const similar = resolved.filter((t): t is Track => !!t).slice(0, 8);

  return { destination: dest, similar };
}

function renderMatches(tracks: Track[]) {
  const wrap = document.getElementById("matches")!;
  wrap.innerHTML = "";
  for (const t of tracks) {
    const card = el<HTMLElement>(`
      <div class="match-card">
        <div class="cover" style="background-image:url('${t.coverUrl ?? ""}')"></div>
        <div class="title">${escapeHtml(t.title)}</div>
        <div class="artist">${escapeHtml(t.artist)}</div>
        <div class="meter" style="width:${Math.round((t.match ?? 0.5) * 100)}%"></div>
      </div>
    `);
    card.addEventListener("click", () => go(t));
    wrap.append(card);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/** Recolor the whole app from the destination's audio profile (bands). */
function recolor(bands: Bands) {
  const root = document.documentElement.style;
  root.setProperty("--band-low", bands.low.toFixed(3));
  root.setProperty("--band-mid", bands.mid.toFixed(3));
  root.setProperty("--band-high", bands.high.toFixed(3));
}

/** Kick off a journey to a chosen track. */
async function go(track: Track) {
  const load = loadJourney(track.artist, track.title);
  train.depart(track, load);
  const payload = await load;
  if (payload.destination.previewUrl) {
    audio.play(payload.destination.previewUrl).catch(() => {});
  }
}

async function loadGenres() {
  const wrap = document.getElementById("genres")!;
  let artists: ArtistCard[] = [];
  try {
    artists = await getChartArtists(12);
  } catch {
    return;
  }
  wrap.innerHTML = "";
  for (const a of artists) {
    const card = el<HTMLElement>(`
      <div class="genre-card" style="background-image:url('${a.imageUrl ?? ""}')">
        <span>${escapeHtml(a.name)}</span>
      </div>
    `);
    card.addEventListener("click", () => go({ title: "", artist: a.name }));
    wrap.append(card);
  }
}

function wireStationSign(state: TrainState) {
  const station = document.getElementById("fl-station")!;
  const text = document.getElementById("fl-sign-text")!;
  if (state.phase === "arriving" || state.phase === "stationed") {
    const d = state.destination;
    text.textContent = d ? `${d.artist} — ${d.title}`.slice(0, 22) : "";
    station.setAttribute("opacity", "1");
  } else {
    station.setAttribute("opacity", "0");
  }
}

function main() {
  mount();
  startRotator();
  loadGenres();

  const landscape = new Landscape(document.getElementById("landscape") as HTMLCanvasElement);
  const steam = new Steam(document.getElementById("fl-steam") as unknown as SVGGElement);
  const track = document.getElementById("fl-track")!;
  const wheels = Array.from(document.querySelectorAll<SVGGElement>(".fl-wheel"));
  const windows = Array.from(document.querySelectorAll<SVGRectElement>(".fl-window-glow"));

  let trackOffset = 0;
  let wheelAngle = 0;

  train.subscribe(wireStationSign);

  const frame = () => {
    const bands = audio.sample();
    const s = train.snapshot;

    // Visuals driven by audio bands.
    landscape.draw(bands);
    recolor(bands);
    windows.forEach((w, i) => {
      const b = [bands.low, bands.mid, bands.high][i % 3];
      w.style.opacity = String(0.18 + b * 0.7);
    });

    // Train motion driven by speed; scroll speed ties to BPM.
    const bpm = s.bpm || 120;
    const pxPerSec = s.speed * (bpm / 120) * 260;
    trackOffset = (trackOffset + pxPerSec / 60) % 30;
    track.setAttribute("transform", `translate(${-trackOffset} 0)`);

    wheelAngle = (wheelAngle + s.speed * 8) % 360;
    wheels.forEach((w) => {
      const base = w.getAttribute("transform") ?? "";
      const t = base.replace(/ rotate\([^)]*\)/, "");
      w.setAttribute("transform", `${t} rotate(${wheelAngle})`);
    });

    // Steam puff rate = BPM (only while moving).
    steam.update(s.speed > 0.02 ? bpm : 0, bands.low);

    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  document.getElementById("search")!.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = (document.getElementById("q") as HTMLInputElement).value;
    const parsed = parseQuery(q);
    if (!parsed) return;
    go({ artist: parsed.artist, title: parsed.title });
  });

  train.subscribe((s) => {
    if (s.phase === "stationed") renderMatches(s.similar);
  });
}

main();
