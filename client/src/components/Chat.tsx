import { useEffect, useRef, useState, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatMessage } from 'shared/types';
import { playerColor } from '../utils/playerColor';

interface Props {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  disabled: boolean;
  songIndex: number;
}

export default function Chat({ messages, onSend, disabled, songIndex }: Props) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const lastSent = useRef('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  useEffect(() => {
    setInput('');
  }, [songIndex]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    lastSent.current = text;
    onSend(text);
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowUp' && input === '' && lastSent.current) {
      e.preventDefault();
      setInput(lastSent.current);
    }
    if (e.key === 'ArrowDown' && input !== '') {
      e.preventDefault();
      setInput('');
    }
  }

  function getGuessLabel(raw: ChatMessage['correct']): string {
    const cats: string[] = Array.isArray(raw) ? raw
      : raw === 'both' ? ['title', 'artist']
      : raw ? [raw] : [];
    const key = [...cats].sort().join('_');
    return t(`chat.labels.${key}` as Parameters<typeof t>[0]);
  }

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {messages.map((msg, i) => {
          if (msg.divider !== undefined) {
            return (
              <div key={i} className="chat-divider">
                <span>{t('chat.song')} {msg.divider}</span>
              </div>
            );
          }
          const color = playerColor(msg.username);
          if (msg.system && msg.close) {
            return (
              <div key={i} className="chat-msg chat-system chat-system-close">
                <strong style={{ color }}>{msg.username}</strong> {t('chat.isClose')}
              </div>
            );
          }
          if (msg.system) {
            const raw = msg.correct;
            const cats: string[] = Array.isArray(raw) ? raw
              : raw === 'both' ? ['title', 'artist']
              : raw ? [raw] : [];
            const cssKey = cats.length === 1 ? cats[0] : 'both';
            const label = getGuessLabel(raw);
            return (
              <div key={i} className={`chat-msg chat-system chat-system-${cssKey}`}>
                <strong style={{ color }}>{msg.username}</strong> {t('chat.guessedSuffix', { label })}
              </div>
            );
          }
          return (
            <div key={i} className="chat-msg">
              <span className="chat-username" style={{ color }}>
                {msg.username}
              </span>
              <span>{msg.text}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form className="chat-input-row" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? t('chat.waitingForSong') : t('chat.typeGuess')}
          disabled={disabled}
          autoComplete="off"
        />
        <button type="submit" className="btn-primary" disabled={disabled || !input.trim()} style={{ width: 40, height: 40, padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>
    </div>
  );
}
