import { Server } from 'socket.io';
import { PlayerScore, SongEndPayload, SongStartPayload } from '../../../shared/types';
import { deleteLobby, getLobby, LobbyState } from '../state/lobbyStore';
import { buildSongQueue } from '../services/gameEngine';

const BETWEEN_SONG_DELAY = 4000; // ms between songs
const GAME_START_DELAY = 3000;   // ms before first song

export async function startGame(io: Server, lobby: LobbyState): Promise<void> {
  let songs;
  try {
    songs = await buildSongQueue(lobby);
  } catch (err) {
    io.to(lobby.code).emit('lobby:error', { message: 'Failed to load songs. Check server logs.' });
    return;
  }

  if (songs.length === 0) {
    io.to(lobby.code).emit('lobby:error', { message: 'No playable songs found (playlists may lack preview URLs).' });
    return;
  }

  lobby.state = 'playing';
  lobby.game = {
    songs,
    currentSongIndex: -1,
    songStartTime: 0,
    titleGuessers: new Set(),
    artistGuessers: new Set(),
    yearGuessers: new Set(),
    songTimer: null,
    betweenSongs: true,
    songScores: new Map(),
  };

  // Reset scores
  for (const player of lobby.players.values()) {
    player.score = 0;
  }

  const initialScores: PlayerScore[] = Array.from(lobby.players.values()).map((p) => ({
    playerId: p.id,
    username: p.username,
    score: 0,
    gained: 0,
  }));

  io.to(lobby.code).emit('game:started', { totalSongs: songs.length, initialScores });

  setTimeout(() => playNextSong(io, lobby.code), GAME_START_DELAY);
}

function playNextSong(io: Server, code: string): void {
  const lobby = getLobby(code);
  if (!lobby?.game) return;

  lobby.game.currentSongIndex += 1;

  if (lobby.game.currentSongIndex >= lobby.game.songs.length) {
    endGame(io, lobby);
    return;
  }

  const song = lobby.game.songs[lobby.game.currentSongIndex];
  lobby.game.songStartTime = Date.now();
  lobby.game.titleGuessers = new Set();
  lobby.game.artistGuessers = new Set();
  lobby.game.yearGuessers = new Set();
  lobby.game.betweenSongs = false;
  lobby.game.songScores = new Map();

  const payload: SongStartPayload = {
    songIndex: lobby.game.currentSongIndex,
    totalSongs: lobby.game.songs.length,
    previewUrl: song.previewUrl,
    duration: lobby.settings.songDuration,
  };

  io.to(code).emit('game:song-start', payload);

  lobby.game.songTimer = setTimeout(() => {
    endSong(io, code);
  }, lobby.settings.songDuration);
}

function endSong(io: Server, code: string): void {
  const lobby = getLobby(code);
  if (!lobby?.game) return;

  if (lobby.game.songTimer) {
    clearTimeout(lobby.game.songTimer);
    lobby.game.songTimer = null;
  }

  lobby.game.betweenSongs = true;

  const song = lobby.game.songs[lobby.game.currentSongIndex];
  const scores: PlayerScore[] = Array.from(lobby.players.values()).map((p) => ({
    playerId: p.id,
    username: p.username,
    score: p.score,
    gained: lobby.game!.songScores.get(p.id) ?? 0,
  }));

  const payload: SongEndPayload = { song, scores };
  io.to(code).emit('game:song-end', payload);

  setTimeout(() => playNextSong(io, code), BETWEEN_SONG_DELAY);
}

function endGame(io: Server, lobby: LobbyState): void {
  lobby.state = 'ended';

  const finalScores: PlayerScore[] = Array.from(lobby.players.values())
    .map((p) => ({ playerId: p.id, username: p.username, score: p.score, gained: 0 }))
    .sort((a, b) => b.score - a.score);

  io.to(lobby.code).emit('game:over', {
    finalScores,
    songs: lobby.game?.songs ?? [],
  });
}

export function cleanupLobby(io: Server, code: string): void {
  const lobby = getLobby(code);
  if (!lobby) return;
  if (lobby.game?.songTimer) {
    clearTimeout(lobby.game.songTimer);
  }
  deleteLobby(code);
}
