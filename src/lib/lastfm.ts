import type { Track } from "./types";

const API = "https://ws.audioscrobbler.com/2.0/";
const KEY = import.meta.env.VITE_LASTFM_API_KEY as string | undefined;

async function lastfm<T>(params: Record<string, string>): Promise<T> {
  if (!KEY) throw new Error("VITE_LASTFM_API_KEY is not set — add it to .env");
  const url = new URL(API);
  url.search = new URLSearchParams({ ...params, api_key: KEY, format: "json" }).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`last.fm ${params.method} failed: ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`last.fm error ${json.error}: ${json.message}`);
  return json as T;
}

interface SimilarTracksResponse {
  similartracks?: {
    track?: Array<{ name: string; match: string; artist: { name: string } }>;
  };
}

export async function getSimilarTracks(
  artist: string,
  track: string,
  limit = 12,
): Promise<Track[]> {
  const json = await lastfm<SimilarTracksResponse>({
    method: "track.getsimilar",
    artist,
    track,
    autocorrect: "1",
    limit: String(limit),
  });
  return (json.similartracks?.track ?? []).map((t) => ({
    title: t.name,
    artist: t.artist.name,
    match: Number(t.match),
  }));
}

interface SimilarArtistsResponse {
  similarartists?: { artist?: Array<{ name: string; match: string }> };
}

export async function getSimilarArtists(artist: string, limit = 10): Promise<string[]> {
  const json = await lastfm<SimilarArtistsResponse>({
    method: "artist.getsimilar",
    artist,
    autocorrect: "1",
    limit: String(limit),
  });
  return (json.similarartists?.artist ?? []).map((a) => a.name);
}

interface TagTopArtistsResponse {
  topartists?: { artist?: Array<{ name: string }> };
}

export async function getTagTopArtists(tag: string, limit = 10): Promise<string[]> {
  const json = await lastfm<TagTopArtistsResponse>({
    method: "tag.gettopartists",
    tag,
    limit: String(limit),
  });
  return (json.topartists?.artist ?? []).map((a) => a.name);
}
