import { useEffect, useRef, useState, FormEvent } from 'react';
import { ChatMessage } from 'shared/types';
import { playerColor } from '../utils/playerColor';

interface Props {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  disabled: boolean;
}

export default function Chat({ messages, onSend, disabled }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput('');
  }

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {messages.map((msg, i) => {
          const color = playerColor(msg.username);
          if (msg.system) {
            const label = msg.correct === 'both' ? 'title & artist' : `the ${msg.correct}`;
            return (
              <div key={i} className={`chat-msg chat-system chat-system-${msg.correct}`}>
                <strong style={{ color }}>{msg.username}</strong> guessed {label}
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
          placeholder={disabled ? 'Waiting for next song...' : 'Type your guess...'}
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
