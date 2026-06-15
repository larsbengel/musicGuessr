import { useEffect, useState, useRef, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LobbyInfo, SpotifyPlaylist } from 'shared/types';
import { useGame } from '../context/GameContext';
import socket, { playerId } from '../socket';

interface Genre { id: number; name: string; }

export default function Lobby() {
  const { code } = useParams<{ code: string }>();
  const { username, setUsername } = useGame();
  const navigate = useNavigate();

  const [lobby, setLobby] = useState<LobbyInfo | null>(null);
  const [error, setError] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SpotifyPlaylist[]>([]);
  const [searching, setSearching] = useState(false);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
  const [browseResults, setBrowseResults] = useState<SpotifyPlaylist[]>([]);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isHost = lobby?.hostId === socket.id;
  const myId = socket.id;

  // Load genres and featured playlists once
  useEffect(() => {
    fetch('/api/spotify/genres')
      .then((r) => r.json())
      .then((d: { genres: Genre[] }) => setGenres(d.genres))
      .catch(() => null);

    fetch('/api/spotify/featured')
      .then((r) => r.json())
      .then((d: { playlists?: SpotifyPlaylist[] }) => setBrowseResults(d.playlists ?? []))
      .catch(() => null);
  }, []);

  // Socket setup — only runs once we have a username
  useEffect(() => {
    if (!username) return;

    if (!socket.connected) socket.connect();
    sessionStorage.setItem('mg_lobbyCode', code ?? '');

    socket.emit('lobby:join', { code, username, playerId }, (res: { error?: string }) => {
      if (res.error) setError(res.error);
    });

    socket.on('lobby:state', setLobby);
    socket.on('lobby:playlist-added', (playlist: SpotifyPlaylist) => {
      setLobby((prev) => prev ? { ...prev, playlists: [...prev.playlists, playlist] } : prev);
    });
    socket.on('lobby:playlist-removed', ({ playlistId }: { playlistId: string }) => {
      setLobby((prev) =>
        prev ? { ...prev, playlists: prev.playlists.filter((p) => p.id !== playlistId) } : prev
      );
    });
    socket.on('lobby:error', ({ message }: { message: string }) => {
      setError(message);
      setStarting(false);
    });
    socket.on('game:started', ({ totalSongs }: { totalSongs: number }) => {
      void totalSongs;
      navigate(`/game/${code}`);
    });

    return () => {
      socket.off('lobby:state');
      socket.off('lobby:playlist-added');
      socket.off('lobby:playlist-removed');
      socket.off('lobby:error');
      socket.off('game:started');
    };
  }, [code, username, navigate]);

  // Re-fetch lobby state when a player joins/leaves
  useEffect(() => {
    function onPlayerChange() {
      fetch(`/api/lobby/${code}`)
        .then((r) => r.json())
        .then(setLobby)
        .catch(() => null);
    }
    socket.on('lobby:player-joined', onPlayerChange);
    socket.on('lobby:player-left', onPlayerChange);
    return () => {
      socket.off('lobby:player-joined', onPlayerChange);
      socket.off('lobby:player-left', onPlayerChange);
    };
  }, [code]);

  function selectGenre(genre: Genre) {
    if (selectedGenre?.id === genre.id) {
      // deselect — go back to featured
      setSelectedGenre(null);
      fetch('/api/spotify/featured')
        .then((r) => r.json())
        .then((d: { playlists?: SpotifyPlaylist[] }) => setBrowseResults(d.playlists ?? []))
        .catch(() => null);
      return;
    }
    setSelectedGenre(genre);
    setSearchQuery('');
    setSearchResults([]);
    setBrowseResults([]);
    setSearching(true);
    fetch(`/api/spotify/genre/${genre.id}/playlists?name=${encodeURIComponent(genre.name)}`)
      .then((r) => r.json())
      .then((d: { playlists?: SpotifyPlaylist[] }) => setBrowseResults(d.playlists ?? []))
      .catch(() => setBrowseResults([]))
      .finally(() => setSearching(false));
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    doSearch(searchQuery);
  }

  function doSearch(q: string) {
    if (!q.trim()) return;
    setSearching(true);
    fetch(`/api/spotify/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((data: { playlists: SpotifyPlaylist[] }) => setSearchResults(data.playlists))
      .catch(() => setSearchResults([]))
      .finally(() => setSearching(false));
  }

  function handleSearchInput(value: string) {
    setSearchQuery(value);
    if (value.trim()) setSelectedGenre(null);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (value.trim().length > 1) {
      searchTimeout.current = setTimeout(() => doSearch(value), 500);
    } else {
      setSearchResults([]);
    }
  }

  function addPlaylist(playlist: SpotifyPlaylist) {
    socket.emit('lobby:add-playlist', playlist, (res: { error?: string }) => {
      if (res.error) setError(res.error);
    });
  }

  function removePlaylist(id: string) {
    socket.emit('lobby:remove-playlist', id);
  }

  function updateSongCount(count: number) {
    socket.emit('lobby:update-settings', { songCount: count });
  }

  function startGame() {
    setStarting(true);
    setError('');
    socket.emit('lobby:start', (res: { error?: string }) => {
      if (res.error) {
        setError(res.error);
        setStarting(false);
      }
    });
  }

  // Name prompt shown when arriving via share link in a fresh browser
  if (!username) {
    return (
      <div className="page">
        <div className="card">
          <h1 style={{ marginBottom: 8 }}>Join Lobby</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 20 }}>
            You've been invited to lobby{' '}
            <strong style={{ color: 'var(--accent)', letterSpacing: 2 }}>{code}</strong>
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (nameInput.trim()) setUsername(nameInput.trim());
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Your Name</label>
              <input
                placeholder="Enter username..."
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={20}
                autoFocus
              />
            </div>
            <button type="submit" className="btn-primary" disabled={!nameInput.trim()}>
              Join
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (error && !lobby) {
    return (
      <div className="page">
        <div className="card">
          <p style={{ color: 'var(--danger)' }}>{error}</p>
          <button className="btn-secondary" style={{ marginTop: 16 }} onClick={() => navigate('/')}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!lobby) {
    return <div className="page"><p className="waiting-msg">Joining lobby...</p></div>;
  }

  return (
    <div className="lobby-layout" style={{ paddingTop: 40 }}>
      {/* Left: players + settings */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card" style={{ maxWidth: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="lobby-code" style={{ flex: 1 }}>{lobby.code}</div>
            <button
              className="btn-secondary"
              title={copied ? 'Copied!' : 'Copy invite link'}
              style={{ padding: '8px', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: copied ? 'var(--accent)' : undefined }}
              onClick={() => {
                const url = `${window.location.origin}/lobby/${lobby.code}`;
                navigator.clipboard.writeText(url).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                });
              }}
            >
              {copied ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              )}
            </button>
          </div>
          <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 6 }}>Share to invite friends</p>
        </div>

        <div className="card" style={{ maxWidth: '100%' }}>
          <p className="section-title">Players ({lobby.players.length})</p>
          <ul className="player-list">
            {lobby.players.map((p) => (
              <li key={p.id} className="player-item">
                {p.username}
                {p.id === myId && <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 4 }}>(you)</span>}
                {p.isHost && <span className="host-badge">HOST</span>}
              </li>
            ))}
          </ul>
        </div>

        {isHost && (
          <div className="card" style={{ maxWidth: '100%' }}>
            <p className="section-title">Songs per game</p>
            <select
              value={lobby.settings.songCount}
              onChange={(e) => updateSongCount(Number(e.target.value))}
            >
              {[5, 10, 15, 20, 25].map((n) => (
                <option key={n} value={n}>{n} songs</option>
              ))}
            </select>
          </div>
        )}

        {isHost ? (
          <button
            className="btn-primary"
            onClick={startGame}
            disabled={starting || lobby.playlists.length === 0}
          >
            {starting ? 'Loading songs...' : 'Start Game'}
          </button>
        ) : (
          <p className="waiting-msg">Waiting for host to start...</p>
        )}

        {error && <p className="error-msg">{error}</p>}
      </div>

      {/* Right: playlist management */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {lobby.playlists.length > 0 && (
          <div className="card" style={{ maxWidth: '100%' }}>
            <p className="section-title">Selected Playlists ({lobby.playlists.length})</p>
            <div className="playlist-grid">
              {lobby.playlists.map((p) => (
                <div key={p.id} className="playlist-card">
                  {p.imageUrl
                    ? <img src={p.imageUrl} alt={p.name} />
                    : <div className="no-img">🎵</div>
                  }
                  <div className="playlist-card-info">
                    <div className="playlist-card-name">{p.name}</div>
                    <div className="playlist-card-owner">{p.trackCount} tracks</div>
                  </div>
                  {isHost && (
                    <button className="remove-btn" onClick={() => removePlaylist(p.id)}>×</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card" style={{ maxWidth: '100%' }}>
            <p className="section-title">Add Playlists</p>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  placeholder="Search playlists..."
                  value={searchQuery}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  style={{ paddingRight: searchQuery ? 32 : undefined }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', padding: 0, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', borderRadius: '50%' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                )}
              </div>
              <button type="submit" className="btn-secondary" style={{ width: 'auto', whiteSpace: 'nowrap' }}>
                Search
              </button>
            </form>

            {genres.length > 0 && !searchQuery && (
              <div className="genre-chips">
                {genres.map((g) => (
                  <button
                    key={g.id}
                    className={`genre-chip ${selectedGenre?.id === g.id ? 'active' : ''}`}
                    onClick={() => selectGenre(g)}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            )}

            {searching && <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 8 }}>Loading...</p>}

            {(() => {
              const results = searchQuery ? searchResults : browseResults;
              const label = searchQuery ? null : selectedGenre ? selectedGenre.name : 'Featured';
              return results.length > 0 ? (
                <>
                  {label && <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 10 }}>{label}</p>}
                  <div className="search-results">
                    {results.map((p) => (
                      <div key={p.id} className="search-result-item" onClick={() => addPlaylist(p)}>
                        {p.imageUrl
                          ? <img src={p.imageUrl} alt={p.name} />
                          : <div style={{ width: 40, height: 40, background: 'var(--surface-3)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🎵</div>
                        }
                        <div className="search-result-info">
                          <div className="search-result-name">{p.name}</div>
                          <div className="search-result-owner">by {p.owner} · {p.trackCount} tracks</div>
                        </div>
                        <span style={{ color: 'var(--accent)', fontSize: 20, flexShrink: 0 }}>+</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : null;
            })()}
        </div>
      </div>
    </div>
  );
}
