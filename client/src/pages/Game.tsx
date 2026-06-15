import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChatMessage,
  GameCurrentState,
  GameOverPayload,
  GuessedPayload,
  GuessResultPayload,
  PlayerScore,
  Song,
  SongEndPayload,
  SongStartPayload,
} from 'shared/types';
import socket, { playerId } from '../socket';
import Chat from '../components/Chat';
import Scoreboard from '../components/Scoreboard';

type Phase = 'waiting' | 'playing' | 'revealing' | 'over';

export default function Game() {
  useParams<{ code: string }>();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('waiting');
  const [ready, setReady] = useState(false);
  const [totalSongs, setTotalSongs] = useState(0);
  const [songIndex, setSongIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [scores, setScores] = useState<PlayerScore[]>([]);
  const [revealedSong, setRevealedSong] = useState<Song | null>(null);
  const [titleGuessedBy, setTitleGuessedBy] = useState<string | null>(null);
  const [artistGuessedBy, setArtistGuessedBy] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [finalScores, setFinalScores] = useState<PlayerScore[]>([]);

  const audioRef = useRef<HTMLAudioElement>(null);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const songStartTime = useRef(0);
  const pendingPreviewUrl = useRef<string | null>(null);
  const pendingDuration = useRef(0);

  function playSong(previewUrl: string, duration: number) {
    if (!audioRef.current) return;
    audioRef.current.src = previewUrl;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => null);

    songStartTime.current = Date.now();
    if (progressInterval.current) clearInterval(progressInterval.current);
    progressInterval.current = setInterval(() => {
      const elapsed = Date.now() - songStartTime.current;
      setProgress(Math.min(elapsed / duration, 1));
      if (elapsed >= duration) {
        if (progressInterval.current) clearInterval(progressInterval.current);
      }
    }, 200);
  }

  function handleReady() {
    if (!audioRef.current) return;
    // Trigger a silent play to unlock autoplay policy, then play pending song if any
    audioRef.current.src =
      'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
    audioRef.current.play().then(() => {
      audioRef.current!.pause();
      audioRef.current!.src = '';
      setReady(true);
      if (pendingPreviewUrl.current) {
        playSong(pendingPreviewUrl.current, pendingDuration.current);
        pendingPreviewUrl.current = null;
      }
    }).catch(() => setReady(true));
  }

  useEffect(() => {
    // Reconnect and rejoin if page was refreshed
    if (!socket.connected) {
      const lobbyCode = sessionStorage.getItem('mg_lobbyCode');
      const storedUsername = sessionStorage.getItem('mg_username');
      if (!lobbyCode || !storedUsername) { navigate('/'); return; }
      socket.connect();
      socket.once('connect', () => {
        socket.emit('lobby:join', { code: lobbyCode, username: storedUsername, playerId });
      });
    }

    socket.on('game:started', ({ totalSongs: t }: { totalSongs: number }) => {
      setTotalSongs(t);
      setPhase('waiting');
      setMessages([]);
    });

    socket.on('game:song-start', (payload: SongStartPayload) => {
      setSongIndex(payload.songIndex);
      setTotalSongs(payload.totalSongs);
      setRevealedSong(null);
      setTitleGuessedBy(null);
      setArtistGuessedBy(null);
      setPhase('playing');
      setProgress(0);
      songStartTime.current = Date.now();

      if (ready) {
        playSong(payload.previewUrl, payload.duration);
      } else {
        // User hasn't clicked Ready yet — buffer the song
        pendingPreviewUrl.current = payload.previewUrl;
        pendingDuration.current = payload.duration;
      }
    });

    socket.on('game:guessed', (payload: GuessedPayload) => {
      if (payload.type === 'title' || payload.type === 'both') {
        setTitleGuessedBy(payload.byUsername);
      }
      if (payload.type === 'artist' || payload.type === 'both') {
        setArtistGuessedBy(payload.byUsername);
      }
    });

    socket.on('game:song-end', (payload: SongEndPayload) => {
      setPhase('revealing');
      setRevealedSong(payload.song);
      setScores(payload.scores);
      setProgress(1);
      pendingPreviewUrl.current = null;

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      if (progressInterval.current) clearInterval(progressInterval.current);
    });

    socket.on('game:chat', (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('game:over', (payload: GameOverPayload) => {
      setFinalScores(payload.finalScores);
      setPhase('over');
      sessionStorage.removeItem('mg_lobbyCode');
      if (audioRef.current) audioRef.current.pause();
    });

    // Sent when rejoining mid-song after a refresh
    socket.on('game:current-state', (state: GameCurrentState) => {
      setSongIndex(state.songIndex);
      setTotalSongs(state.totalSongs);
      setScores(state.scores);
      setTitleGuessedBy(state.titleGuessedBy);
      setArtistGuessedBy(state.artistGuessedBy);
      setPhase('playing');
      setProgress(state.elapsedMs / state.duration);
      songStartTime.current = Date.now() - state.elapsedMs;

      if (ready) {
        playSong(state.previewUrl, state.duration);
      } else {
        pendingPreviewUrl.current = state.previewUrl;
        pendingDuration.current = state.duration;
      }
    });

    return () => {
      socket.off('game:started');
      socket.off('game:song-start');
      socket.off('game:guessed');
      socket.off('game:song-end');
      socket.off('game:chat');
      socket.off('game:over');
      socket.off('game:current-state');
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, [navigate, ready]);

  function sendGuess(text: string) {
    socket.emit('game:guess', text);
  }

  function handleGuessResult(result: GuessResultPayload) {
    setScores((prev) =>
      prev.map((s) =>
        s.playerId === socket.id ? { ...s, score: result.totalScore } : s
      )
    );
  }

  useEffect(() => {
    socket.on('game:guess-result', handleGuessResult);
    return () => { socket.off('game:guess-result', handleGuessResult); };
  }, []);

  if (phase === 'over') {
    return (
      <div className="page">
        <div className="game-over fade-in">
          <h1>Game Over!</h1>
          <p className="subtitle">Final scores</p>
          <div className="score-list" style={{ marginBottom: 24 }}>
            {finalScores.map((s, i) => (
              <div key={s.playerId} className="score-item">
                <span className={`score-rank ${i === 0 ? 'top' : ''}`}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                </span>
                <span className="score-username">{s.username}</span>
                <span className="score-pts">{s.score} pts</span>
              </div>
            ))}
          </div>
          <button className="btn-primary" onClick={() => navigate('/')}>Back to Home</button>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="page">
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 48 }}>🎵</div>
          <h2 style={{ fontSize: 24 }}>Ready to play?</h2>
          <p style={{ color: 'var(--text-dim)' }}>
            {phase === 'playing'
              ? 'Song in progress — click to resume audio'
              : `${totalSongs > 0 ? `${totalSongs} songs` : 'Game starting'} · click to enable audio`}
          </p>
          <button className="btn-primary" style={{ fontSize: 16, padding: '14px 36px' }} onClick={handleReady}>
            {phase === 'playing' ? 'Resume' : "I'm Ready!"}
          </button>
        </div>
        <audio ref={audioRef} />
      </div>
    );
  }

  return (
    <div className="game-layout">
      <Scoreboard scores={scores} myId={socket.id ?? ''} />

      <div className="game-center">
        <p className="song-counter">Song {songIndex + 1} of {totalSongs}</p>

        <div style={{ position: 'relative' }}>
          {phase === 'revealing' && revealedSong?.albumArt ? (
            <img
              src={revealedSong.albumArt}
              alt="album art"
              className="album-art fade-in"
              style={{ display: 'block' }}
            />
          ) : (
            <div className="album-art" style={{ fontSize: 60 }}>🎵</div>
          )}
        </div>

        {phase === 'revealing' && revealedSong && (
          <div className="song-reveal fade-in">
            <div className="song-title">{revealedSong.title}</div>
            <div className="song-artist">{revealedSong.artists.join(', ')}</div>
          </div>
        )}

        <div className="progress-bar-wrap" style={{ width: 320 }}>
          <div
            className="progress-bar-fill"
            style={{ width: `${progress * 100}%`, transition: phase === 'revealing' ? 'none' : 'width 0.2s linear' }}
          />
        </div>

        {phase === 'playing' && (
          <div className="guess-badges">
            <span className={`guess-badge ${titleGuessedBy ? 'locked' : 'unlocked'}`}>
              {titleGuessedBy ? `Title: ${titleGuessedBy}` : 'Title'}
            </span>
            <span className={`guess-badge ${artistGuessedBy ? 'locked' : 'unlocked'}`}>
              {artistGuessedBy ? `Artist: ${artistGuessedBy}` : 'Artist'}
            </span>
          </div>
        )}
      </div>

      <Chat
        messages={messages}
        onSend={sendGuess}
        disabled={phase !== 'playing'}
        myId={socket.id ?? ''}
      />

      <audio ref={audioRef} preload="auto" />
    </div>
  );
}
