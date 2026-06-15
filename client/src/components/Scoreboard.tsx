import { PlayerScore } from 'shared/types';

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
            <span className="score-username">{s.username}</span>
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
