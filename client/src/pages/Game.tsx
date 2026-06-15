import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChatMessage,
  GameCurrentState,
  GameOverPayload,
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
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('waiting');
  const [ready, setReady] = useState(false);
  const [totalSongs, setTotalSongs] = useState(0);
  const [songIndex, setSongIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [scores, setScores] = useState<PlayerScore[]>([]);
  const [revealedSong, setRevealedSong] = useState<Song | null>(null);
  const [myTitle, setMyTitle] = useState<string | null>(null);
  const [myArtists, setMyArtists] = useState<string[] | null>(null);
  const [myAlbumArt, setMyAlbumArt] = useState<string | null | undefined>(undefined);
  const [guessToast, setGuessToast] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [finalScores, setFinalScores] = useState<PlayerScore[]>([]);
  const [playedSongs, setPlayedSongs] = useState<Song[]>([]);

  const [volume, setVolume] = useState<number>(() => {
    const saved = localStorage.getItem('mg_volume');
    return saved !== null ? parseFloat(saved) : 0.8;
  });

  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const songStartTime = useRef(0);
  const pendingPreviewUrl = useRef<string | null>(null);
  const pendingDuration = useRef(0);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    localStorage.setItem('mg_volume', String(volume));
  }, [volume, ready]);

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
      const storedUsername = localStorage.getItem('mg_username');
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
      setMyTitle(null);
      setMyArtists(null);
      setMyAlbumArt(undefined);
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
      setPlayedSongs(payload.songs);
      setPhase('over');
      if (audioRef.current) audioRef.current.pause();
    });

    socket.on('lobby:reset', () => {
      navigate(`/lobby/${code}`);
    });

    // Sent when rejoining mid-song after a refresh
    socket.on('game:current-state', (state: GameCurrentState) => {
      setSongIndex(state.songIndex);
      setTotalSongs(state.totalSongs);
      setScores(state.scores);
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
      socket.off('game:song-end');
      socket.off('game:chat');
      socket.off('game:over');
      socket.off('lobby:reset');
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
    if (result.correct) {
      const label = result.correct === 'both' ? 'title & artist' : result.correct;
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
      setGuessToast(`+${result.points} pts · ${label}`);
      toastTimeout.current = setTimeout(() => setGuessToast(null), 2000);
      if (result.revealedTitle !== undefined) setMyTitle(result.revealedTitle);
      if (result.revealedArtists !== undefined) setMyArtists(result.revealedArtists);
      if ('revealedAlbumArt' in result) setMyAlbumArt(result.revealedAlbumArt);
    }
  }

  useEffect(() => {
    socket.on('game:guess-result', handleGuessResult);
    return () => { socket.off('game:guess-result', handleGuessResult); };
  }, []);

  if (phase === 'over') {
    return (
      <div className="page" style={{ justifyContent: 'flex-start', paddingTop: 48 }}>
        <div className="game-over fade-in">
          <h1>Game Over!</h1>
          <div className="game-over-columns">
            <div>
              <p className="section-title" style={{ marginBottom: 12 }}>Final scores</p>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  className="btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => socket.emit('lobby:play-again')}
                >
                  Play Again
                </button>
                <button
                  className="btn-secondary"
                  style={{ width: '100%' }}
                  onClick={() => { sessionStorage.removeItem('mg_lobbyCode'); navigate('/'); }}
                >
                  Back to Home
                </button>
              </div>
            </div>

            <div>
              <p className="section-title" style={{ marginBottom: 12 }}>Songs played</p>
              <div className="songs-played-list">
                {playedSongs.map((song, i) => (
                  <div key={song.id} className="songs-played-item">
                    <span className="songs-played-num">{i + 1}</span>
                    {song.albumArt
                      ? <img src={song.albumArt} alt={song.title} className="songs-played-art" />
                      : <div className="songs-played-art songs-played-art-placeholder">🎵</div>
                    }
                    <div className="songs-played-info">
                      <div className="songs-played-title">{song.title}</div>
                      <div className="songs-played-artist">{song.artists.join(', ')}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
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
    <div className="game-wrapper">
      <div className="game-topbar">
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', letterSpacing: 1 }}>MusicGuessr</span>
        <div className="volume-control">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {volume === 0
              ? <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></>
              : volume < 0.5
              ? <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></>
              : <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></>
            }
          </svg>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
          />
        </div>
      </div>

    <div className="game-layout">
      <Scoreboard scores={scores} myId={socket.id ?? ''} />

      <div className="game-center">
        <p className="song-counter">Song {songIndex + 1} of {totalSongs}</p>

        <div style={{ position: 'relative' }}>
          {phase === 'revealing' && revealedSong?.albumArt ? (
            <img src={revealedSong.albumArt} alt="album art" className="album-art fade-in" style={{ display: 'block' }} />
          ) : myAlbumArt ? (
            <img src={myAlbumArt} alt="album art" className="album-art fade-in" style={{ display: 'block' }} />
          ) : (
            <div className="album-art" style={{ fontSize: 60 }}>🎵</div>
          )}
        </div>

        {phase === 'revealing' && revealedSong ? (
          <div className="song-reveal fade-in">
            <div className="song-title">{revealedSong.title}</div>
            <div className="song-artist">{revealedSong.artists.join(', ')}</div>
          </div>
        ) : (myTitle || myArtists) ? (
          <div className="song-reveal">
            {myTitle && <div className="song-title">{myTitle}</div>}
            {myArtists && <div className="song-artist" style={{ color: 'var(--text-dim)' }}>{myArtists.join(', ')}</div>}
          </div>
        ) : null}

        <div className="progress-bar-wrap" style={{ width: 320 }}>
          <div
            className="progress-bar-fill"
            style={{ width: `${progress * 100}%`, transition: phase === 'revealing' ? 'none' : 'width 0.2s linear' }}
          />
        </div>

        {guessToast && (
          <div className="guess-toast fade-in">{guessToast}</div>
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
    </div>
  );
}
