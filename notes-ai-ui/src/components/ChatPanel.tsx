import { useEffect, useRef, useState, useCallback } from 'react';
import type { Note, ChatMessage } from '../services/api';
import { api } from '../services/api';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ChatPanelProps {
  note: Note;
}

const SUGGESTIONS = [
  'Give me a one-line summary',
  'What are the key takeaways?',
  'List the action items',
  'Quiz me with 3 questions',
];

export function ChatPanel({ note }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || sending) return;
    setError(null);
    const updated: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(updated);
    setInput('');
    setSending(true);
    try {
      const res = await api.chatWithNotes(note.id, updated);
      if (res.status === 'success' && res.reply) {
        setMessages([...updated, { role: 'assistant', content: res.reply }]);
      } else {
        setError(res.error || 'Something went wrong');
      }
    } catch {
      setError('Network error — is the server running?');
    } finally {
      setSending(false);
    }
  }, [messages, sending, note.id]);

  return (
    <div className="chat-panel">
      <div className="chat-head">
        <div className="chat-title">
          <span className="chat-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </span>
          <div>
            <h3>Ask AI</h3>
            <p>Chat about this video — answers come only from the notes.</p>
          </div>
        </div>
      </div>

      <div className="chat-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>Ask anything about the video — key ideas, definitions, a quiz, or a simpler explanation.</p>
            <div className="chat-suggestions">
              {SUGGESTIONS.map(s => (
                <button key={s} className="chat-suggestion" onClick={() => send(s)} disabled={sending}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12, flexShrink: 0 }}><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role === 'user' ? 'chat-user' : 'chat-bot'}`}>
            {m.role === 'user' ? (
              <div className="chat-bubble chat-bubble-user">{m.content}</div>
            ) : (
              <div className="chat-bubble chat-bubble-bot">
                <MarkdownRenderer content={m.content} />
              </div>
            )}
          </div>
        ))}

        {sending && (
          <div className="chat-msg chat-bot">
            <div className="chat-bubble chat-bubble-bot chat-typing" aria-label="Assistant is typing">
              <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
            </div>
          </div>
        )}

        {error && (
          <div className="chat-error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, flexShrink: 0 }}><circle cx="12" cy="12" r="9"/><path d="M12 8v4m0 4h.01"/></svg>
            {error}
          </div>
        )}
      </div>

      <form className="chat-input-row" onSubmit={e => { e.preventDefault(); send(input); }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask about these notes…"
          aria-label="Ask about these notes"
          disabled={sending}
        />
        <button className="btn btn-primary" type="submit" disabled={sending || !input.trim()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
          Send
        </button>
      </form>
    </div>
  );
}
