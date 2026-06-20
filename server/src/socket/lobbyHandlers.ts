import { Server, Socket } from 'socket.io';
import { GameCurrentState, PlayerScore, SpotifyPlaylist } from '../../../shared/types';
import {
  getLobby,
  lobbyToInfo,
  LobbyState,
} from '../state/lobbyStore';
import { startGame, cleanupLobby } from '../game/gameLoop';
import { getPlaylistTracks } from '../services/deezer';
import { getPlaylistTracks as getSpotifyPlaylistTracks } from '../services/spotify';

export function setupLobbyHandlers(io: Server, socket: Socket): void {
  socket.on(
    'lobby:join',
    (
      data: { code: string; username: string; playerId: string },
      callback?: (res: { error?: string }) => void
    ) => {
      const { code, username, playerId } = data;
      if (!username?.trim()) { callback?.({ error: 'Username is required' }); return; }

      const lobby = getLobby(code);
      if (!lobby) { callback?.({ error: 'Lobby not found' }); return; }

      // --- Rejoin: same stable playerId, new socket ---
      const existingSocketId = lobby.playerIds.get(playerId);
      if (existingSocketId) {
        const existingPlayer = lobby.players.get(existingSocketId);
        if (existingPlayer) {
          // Transfer state to new socket
          lobby.players.delete(existingSocketId);
          const rejoined = { ...existingPlayer, id: socket.id, isHost: lobby.hostId === existingSocketId };
          lobby.players.set(socket.id, rejoined);
          lobby.playerIds.set(playerId, socket.id);

          if (lobby.hostId === existingSocketId) lobby.hostId = socket.id;

          // Update game score/guess tracking to new socket.id if mid-game
          if (lobby.game) {
            const gained = lobby.game.songScores.get(existingSocketId) ?? 0;
            lobby.game.songScores.delete(existingSocketId);
            if (gained) lobby.game.songScores.set(socket.id, gained);

            if (lobby.game.titleGuessers.has(existingSocketId)) {
              lobby.game.titleGuessers.delete(existingSocketId);
              lobby.game.titleGuessers.add(socket.id);
            }
            if (lobby.game.artistGuessers.has(existingSocketId)) {
              lobby.game.artistGuessers.delete(existingSocketId);
              lobby.game.artistGuessers.add(socket.id);
            }
          }

          socket.data.lobbyCode = code;
          socket.join(code);

          callback?.({});
          socket.emit('lobby:state', lobbyToInfo(lobby));
          // Tell other players the player is back (their socket.id changed but the list is the same)
          io.to(code).emit('lobby:state', lobbyToInfo(lobby));

          // If mid-song, send current game state so client can resume
          if (lobby.state === 'playing' && lobby.game && !lobby.game.betweenSongs) {
            const { game } = lobby;
            const song = game.songs[game.currentSongIndex];
            const elapsedMs = Date.now() - game.songStartTime;
            const scores: PlayerScore[] = Array.from(lobby.players.values()).map((p) => ({
              playerId: p.id,
              username: p.username,
              score: p.score,
              gained: game.songScores.get(p.id) ?? 0,
              gainedByCategory: game.categoryScores.get(p.id) ?? {},
            }));
            const payload: GameCurrentState = {
              songIndex: game.currentSongIndex,
              totalSongs: game.songs.length,
              previewUrl: song.previewUrl,
              elapsedMs,
              duration: lobby.settings.songDuration,
              scores,
              guessMode: lobby.settings.guessMode,
              hasYear: song.year !== undefined,
            };
            socket.emit('game:current-state', payload);
          }
          return;
        }
        // Stale playerIds entry — fall through to normal join
        lobby.playerIds.delete(playerId);
      }

      // --- New join ---
      if (lobby.state === 'ended') { callback?.({ error: 'Game has ended' }); return; }

      const isFirst = lobby.players.size === 0;
      const player = { id: socket.id, playerId, username: username.trim(), score: 0, isHost: isFirst };
      lobby.players.set(socket.id, player);
      lobby.playerIds.set(playerId, socket.id);
      if (isFirst) lobby.hostId = socket.id;

      socket.data.lobbyCode = code;
      socket.join(code);

      callback?.({});
      socket.emit('lobby:state', lobbyToInfo(lobby));
      socket.to(code).emit('lobby:player-joined', { playerId: socket.id, username: player.username });

      // If joining mid-game, send them to the game page and let them request current state
      if (lobby.state === 'playing' && lobby.game) {
        const { game } = lobby;
        const scores: PlayerScore[] = Array.from(lobby.players.values()).map((p) => ({
          playerId: p.id,
          username: p.username,
          score: p.score,
          gained: game.songScores.get(p.id) ?? 0,
          gainedByCategory: game.categoryScores.get(p.id) ?? {},
        }));
        socket.emit('game:join-in-progress', {
          totalSongs: game.songs.length,
          initialScores: scores,
          guessMode: lobby.settings.guessMode,
          hostId: lobby.hostId,
        });
      }
    }
  );

  socket.on(
    'lobby:add-playlist',
    (playlist: SpotifyPlaylist, callback?: (res: { error?: string }) => void) => {
      const lobby = getPlayerLobby(socket);
      if (!lobby) { callback?.({ error: 'Not in a lobby' }); return; }
      if (lobby.playlists.find((p) => p.id === playlist.id)) { callback?.({}); return; }
      if (lobby.playlists.length >= 8) { callback?.({ error: 'Maximum 8 playlists' }); return; }

      lobby.playlists.push(playlist);
      io.to(lobby.code).emit('lobby:playlist-added', playlist);
      callback?.({});

      if (playlist.source === 'spotify') {
        // Fetch and cache Spotify tracks (with ISRCs) in the background.
        // playableCount shows Spotify's track count as an estimate (Deezer resolution happens at game start).
        getSpotifyPlaylistTracks(playlist.id).then((tracks) => {
          lobby.spotifyTracks.set(playlist.id, tracks);
          const idx = lobby.playlists.findIndex((p) => p.id === playlist.id);
          if (idx !== -1) {
            lobby.playlists[idx].playableCount = tracks.length;
            io.to(lobby.code).emit('lobby:playlist-updated', lobby.playlists[idx]);
          }
        }).catch(() => null);
      } else {
        // Deezer: fetch to get exact playable count (tracks with preview URLs)
        getPlaylistTracks(playlist.id).then((tracks) => {
          const idx = lobby.playlists.findIndex((p) => p.id === playlist.id);
          if (idx !== -1) {
            lobby.playlists[idx].playableCount = tracks.length;
            io.to(lobby.code).emit('lobby:playlist-updated', lobby.playlists[idx]);
          }
        }).catch(() => null);
      }
    }
  );

  socket.on(
    'lobby:remove-playlist',
    (playlistId: string, callback?: (res: { error?: string }) => void) => {
      const lobby = getPlayerLobby(socket);
      if (!lobby) { callback?.({ error: 'Not in a lobby' }); return; }
      if (lobby.hostId !== socket.id) { callback?.({ error: 'Only the host can change playlists' }); return; }

      lobby.playlists = lobby.playlists.filter((p) => p.id !== playlistId);
      lobby.spotifyTracks.delete(playlistId);
      io.to(lobby.code).emit('lobby:playlist-removed', { playlistId });
      callback?.({});
    }
  );

  socket.on(
    'lobby:update-settings',
    (settings: { songCount?: number; songDuration?: number; guessMode?: { title?: boolean; artist?: boolean; year?: boolean } }, callback?: (res: { error?: string }) => void) => {
      const lobby = getPlayerLobby(socket);
      if (!lobby) { callback?.({ error: 'Not in a lobby' }); return; }
      if (lobby.hostId !== socket.id) { callback?.({ error: 'Only the host can change settings' }); return; }

      if (settings.songCount !== undefined) {
        lobby.settings.songCount = Math.min(Math.max(settings.songCount, 1), 30);
      }
      if (settings.songDuration !== undefined) {
        lobby.settings.songDuration = Math.min(Math.max(settings.songDuration, 5000), 30000);
      }
      if (settings.guessMode !== undefined) {
        const next = { ...lobby.settings.guessMode, ...settings.guessMode };
        if (!next.title && !next.artist) { callback?.({ error: 'At least one category must be guessable' }); return; }
        lobby.settings.guessMode = next;
      }

      io.to(lobby.code).emit('lobby:state', lobbyToInfo(lobby));
      callback?.({});
    }
  );

  socket.on('lobby:play-again', (callback?: (res: { error?: string }) => void) => {
    const lobby = getPlayerLobby(socket);
    if (!lobby) { callback?.({ error: 'Lobby not found' }); return; }
    if (lobby.state !== 'ended') { callback?.({ error: 'Game not over yet' }); return; }

    lobby.state = 'waiting';
    lobby.game = null;
    for (const player of lobby.players.values()) {
      player.score = 0;
    }

    callback?.({});
    io.to(lobby.code).emit('lobby:reset', { code: lobby.code });
  });

  socket.on('lobby:start', async (callback?: (res: { error?: string }) => void) => {
    const lobby = getPlayerLobby(socket);
    if (!lobby) { callback?.({ error: 'Not in a lobby' }); return; }
    if (lobby.hostId !== socket.id) { callback?.({ error: 'Only the host can start the game' }); return; }
    if (lobby.playlists.length === 0) { callback?.({ error: 'Add at least one playlist first' }); return; }
    if (lobby.state !== 'waiting') { callback?.({ error: 'Game already started' }); return; }

    callback?.({});
    await startGame(io, lobby);
  });

  socket.on('lobby:leave', () => {
    const lobby = getPlayerLobby(socket);
    if (!lobby) return;

    const player = lobby.players.get(socket.id);
    if (!player) return;

    lobby.players.delete(socket.id);
    lobby.playerIds.delete(player.playerId);

    io.to(lobby.code).emit('lobby:player-left', { playerId: socket.id, username: player.username });

    if (lobby.hostId === socket.id) {
      const next = Array.from(lobby.players.values()).find((p) => p.id !== socket.id);
      if (next) {
        next.isHost = true;
        lobby.hostId = next.id;
        io.to(lobby.code).emit('lobby:state', lobbyToInfo(lobby));
      }
    }

    if (lobby.players.size === 0) {
      cleanupLobby(io, lobby.code);
    }

    socket.leave(lobby.code);
    socket.data.lobbyCode = undefined;
  });

  socket.on('disconnect', () => {
    handleDisconnect(io, socket);
  });
}

