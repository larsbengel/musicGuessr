import { Song } from '../../../shared/types';
import { LobbyState } from '../state/lobbyStore';
import { getPlaylistTracks } from './spotify';

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

function isMatch(guess: string, target: string): boolean {
  const g = normalize(guess);
  const t = normalize(target);
  const tStripped = normalize(stripExtras(target));
  if (!g || t.length < 2) return false;
  if (g === t) return true;
  if (tStripped && g === tStripped) return true;
  if (t.length >= 3 && g.includes(t)) return true;
  if (tStripped.length >= 3 && g.includes(tStripped)) return true;
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

export async function buildSongQueue(lobby: LobbyState): Promise<Song[]> {
  // Fetch and shuffle each playlist independently
  const pools: Song[][] = await Promise.all(
    lobby.playlists.map(async (pl) => {
      const tracks = await getPlaylistTracks(pl.id);
      return shuffle(tracks.map((t) => ({ ...t, playlistName: pl.name })));
    })
  );

  // Pull from playlists in shuffled rounds so the order is unpredictable but
  // each playlist still contributes equally within each round.
  const seen = new Set<string>();
  const queue: Song[] = [];
  const indices = new Array(pools.length).fill(0);

  const rounds = Math.ceil(lobby.settings.songCount / Math.max(pools.length, 1)) + 1;
  const deckOrder: number[] = [];
  for (let r = 0; r < rounds; r++) {
    deckOrder.push(...shuffle(pools.map((_, i) => i)));
  }

  for (const playlistIndex of deckOrder) {
    if (queue.length >= lobby.settings.songCount) break;
    const pool = pools[playlistIndex];
    while (indices[playlistIndex] < pool.length) {
      const track = pool[indices[playlistIndex]++];
      if (!seen.has(track.id)) {
        seen.add(track.id);
        queue.push(track);
        break;
      }
    }
    if (pools.every((p, i) => indices[i] >= p.length)) break;
  }

  return queue;
}
