import { useEffect, useRef, useState, FormEvent } from 'react';
import { ChatMessage } from 'shared/types';

interface Props {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  disabled: boolean;
  myId: string;
}

export default function Chat({ messages, onSend, disabled, myId }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput('');
  }

  function msgClass(msg: ChatMessage): string {
    if (msg.correct === 'both') return 'chat-msg correct-both';
    if (msg.correct === 'title') return 'chat-msg correct-title';
    if (msg.correct === 'artist') return 'chat-msg correct-artist';
    return 'chat-msg';
  }

  function correctTag(msg: ChatMessage): string | null {
    if (msg.correct === 'both') return 'title + artist';
    if (msg.correct === 'title') return 'title';
    if (msg.correct === 'artist') return 'artist';
    return null;
  }

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={msgClass(msg)}>
            <span
              className="chat-username"
              style={msg.playerId === myId ? { color: 'var(--accent)' } : undefined}
            >
              {msg.username}
            </span>
            <span>{msg.text}</span>
            {correctTag(msg) && (
              <span className="chat-correct-tag">{correctTag(msg)}</span>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form className="chat-input-row" onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={disabled ? 'Waiting for next song...' : 'Type your guess...'}
          disabled={disabled}
          autoComplete="off"
        />
        <button type="submit" className="btn-primary" disabled={disabled || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
