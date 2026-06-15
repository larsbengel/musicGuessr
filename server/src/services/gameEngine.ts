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

function isMatch(guess: string, target: string): boolean {
  const g = normalize(guess);
  const t = normalize(target);
  if (!g || t.length < 2) return false;
  return g === t || (t.length >= 3 && (g.includes(t) || t.includes(g)));
}

export function checkGuess(
  guess: string,
  song: Song,
  playerHasTitle: boolean,
  playerHasArtist: boolean
): { title: boolean; artist: boolean } {
  return {
    title: !playerHasTitle && isMatch(guess, song.title),
    artist: !playerHasArtist && song.artists.some((a) => isMatch(guess, a)),
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
  const allSongs: Song[] = [];
  const seen = new Set<string>();

  for (const playlist of lobby.playlists) {
    const tracks = await getPlaylistTracks(playlist.id);
    for (const track of tracks) {
      if (!seen.has(track.id)) {
        seen.add(track.id);
        allSongs.push(track);
      }
    }
  }

  return shuffle(allSongs).slice(0, lobby.settings.songCount);
}
