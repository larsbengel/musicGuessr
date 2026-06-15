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
    sessionStorage.removeItem('mg_lobbyCode');
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!username.trim()) { setError('Enter a username first'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/lobby', { method: 'POST' });
      const { code } = await res.json() as { code: string };
      localStorage.setItem('mg_username', username.trim());
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
    localStorage.setItem('mg_username', username.trim());
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
            Music<span style={{ color: 'var(--accent)' }}>Guessr</span>
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
    </div>
  );
}
