import { Server, Socket } from 'socket.io';
import { ChatMessage, GameCurrentState, GuessCategory, PlayerScore } from '../../../shared/types';
import { getLobby } from '../state/lobbyStore';
import { checkGuess, calculatePoints, checkClose } from '../services/gameEngine';

export function setupGameHandlers(io: Server, socket: Socket): void {
  socket.on('game:request-sync', () => {
    const code = socket.data.lobbyCode as string | undefined;
    if (!code) return;
    const lobby = getLobby(code);
    if (!lobby?.game || lobby.state !== 'playing' || lobby.game.betweenSongs) return;

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
      yearOptions: game.currentYearOptions,
    };
    socket.emit('game:current-state', payload);
  });

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

    const { title: titleHit, artist: artistHit, year: yearHit } = checkGuess(
      text,
      song,
      game.titleGuessers.has(socket.id),
      game.artistGuessers.has(socket.id),
      game.yearGuessers.has(socket.id),
      lobby.settings.guessMode
    );

    // Enforce one year attempt per song — but only when the input isn't also a valid title/artist guess
    const isYearText = /^\d{4}$/.test(text.trim()) && lobby.settings.guessMode.year;
    if (isYearText && !titleHit && !artistHit) {
      if (game.yearAttempted.has(socket.id)) {
        socket.emit('game:guess-result', { correct: [], points: 0, totalScore: player.score });
        return;
      }
      game.yearAttempted.add(socket.id);
    }

    const correct: GuessCategory[] = [];
    let pointsGained = 0;

    if (titleHit) {
      const pts = calculatePoints(50, elapsed, lobby.settings.songDuration);
      pointsGained += Math.round(pts * (game.titleGuessers.size === 0 ? 1.5 : 1));
      game.titleGuessers.add(socket.id);
      correct.push('title');
    }
    if (artistHit) {
      const pts = calculatePoints(50, elapsed, lobby.settings.songDuration);
      pointsGained += Math.round(pts * (game.artistGuessers.size === 0 ? 1.5 : 1));
      game.artistGuessers.add(socket.id);
      correct.push('artist');
    }
    const YEAR_POINTS = 25;
    if (yearHit) {
      pointsGained += YEAR_POINTS;
      game.yearGuessers.add(socket.id);
      correct.push('year');
    }

    if (pointsGained > 0) {
      player.score += pointsGained;
      game.songScores.set(socket.id, (game.songScores.get(socket.id) ?? 0) + pointsGained);

      // guessers sets already include this player at this point, so size===1 means first guesser
      const titlePts = titleHit ? Math.round(calculatePoints(50, elapsed, lobby.settings.songDuration) * (game.titleGuessers.size === 1 ? 1.5 : 1)) : 0;
      const artistPts = artistHit ? Math.round(calculatePoints(50, elapsed, lobby.settings.songDuration) * (game.artistGuessers.size === 1 ? 1.5 : 1)) : 0;
      const yearPts = yearHit ? YEAR_POINTS : 0;
      const catScores = game.categoryScores.get(socket.id) ?? {};
      if (titleHit) catScores.title = (catScores.title ?? 0) + titlePts;
      if (artistHit) catScores.artist = (catScores.artist ?? 0) + artistPts;
      if (yearHit) catScores.year = (catScores.year ?? 0) + yearPts;
      game.categoryScores.set(socket.id, catScores);

      const playerHasTitle = game.titleGuessers.has(socket.id);
      const playerHasArtist = game.artistGuessers.has(socket.id);
      const playerHasYear = game.yearGuessers.has(socket.id);
      socket.emit('game:guess-result', {
        correct,
        points: pointsGained,
        totalScore: player.score,
        revealedTitle: playerHasTitle ? song.title : undefined,
        revealedArtists: playerHasArtist ? song.artists : undefined,
        revealedAlbumArt: (playerHasTitle && playerHasArtist) ? song.albumArt : undefined,
        revealedYear: playerHasYear ? song.year : undefined,
      });

      // Broadcast live score update to all players in the room
      io.to(code).emit('game:score-update', {
        playerId: socket.id,
        score: player.score,
        gained: game.songScores.get(socket.id) ?? 0,
        gainedByCategory: game.categoryScores.get(socket.id) ?? {},
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

    const close = checkClose(
      text,
      song,
      game.titleGuessers.has(socket.id),
      game.artistGuessers.has(socket.id),
      lobby.settings.guessMode
    );

    if (close) {
      io.to(code).emit('game:chat', {
        playerId: socket.id,
        username: player.username,
        text: '',
        timestamp: Date.now(),
        system: true,
        close: true,
      } satisfies ChatMessage);
      return;
    }

    // Suppress year guesses from chat — feedback is handled by the button UI
    if (isYearText) {
      socket.emit('game:guess-result', { correct: [], points: 0, totalScore: player.score });
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
