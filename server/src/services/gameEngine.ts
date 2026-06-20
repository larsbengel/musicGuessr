import { Song, SpotifyPlaylist } from '../../../shared/types';
import { LobbyState } from '../state/lobbyStore';
import { getPlaylistTracks, getTrackByIsrc } from './deezer';
import { getPlaylistTracks as getSpotifyPlaylistTracks, SpotifyTrackInfo } from './spotify';

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripExtras(s: string): string {
  return s
    .replace(/\s*\(.*?\)/g, '')   // (feat. ...), (Taylor's Version), (Remix), etc.
    .replace(/\s*\[.*?\]/g, '')   // [Radio Edit], etc.
    .replace(/\s*[-–—]\s*(feat|ft|remix|version|edit|remaster|live).*/i, '')
    .replace(/\s*(feat|ft)\.\s.*/i, '')  // feat. without parens
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    prev = curr;
  }
  return prev[n];
}

function closeThreshold(len: number): number {
  if (len < 4) return 0;
  if (len < 6) return 1;
  return 2;
}

function isCloseFuzzy(guess: string, target: string): boolean {
  const g = normalize(guess);
  const t = normalize(target);
  const tStripped = normalize(stripExtras(target));
  const best = tStripped.length >= 2 ? tStripped : t;
  const threshold = closeThreshold(best.length);
  if (threshold === 0) return false;
  if (levenshtein(g, t) <= threshold) return true;
  if (tStripped && levenshtein(g, tStripped) <= threshold) return true;
  return false;
}

export function checkClose(
  guess: string,
  song: Song,
  playerHasTitle: boolean,
  playerHasArtist: boolean,
  guessMode: { title: boolean; artist: boolean; year: boolean }
): boolean {
  if (guessMode.title && !playerHasTitle && isCloseFuzzy(guess, song.title)) return true;
  if (guessMode.artist && !playerHasArtist && song.artists.some((a) => isCloseFuzzy(guess, a))) return true;
  return false;
}

function isMatch(guess: string, target: string): boolean {
  const g = normalize(guess);
  const t = normalize(target);
  const tStripped = normalize(stripExtras(target));
  if (!g || t.length < 2) return false;
  if (g === t) return true;
  if (tStripped && g === tStripped) return true;
  if (t.length >= 3 && g.includes(t)) return true;
  if (tStripped.length >= 3 && g.includes(tStripped)) return true;
  // Fallback: compare with all spaces removed (handles e.g. "acdc" matching "AC/DC")
  const gNS = g.replace(/\s/g, '');
  const tNS = t.replace(/\s/g, '');
  const tStrippedNS = tStripped.replace(/\s/g, '');
  if (gNS && tNS.length >= 2 && gNS === tNS) return true;
  if (tStrippedNS && gNS === tStrippedNS) return true;
  return false;
}

export function checkGuess(
  guess: string,
  song: Song,
  playerHasTitle: boolean,
  playerHasArtist: boolean,
  playerHasYear: boolean,
  guessMode: { title: boolean; artist: boolean; year: boolean }
): { title: boolean; artist: boolean; year: boolean } {
  const trimmed = guess.trim();
  const yearGuess = /^\d{4}$/.test(trimmed) ? parseInt(trimmed, 10) : null;
  return {
    title: guessMode.title && !playerHasTitle && isMatch(guess, song.title),
    artist: guessMode.artist && !playerHasArtist && song.artists.some((a) => isMatch(guess, a)),
    year: guessMode.year && !playerHasYear && yearGuess !== null && song.year !== undefined && yearGuess === song.year,
  };
}

// Linear decay: full base points at t=0, 50% at t=duration
export function calculatePoints(base: number, elapsedMs: number, durationMs: number): number {
  const ratio = Math.min(elapsedMs / durationMs, 1);
  return Math.round(base * (1 - 0.5 * ratio));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function buildSpotifyPool(
  playlist: SpotifyPlaylist,
  spotifyTracks: SpotifyTrackInfo[],
  targetCount: number,
  fetchYears: boolean
): Promise<Song[]> {
  const shuffled = shuffle([...spotifyTracks]);
  const songs: Song[] = [];
  // Try all available tracks in batches — ISRC hit rate on Deezer is unpredictable,
  // so we can't cap attempts at a small multiple of targetCount.
  const BATCH = 5;

  for (let i = 0; i < shuffled.length && songs.length < targetCount; i += BATCH) {
    const batch = shuffled.slice(i, Math.min(i + BATCH, shuffled.length));
    const results = await Promise.all(
      batch.map(async (t) => {
        if (!t.isrc) return null;
        const song = await getTrackByIsrc(t.isrc);
        if (!song) return null;
        return {
          ...song,
          // Spotify provides the year directly — no extra album API call needed
          year: fetchYears ? t.year : undefined,
          playlistName: playlist.name,
        };
      })
    );
    for (const song of results) {
      if (song) songs.push(song);
    }
  }
  return songs;
}

export async function buildSongQueue(lobby: LobbyState): Promise<Song[]> {
  const fetchYears = lobby.settings.guessMode.year;
  const perPlaylist = Math.ceil(lobby.settings.songCount * 1.5 / Math.max(lobby.playlists.length, 1));

  const pools: Song[][] = await Promise.all(
    lobby.playlists.map(async (pl) => {
      if (pl.source === 'spotify') {
        // Use cached Spotify tracks; fall back to fetching if cache was lost (e.g. server restart)
        const spotifyTracks = lobby.spotifyTracks.get(pl.id) ?? await getSpotifyPlaylistTracks(pl.id);
        return buildSpotifyPool(pl, spotifyTracks, perPlaylist, fetchYears);
      }
      const tracks = await getPlaylistTracks(pl.id, fetchYears);
      return shuffle(tracks.map((t) => ({ ...t, playlistName: pl.name })));
    })
  );

  // Pull from playlists in shuffled rounds so the order is unpredictable but
  // each playlist still contributes equally within each round.
  const seen = new Set<string>();
  const queue: Song[] = [];
  const indices = new Array(pools.length).fill(0);

  while (queue.length < lobby.settings.songCount) {
    const playlistOrder = shuffle(pools.map((_, i) => i));
    let anyAdded = false;
    for (const playlistIndex of playlistOrder) {
      if (queue.length >= lobby.settings.songCount) break;
      const pool = pools[playlistIndex];
      while (indices[playlistIndex] < pool.length) {
        const track = pool[indices[playlistIndex]++];
        if (!seen.has(track.id)) {
          seen.add(track.id);
          queue.push(track);
          anyAdded = true;
          break;
        }
      }
    }
    if (!anyAdded) break; // all pools exhausted
  }

  return queue;
}
