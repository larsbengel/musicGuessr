import { useEffect, useState, useRef, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LobbyInfo, PlayerScore, SpotifyPlaylist } from 'shared/types';
import { useGame } from '../context/GameContext';
import socket, { playerId } from '../socket';
import Topbar from '../components/Topbar';

interface Genre { id: number | string; name: string; }

const SPOTIFY_GENRES: Genre[] = [
  'Pop', 'Rock', 'Hip-Hop', 'R&B', 'Dance', 'Electronic', 'Jazz',
  'Classical', 'Country', 'Latin', 'Metal', 'Soul', 'Indie', 'Reggae', 'Blues',
].map((name) => ({ id: name.toLowerCase(), name }));

export default function Lobby() {
  const { code } = useParams<{ code: string }>();
  const { username, setUsername } = useGame();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [lobby, setLobby] = useState<LobbyInfo | null>(null);
  const [error, setError] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SpotifyPlaylist[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
  const [browseResults, setBrowseResults] = useState<SpotifyPlaylist[]>([]);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchSource, setSearchSource] = useState<'deezer' | 'spotify'>('deezer');
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isHost = lobby?.hostId === socket.id;
  const myId = socket.id;

  // Load genres and featured playlists — re-run when source changes
  useEffect(() => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedGenre(null);
    setBrowseResults([]);
    setSearchError('');

    if (searchSource === 'deezer') {
      fetch('/api/deezer/genres')
        .then((r) => r.json())
        .then((d: { genres: Genre[] }) => setGenres(d.genres))
        .catch(() => null);

      fetch('/api/deezer/featured')
        .then((r) => r.json())
        .then((d: { playlists?: SpotifyPlaylist[] }) => setBrowseResults(d.playlists ?? []))
        .catch(() => null);
    } else {
      setGenres(SPOTIFY_GENRES);
      fetch('/api/spotify/featured')
        .then((r) => r.json())
        .then((d: { playlists?: SpotifyPlaylist[]; error?: string }) => {
          if (d.error) setSearchError(t('lobby.spotifyUnavailable'));
          setBrowseResults(d.playlists ?? []);
        })
        .catch(() => setSearchError(t('lobby.spotifyError')));
    }
  }, [searchSource]);

  // Socket setup — only runs once we have a username
  useEffect(() => {
    if (!username) return;

    if (!socket.connected) socket.connect();
    sessionStorage.setItem('sd_lobbyCode', code ?? '');

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
    socket.on('lobby:playlist-updated', (playlist: SpotifyPlaylist) => {
      setLobby((prev) =>
        prev ? { ...prev, playlists: prev.playlists.map((p) => p.id === playlist.id ? playlist : p) } : prev
      );
    });
    socket.on('lobby:error', ({ message }: { message: string }) => {
      setError(message);
      setStarting(false);
    });
    socket.on('game:started', ({ initialScores, guessMode, hostId }: { totalSongs: number; initialScores: PlayerScore[]; guessMode: { title: boolean; artist: boolean; year: boolean }; hostId: string }) => {
      navigate(`/game/${code}`, { state: { initialScores, guessMode, hostId } });
    });

    socket.on('game:join-in-progress', ({ totalSongs, initialScores, guessMode, hostId }: { totalSongs: number; initialScores: PlayerScore[]; guessMode: { title: boolean; artist: boolean; year: boolean }; hostId: string }) => {
      navigate(`/game/${code}`, { state: { initialScores, guessMode, hostId, totalSongs, midgame: true } });
    });

    return () => {
      socket.off('lobby:state');
      socket.off('lobby:playlist-added');
      socket.off('lobby:playlist-removed');
      socket.off('lobby:playlist-updated');
      socket.off('lobby:error');
      socket.off('game:started');
      socket.off('game:join-in-progress');
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
      setSelectedGenre(null);
      const featuredUrl = searchSource === 'spotify' ? '/api/spotify/featured' : '/api/deezer/featured';
      fetch(featuredUrl)
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
    const url = searchSource === 'spotify'
      ? `/api/spotify/genre/${encodeURIComponent(genre.name)}/playlists`
      : `/api/deezer/genre/${genre.id}/playlists?name=${encodeURIComponent(genre.name)}`;
    fetch(url)
      .then((r) => r.json())
      .then((d: { playlists?: SpotifyPlaylist[] }) => setBrowseResults(d.playlists ?? []))
      .catch(() => setBrowseResults([]))
      .finally(() => setSearching(false));
  }

  function switchSource(source: 'deezer' | 'spotify') {
    if (source === searchSource) return;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    setSearchSource(source);
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    doSearch(searchQuery);
  }

  function doSearch(q: string) {
    if (!q.trim()) return;
    setSearching(true);
    setSearchError('');
    const endpoint = searchSource === 'spotify' ? '/api/spotify/search' : '/api/deezer/search';
    fetch(`${endpoint}?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((data: { playlists?: SpotifyPlaylist[]; error?: string }) => {
        if (data.error) setSearchError(searchSource === 'spotify' ? t('lobby.spotifyUnavailable') : t('lobby.searchFailed'));
        setSearchResults(data.playlists ?? []);
      })
      .catch(() => { setSearchError(t('lobby.searchFailed')); setSearchResults([]); })
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

  const atLimit = (lobby?.playlists.length ?? 0) >= 8;

  function addPlaylist(playlist: SpotifyPlaylist) {
    if (atLimit) return;
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

  function updateSongDuration(seconds: number) {
    socket.emit('lobby:update-settings', { songDuration: seconds * 1000 });
  }

  function toggleGuessMode(category: 'title' | 'artist' | 'year') {
    if (!lobby) return;
    const current = lobby.settings.guessMode ?? { title: true, artist: true, year: false };
    const next = { ...current, [category]: !current[category] };
    if (!next.title && !next.artist) return; // keep at least one on
    socket.emit('lobby:update-settings', { guessMode: { [category]: !current[category] } });
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
          <h1 style={{ marginBottom: 8 }}>{t('lobby.joinLobby')}</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 20 }}>
            {t('lobby.invitedTo')}{' '}
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
              <label>{t('common.yourName')}</label>
              <input
                placeholder={t('common.enterUsername')}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={20}
                autoFocus
              />
            </div>
            <button type="submit" className="btn-primary" disabled={!nameInput.trim()}>
              {t('common.join')}
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
            {t('common.backToHome')}
          </button>
        </div>
      </div>
    );
  }

  if (!lobby) {
    return <div className="page"><p className="waiting-msg">{t('lobby.joiningLobby')}</p></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
    <Topbar />
    <div className="lobby-layout">
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
          <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 6 }}>{t('lobby.shareToInvite')}</p>
        </div>

        <div className="card" style={{ maxWidth: '100%' }}>
          <p className="section-title">{t('lobby.players')} ({lobby.players.length})</p>
          <ul className="player-list">
            {lobby.players.map((p) => (
              <li key={p.id} className="player-item">
                {p.username}
                {p.id === myId && <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 4 }}>({t('lobby.you')})</span>}
                {p.isHost && <span className="host-badge">HOST</span>}
              </li>
            ))}
          </ul>
        </div>

        {isHost ? (
          <div className="card" style={{ maxWidth: '100%' }}>
            <p className="section-title">{t('lobby.songsPerGame')}</p>
            <select
              value={lobby.settings.songCount}
              onChange={(e) => updateSongCount(Number(e.target.value))}
            >
              {[5, 10, 15, 20, 25].map((n) => (
                <option key={n} value={n}>{t('lobby.nSongs', { count: n })}</option>
              ))}
            </select>
            <p className="section-title" style={{ marginTop: 16 }}>
              {t('lobby.roundLength')} <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{lobby.settings.songDuration / 1000}s</span>
            </p>
            <input
              type="range"
              min={5}
              max={30}
              step={5}
              value={lobby.settings.songDuration / 1000}
              onChange={(e) => updateSongDuration(Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
              <span>5s</span><span>30s</span>
            </div>
            <p className="section-title" style={{ marginTop: 16 }}>{t('lobby.whatToGuess')}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['title', 'artist', 'year'] as const).map((cat) => {
                const guessMode = lobby.settings.guessMode ?? { title: true, artist: true, year: false };
                const active = guessMode[cat];
                const isLast = active && !(['title', 'artist', 'year'] as const).filter((c) => c !== cat).some((c) => guessMode[c]);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleGuessMode(cat)}
                    disabled={isLast}
                    style={{
                      flex: 1,
                      padding: '8px 0',
                      borderRadius: 6,
                      border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      background: active ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'var(--surface-2)',
                      color: active ? 'var(--accent)' : 'var(--text-dim)',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: isLast ? 'default' : 'pointer',
                    }}
                  >
                    {t(`common.categories.${cat}`)}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="card" style={{ maxWidth: '100%' }}>
            <p className="section-title">{t('lobby.settings')}</p>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0' }}>
              {t('lobby.nSongsRounds', { count: lobby.settings.songCount, duration: lobby.settings.songDuration / 1000 })}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '4px 0' }}>
              {t('lobby.guess')}: {(['title', 'artist', 'year'] as const)
                .filter((c) => (lobby.settings.guessMode ?? { title: true, artist: true, year: false })[c])
                .map((c) => t(`common.categories.${c}`))
                .join(' & ')}
            </p>
          </div>
        )}

        {isHost ? (
          <button
            className="btn-primary"
            onClick={startGame}
            disabled={starting || lobby.playlists.length === 0}
          >
            {starting ? t('lobby.loadingSongs') : t('lobby.startGame')}
          </button>
        ) : (
          <p className="waiting-msg">{t('lobby.waitingForHost')}</p>
        )}

        <button
          className="btn-secondary"
          onClick={() => {
            socket.emit('lobby:leave');
            sessionStorage.removeItem('sd_lobbyCode');
            navigate('/');
          }}
        >
          {t('lobby.leaveLobby')}
        </button>

        {error && <p className="error-msg">{error}</p>}
      </div>

      {/* Right: playlist management */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {lobby.playlists.length > 0 && (
          <div className="card" style={{ maxWidth: '100%' }}>
            <p className="section-title">{t('lobby.selectedPlaylists')} ({lobby.playlists.length})</p>
            <div className="playlist-grid">
              {lobby.playlists.map((p) => (
                <div key={p.id} className="playlist-card">
                  {p.imageUrl
                    ? <img src={p.imageUrl} alt={p.name} />
                    : <div className="no-img">🎵</div>
                  }
                  <div className="playlist-card-info">
                    <div className="playlist-card-name">{p.name}</div>
                    <div className="playlist-card-owner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>
                        {p.playableCount !== undefined
                          ? p.source === 'spotify'
                            ? t('lobby.approxTracks', { count: p.playableCount })
                            : t('lobby.nPlayable', { count: p.playableCount })
                          : <span style={{ opacity: 0.5 }}>{t('lobby.checkingTracks')}</span>}
                      </span>
                      {p.source === 'spotify' && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="#1DB954" style={{ flexShrink: 0 }}>
                          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                        </svg>
                      )}
                    </div>
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
            <p className="section-title">{t('lobby.addPlaylists')}</p>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {(['deezer', 'spotify'] as const).map((src) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => switchSource(src)}
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    borderRadius: 6,
                    border: `1.5px solid ${searchSource === src ? (src === 'spotify' ? '#1DB954' : 'var(--accent)') : 'var(--border)'}`,
                    background: searchSource === src
                      ? src === 'spotify'
                        ? 'color-mix(in srgb, #1DB954 15%, transparent)'
                        : 'color-mix(in srgb, var(--accent) 15%, transparent)'
                      : 'var(--surface-2)',
                    color: searchSource === src ? (src === 'spotify' ? '#1DB954' : 'var(--accent)') : 'var(--text-dim)',
                    fontWeight: searchSource === src ? 600 : 400,
                    fontSize: 13,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {src === 'spotify' ? 'Spotify' : 'Deezer'}
                </button>
              ))}
            </div>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  placeholder={t('lobby.searchPlaylists')}
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
                {t('common.search')}
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

            {searching && <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 8 }}>{t('lobby.loading')}</p>}
            {!searching && searchError && (
              <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{searchError}</p>
            )}

            {(() => {
              const results = searchQuery ? searchResults : browseResults;
              const label = searchQuery ? null : selectedGenre ? selectedGenre.name : t('lobby.featured');
              return results.length > 0 ? (
                <>
                  {label && <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 10 }}>{label}</p>}
                  {atLimit && (
                    <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '8px 0 4px' }}>{t('lobby.maxPlaylists')}</p>
                  )}
                  <div className="search-results">
                    {results.map((p) => {
                      const alreadyAdded = lobby?.playlists.some((pl) => pl.id === p.id);
                      const disabled = atLimit && !alreadyAdded;
                      return (
                        <div
                          key={p.id}
                          className="search-result-item"
                          onClick={() => addPlaylist(p)}
                          style={disabled ? { opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none' } : undefined}
                        >
                          {p.imageUrl
                            ? <img src={p.imageUrl} alt={p.name} />
                            : <div style={{ width: 40, height: 40, background: 'var(--surface-3)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🎵</div>
                          }
                          <div className="search-result-info">
                            <div className="search-result-name">{p.name}</div>
                            <div className="search-result-owner">{t('lobby.byOwner', { owner: p.owner, count: p.trackCount })}</div>
                          </div>
                          <span style={{ color: 'var(--accent)', fontSize: 20, flexShrink: 0 }}>+</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : null;
            })()}
        </div>
      </div>
    </div>
    </div>
  );
}
