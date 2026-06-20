import { type GuessCategory, LobbyInfo, Player, Song, SpotifyPlaylist } from '../../../shared/types';
import { SpotifyTrackInfo } from '../services/spotify';

export interface PlayerState {
  id: string;       // socket.id — changes on reconnect
  playerId: string; // stable client-generated UUID
  username: string;
  score: number;
  isHost: boolean;
}

export interface GameState {
  songs: Song[];
  currentSongIndex: number;
  songStartTime: number;
  titleGuessers: Set<string>;   // socket IDs that already scored the title this song
  artistGuessers: Set<string>;  // socket IDs that already scored the artist this song
  yearGuessers: Set<string>;    // socket IDs that already scored the year this song
  songTimer: NodeJS.Timeout | null;
  betweenSongs: boolean;
  songScores: Map<string, number>;
  categoryScores: Map<string, Partial<Record<GuessCategory, number>>>;
}

export interface LobbyState {
  code: string;
  players: Map<string, PlayerState>;    // socket.id → PlayerState
  playerIds: Map<string, string>;       // stable playerId → current socket.id
  playlists: SpotifyPlaylist[];
  spotifyTracks: Map<string, SpotifyTrackInfo[]>; // playlistId → cached Spotify track list
  state: 'waiting' | 'playing' | 'ended';
  hostId: string;
  settings: {
    songCount: number;
    songDuration: number; // ms
    guessMode: { title: boolean; artist: boolean; year: boolean };
  };
  game: GameState | null;
}

const lobbies = new Map<string, LobbyState>();

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  let code: string;
  do {
    code = Array.from(
      { length: 6 },
      () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    ).join('');
  } while (lobbies.has(code));
  return code;
}

export function createLobby(): string {
  const code = generateCode();
  const lobby: LobbyState = {
    code,
    players: new Map(),
    playerIds: new Map(),
    playlists: [],
    spotifyTracks: new Map(),
    state: 'waiting',
    hostId: '',
    settings: {
      songCount: 10,
      songDuration: 20000,
      guessMode: { title: true, artist: true, year: false },
    },
    game: null,
  };
  lobbies.set(code, lobby);
  return code;
}

export function getLobby(code: string): LobbyState | undefined {
  return lobbies.get(code);
}

export function deleteLobby(code: string): void {
  lobbies.delete(code);
}

export function lobbyToInfo(lobby: LobbyState): LobbyInfo {
  const players: Player[] = Array.from(lobby.players.values()).map((p) => ({
    id: p.id,
    username: p.username,
    score: p.score,
    isHost: p.isHost,
  }));
  return {
    code: lobby.code,
    players,
    playlists: lobby.playlists,
    state: lobby.state,
    hostId: lobby.hostId,
    settings: {
      ...lobby.settings,
      guessMode: lobby.settings.guessMode ?? { title: true, artist: true, year: false },
    },
  };
}