function getPlayerLobby(socket: Socket): LobbyState | undefined {
  const code = socket.data.lobbyCode as string | undefined;
  return code ? getLobby(code) : undefined;
}

function handleDisconnect(io: Server, socket: Socket): void {
  const code = socket.data.lobbyCode as string | undefined;
  if (!code) return;

  const lobby = getLobby(code);
  if (!lobby) return;

  const player = lobby.players.get(socket.id);
  if (!player) return;

  // Keep the player in the map (for rejoin) but mark socket as gone
  // Only fully remove if lobby is empty after a grace period
  io.to(code).emit('lobby:player-left', { playerId: socket.id, username: player.username });

  // Transfer host if needed immediately (in case game is ongoing and host disconnects)
  if (lobby.hostId === socket.id) {
    const next = Array.from(lobby.players.values()).find((p) => p.id !== socket.id);
    if (next) {
      next.isHost = true;
      lobby.hostId = next.id;
      io.to(code).emit('lobby:state', lobbyToInfo(lobby));
    }
  }

  // Remove after a grace period — gives time to rejoin before we clean up
  setTimeout(() => {
    const currentLobby = getLobby(code);
    if (!currentLobby) return;

    // If the player rejoined (socket.id changed), don't remove them
    const currentSocketId = currentLobby.playerIds.get(player.playerId);
    if (currentSocketId && currentSocketId !== socket.id) return;

    currentLobby.players.delete(socket.id);
    currentLobby.playerIds.delete(player.playerId);

    if (currentLobby.players.size === 0) {
      cleanupLobby(io, code);
    }
  }, 30_000); // 30-second rejoin window
}
