import { Server, Socket } from 'socket.io';
import { ChatMessage } from '../../../shared/types';
import { getLobby } from '../state/lobbyStore';
import { checkGuess, calculatePoints } from '../services/gameEngine';

export function setupGameHandlers(io: Server, socket: Socket): void {
  socket.on('game:guess', (text: string) => {
    const code = socket.data.lobbyCode as string | undefined;
    if (!code) return;

    const lobby = getLobby(code);
    if (!lobby?.game || lobby.state !== 'playing' || lobby.game.betweenSongs) return;

    const player = lobby.players.get(socket.id);
    if (!player) return;

    const { game } = lobby;
    const song = game.songs[game.currentSongIndex];
    const elapsed = Date.now() - game.songStartTime;

    const { title: titleHit, artist: artistHit } = checkGuess(
      text,
      song,
      game.titleGuessers.has(socket.id),
      game.artistGuessers.has(socket.id)
    );

    let pointsGained = 0;
    let correct: 'title' | 'artist' | 'both' | undefined;

    const firstTitle = game.titleGuessers.size === 0;
    const firstArtist = game.artistGuessers.size === 0;

    if (titleHit && artistHit) {
      const titlePts = calculatePoints(50, elapsed, lobby.settings.songDuration);
      const artistPts = calculatePoints(50, elapsed, lobby.settings.songDuration);
      pointsGained = Math.round(titlePts * (firstTitle ? 1.5 : 1))
                   + Math.round(artistPts * (firstArtist ? 1.5 : 1));
      game.titleGuessers.add(socket.id);
      game.artistGuessers.add(socket.id);
      correct = 'both';
    } else if (titleHit) {
      const pts = calculatePoints(50, elapsed, lobby.settings.songDuration);
      pointsGained = Math.round(pts * (firstTitle ? 1.5 : 1));
      game.titleGuessers.add(socket.id);
      correct = 'title';
    } else if (artistHit) {
      const pts = calculatePoints(50, elapsed, lobby.settings.songDuration);
      pointsGained = Math.round(pts * (firstArtist ? 1.5 : 1));
      game.artistGuessers.add(socket.id);
      correct = 'artist';
    }

    if (pointsGained > 0) {
      player.score += pointsGained;
      game.songScores.set(socket.id, (game.songScores.get(socket.id) ?? 0) + pointsGained);

      socket.emit('game:guess-result', {
        correct,
        points: pointsGained,
        totalScore: player.score,
      });

      // Broadcast a system announcement (no guess text) so everyone sees who scored what
      io.to(code).emit('game:chat', {
        playerId: socket.id,
        username: player.username,
        text: '',
        timestamp: Date.now(),
        system: true,
        correct,
      } satisfies ChatMessage);
      return;
    }

    // Wrong guesses appear in chat for everyone
    const chatMsg: ChatMessage = {
      playerId: socket.id,
      username: player.username,
      text,
      timestamp: Date.now(),
    };
    io.to(code).emit('game:chat', chatMsg);
  });
}
