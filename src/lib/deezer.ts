import type { ArtistCard, Track } from "./types";

// Everything goes through the proxy (vite.config.ts in dev, /api on Vercel).
const BASE = "/api/deezer";

async function deezer<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(BASE + path, location.origin);
  if (params) url.search = new URLSearchParams(params).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`deezer ${path} failed: ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`deezer error: ${json.error.message ?? "unknown"}`);
  return json as T;
}

interface DeezerTrack {
  id: number;
  title: string;
  preview: string;
  duration: number;
  bpm?: number;
  artist: { id: number; name: string; picture_medium?: string };
  album: { cover_medium?: string; cover_big?: string };
}

/** Wrap a raw dzcdn preview URL so it streams through our proxy. */
export function proxiedPreviewUrl(rawUrl: string): string {
  return `/api/preview?url=${encodeURIComponent(rawUrl)}`;
}

export async function searchTrack(artist: string, title: string): Promise<Track | null> {
  const json = await deezer<{ data?: DeezerTrack[] }>("/search", {
    q: `artist:"${artist}" track:"${title}"`,
    limit: "1",
  });
  const hit = json.data?.[0];
  if (!hit) return null;
  return toTrack(hit);
}

/** track/<id> carries bpm; search results don't. Call when BPM matters. */
export async function getTrackDetail(deezerId: number): Promise<Track> {
  return toTrack(await deezer<DeezerTrack>(`/track/${deezerId}`));
}

function toTrack(d: DeezerTrack): Track {
  return {
    title: d.title,
    artist: d.artist.name,
    deezerId: d.id,
    previewUrl: d.preview ? proxiedPreviewUrl(d.preview) : undefined,
    coverUrl: d.album?.cover_big ?? d.album?.cover_medium,
    artistImageUrl: d.artist?.picture_medium,
    bpm: d.bpm && d.bpm > 0 ? d.bpm : undefined,
    durationSec: d.duration,
  };
}

interface DeezerArtist {
  id: number;
  name: string;
  picture_medium?: string;
  picture_big?: string;
}

export async function searchArtist(name: string): Promise<ArtistCard | null> {
  const json = await deezer<{ data?: DeezerArtist[] }>("/search/artist", {
    q: name,
    limit: "1",
  });
  const hit = json.data?.[0];
  if (!hit) return null;
  return { name: hit.name, imageUrl: hit.picture_big ?? hit.picture_medium, deezerId: hit.id };
}

/** Top artists from Deezer charts — genre carousel covers. */
export async function getChartArtists(limit = 10): Promise<ArtistCard[]> {
  const json = await deezer<{ artists?: { data?: DeezerArtist[] } }>("/chart", {
    limit: String(limit),
  });
  return (json.artists?.data ?? []).map((a) => ({
    name: a.name,
    imageUrl: a.picture_big ?? a.picture_medium,
    deezerId: a.id,
  }));
}

/**
 * Last.fm gives us (artist, title); Deezer gives us playable preview + art + bpm.
 * This is the join. Returns null when Deezer has no match or no preview.
 */
export async function resolveTrack(artist: string, title: string): Promise<Track | null> {
  const base = await searchTrack(artist, title);
  if (!base?.previewUrl) return null;
  if (base.deezerId && base.bpm === undefined) {
    try {
      const detail = await getTrackDetail(base.deezerId);
      return { ...base, bpm: detail.bpm };
    } catch {
      return base;
    }
  }
  return base;
}
