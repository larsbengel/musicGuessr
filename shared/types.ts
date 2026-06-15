export interface Player {
  id: string;
  username: string;
  score: number;
  isHost: boolean;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  imageUrl: string | null;
  trackCount: number;
  owner: string;
  playableCount?: number; // resolved async after adding to lobby
}

export interface Song {
  id: string;
  title: string;
  artists: string[];
  albumArt: string | null;
  previewUrl: string;
  playlistName?: string;
}

export interface LobbyInfo {
  code: string;
  players: Player[];
  playlists: SpotifyPlaylist[];
  state: 'waiting' | 'playing' | 'ended';
  hostId: string;
  settings: GameSettings;
}

export interface GameSettings {
  songCount: number;
  songDuration: number; // ms
  guessMode: { title: boolean; artist: boolean };
}

export interface SongStartPayload {
  songIndex: number;
  totalSongs: number;
  previewUrl: string;
  duration: number; // ms
}

export interface PlayerScore {
  playerId: string;
  username: string;
  score: number;
  gained: number;
}

export interface SongEndPayload {
  song: Song;
  scores: PlayerScore[];
}

export interface GuessResultPayload {
  correct: 'title' | 'artist' | 'both' | null;
  points: number;
  totalScore: number;
  revealedTitle?: string;
  revealedArtists?: string[];
  revealedAlbumArt?: string | null; // null = song has no art; undefined = not yet unlocked
}

export interface ChatMessage {
  playerId: string;
  username: string;
  text: string;
  timestamp: number;
  system?: boolean;
  correct?: 'title' | 'artist' | 'both';
}

export interface GameOverPayload {
  finalScores: PlayerScore[];
  songs: Song[];
}

export interface GameCurrentState {
  songIndex: number;
  totalSongs: number;
  previewUrl: string;
  elapsedMs: number;
  duration: number;
  scores: PlayerScore[];
}
