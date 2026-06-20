import { useTranslation } from 'react-i18next';
import { GuessCategory, PlayerScore } from 'shared/types';
import { playerColor } from '../utils/playerColor';

interface Props {
  scores: PlayerScore[];
  myId: string;
  guessMode: { title: boolean; artist: boolean; year: boolean };
  hasYear: boolean;
}

const RANK_ICONS = ['🥇', '🥈', '🥉'];

const CATEGORY_ICON: Record<GuessCategory, string> = {
  title: '♪',
  artist: '◎',
  year: '#',
};

const CATEGORIES: GuessCategory[] = ['title', 'artist', 'year'];

export default function Scoreboard({ scores, myId, guessMode, hasYear }: Props) {
  const { t } = useTranslation();
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const activeCategories = CATEGORIES.filter((c) => guessMode[c] && (c !== 'year' || hasYear));

  return (
    <div className="scoreboard-panel">
      <h3>{t('scoreboard.title')}</h3>
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
            <div className="score-main">
              <div className="score-top-row">
                <span className="score-username">
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: playerColor(s.username), marginRight: 6, flexShrink: 0 }} />
                  {s.username}
                </span>
                <span className="score-pts">{s.score}</span>
              </div>
              {activeCategories.length > 0 && (
                <div className="score-categories">
                  {activeCategories.map((cat) => {
                    const pts = s.gainedByCategory?.[cat];
                    const solved = pts !== undefined && pts > 0;
                    return (
                      <span
                        key={cat}
                        className={`score-cat-badge ${solved ? 'solved' : ''}`}
                        title={t(`common.categories.${cat}`)}
                      >
                        {CATEGORY_ICON[cat]}
                        {solved && <span className="score-cat-pts">+{pts}</span>}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
        {sorted.length === 0 && (
          <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>{t('scoreboard.noScores')}</p>
        )}
      </div>
    </div>
  );
}
