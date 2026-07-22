export interface Track {
  title: string;
  artist: string;
  /** Last.fm match score 0..1 when it came from a similarity query */
  match?: number;
  /** Deezer enrichment — filled in by resolveTrack() */
  deezerId?: number;
  previewUrl?: string;
  coverUrl?: string;
  artistImageUrl?: string;
  bpm?: number;
  durationSec?: number;
}

export interface ArtistCard {
  name: string;
  imageUrl?: string;
  deezerId?: number;
}

/** Everything a "departure" needs to have resolved before the train may arrive. */
export interface JourneyPayload {
  destination: Track;
  similar: Track[];
}
