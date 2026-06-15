import { PlayerScore } from 'shared/types';
import { playerColor } from '../utils/playerColor';

interface Props {
  scores: PlayerScore[];
  myId: string;
}

const RANK_ICONS = ['🥇', '🥈', '🥉'];

export default function Scoreboard({ scores, myId }: Props) {
  const sorted = [...scores].sort((a, b) => b.score - a.score);

  return (
    <div className="scoreboard-panel">
      <h3>Scoreboard</h3>
      <div className="score-list">
        {sorted.map((s, i) => (
          <div
            key={s.playerId}
            className="score-item"
            style={s.playerId === myId ? { border: '1px solid var(--accent)' } : undefined}
          >
            <span className={`score-rank ${i === 0 ? 'top' : ''}`}>
              {RANK_ICONS[i] ?? `${i + 1}.`}
            </span>
            <span className="score-username">
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: playerColor(s.username), marginRight: 6, flexShrink: 0 }} />
              {s.username}
            </span>
            {s.gained > 0 && (
              <span className="score-gained">+{s.gained}</span>
            )}
            <span className="score-pts">{s.score}</span>
          </div>
        ))}
        {sorted.length === 0 && (
          <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>No scores yet</p>
        )}
      </div>
    </div>
  );
}
