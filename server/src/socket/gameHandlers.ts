import { Server, Socket } from 'socket.io';
import { ChatMessage } from '../../../shared/types';
import { getLobby } from '../state/lobbyStore';
import { checkGuess, calculatePoints } from '../services/gameEngine';
import { advanceSongIfComplete } from '../game/gameLoop';

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
      game.titleGuessedBy !== null,
      game.artistGuessedBy !== null
    );

    let pointsGained = 0;
    let correct: 'title' | 'artist' | 'both' | undefined;

    if (titleHit && artistHit) {
      const titlePts = calculatePoints(50, elapsed, lobby.settings.songDuration);
      const artistPts = calculatePoints(50, elapsed, lobby.settings.songDuration);
      pointsGained = titlePts + artistPts;
      game.titleGuessedBy = socket.id;
      game.artistGuessedBy = socket.id;
      correct = 'both';
    } else if (titleHit) {
      pointsGained = calculatePoints(50, elapsed, lobby.settings.songDuration);
      game.titleGuessedBy = socket.id;
      correct = 'title';
    } else if (artistHit) {
      pointsGained = calculatePoints(50, elapsed, lobby.settings.songDuration);
      game.artistGuessedBy = socket.id;
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

      io.to(code).emit('game:guessed', {
        type: correct,
        byUsername: player.username,
      });
    }

    // Broadcast to all as chat (masked when not correct)
    const chatMsg: ChatMessage = {
      playerId: socket.id,
      username: player.username,
      text,
      timestamp: Date.now(),
      correct,
    };
    io.to(code).emit('game:chat', chatMsg);

    // If both title and artist are now guessed, end song early
    if (game.titleGuessedBy && game.artistGuessedBy) {
      advanceSongIfComplete(io, code);
    }
  });
}
