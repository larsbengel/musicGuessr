import { useEffect, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import socket from '../socket';
import Logo from '../components/Logo';

export default function Home() {
  const { username, setUsername } = useGame();
  const navigate = useNavigate();

  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Clear stored lobby on home screen — player is no longer in a game
  useEffect(() => {
    sessionStorage.removeItem('sd_lobbyCode');
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!username.trim()) { setError('Enter a username first'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/lobby', { method: 'POST' });
      const { code } = await res.json() as { code: string };
      localStorage.setItem('sd_username', username.trim());
      ensureConnected();
      navigate(`/lobby/${code}`);
    } catch {
      setError('Could not create lobby');
    } finally {
      setLoading(false);
    }
  }

  function handleJoin(e: FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!username.trim()) { setError('Enter a username first'); return; }
    if (code.length !== 6) { setError('Lobby code must be 6 characters'); return; }
    localStorage.setItem('sd_username', username.trim());
    ensureConnected();
    navigate(`/lobby/${code}`);
  }

  function ensureConnected() {
    if (!socket.connected) socket.connect();
  }

  return (
    <div className="page">
      <div style={{ textAlign: 'center', marginBottom: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <Logo size={88} />
        <div>
          <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>
            Song<span style={{ color: 'var(--accent)' }}>Duel</span>
          </h1>
          <p style={{ color: 'var(--text-dim)', marginTop: 6 }}>
            Guess songs with friends
          </p>
        </div>
      </div>

      <div className="card">
        <div className="form-group">
          <label>Your Name</label>
          <input
            placeholder="Enter username..."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={20}
            autoFocus
          />
        </div>

        <form onSubmit={handleCreate}>
          <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Creating...' : 'Create Lobby'}
          </button>
        </form>

        <div className="divider" />

        <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            placeholder="Lobby code (e.g. XK9FT2)"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
            style={{ letterSpacing: 3, textTransform: 'uppercase' }}
          />
          <button type="submit" className="btn-secondary">Join Lobby</button>
        </form>

        {error && <p className="error-msg">{error}</p>}
      </div>

      <a
        href="https://github.com/larsbengel/song-duel"
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 24, color: 'var(--text-dim)', fontSize: 13, textDecoration: 'none' }}
      >
        <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
        larsbengel/song-duel
      </a>
    </div>
  );
}
