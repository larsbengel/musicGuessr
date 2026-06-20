import { useRef, useState } from 'react';
import Logo from './Logo';
import LanguageToggle from './LanguageToggle';

interface TopbarProps {
  volume?: number;
  onVolumeChange?: (v: number) => void;
}

export default function Topbar({ volume: volumeProp, onVolumeChange }: TopbarProps) {
  const [localVolume, setLocalVolume] = useState<number>(() => {
    const saved = localStorage.getItem('sd_volume');
    return saved !== null ? parseFloat(saved) : 0.8;
  });

  const volume = volumeProp ?? localVolume;
  const premuteVolume = useRef(volume > 0 ? volume : 0.8);

  function handleChange(v: number) {
    if (v > 0) premuteVolume.current = v;
    localStorage.setItem('sd_volume', String(v));
    if (onVolumeChange) {
      onVolumeChange(v);
    } else {
      setLocalVolume(v);
    }
  }

  function toggleMute() {
    handleChange(volume === 0 ? premuteVolume.current : 0);
  }

  return (
    <div className="game-topbar">
      <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
        <Logo size={40} />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', letterSpacing: 1 }}>SongDuel</span>
      </a>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
        <LanguageToggle />
        <div className="volume-control">
          <button onClick={toggleMute} style={{ background: 'none', padding: 0, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {volume === 0
                ? <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></>
                : volume < 0.5
                ? <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></>
                : <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></>
              }
            </svg>
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={volume}
            onChange={(e) => handleChange(parseFloat(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
}
