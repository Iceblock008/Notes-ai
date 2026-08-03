import { useEffect, useRef, useState, useCallback } from 'react';
import type { ChatMessage, ImportStatus, MemoryStats } from '../services/api';
import { api } from '../services/api';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useToast } from '../context/ToastContext';

interface MemoryPanelProps {
  onClose: () => void;
  onImportDone: (n: number) => void;
}

const MEMORY_SUGGESTIONS = [
  'Summarize what my saved notes cover',
  'What are the common themes across my videos?',
  'Quiz me based on my saved notes',
  'Which notes mention actionable tips?',
];

const URL_RE = /https?:\/\/[^\s,;"'<>()]+/g;

function extractUrls(text: string): string[] {
  const matches = text.match(URL_RE) || [];
  return matches
    .map(u => u.replace(/[.,;:!?]+$/, '').trim())
    .filter(u => u.length > 8);
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

export function MemoryPanel({ onClose, onImportDone }: MemoryPanelProps) {
  const { addToast } = useToast();
  const [tab, setTab] = useState<'import' | 'chat'>('import');
  const [stats, setStats] = useState<MemoryStats | null>(null);

  // Import state
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportStatus[]>([]);
  const [doneCount, setDoneCount] = useState(0);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadStats = useCallback(async () => {
    try { setStats(await api.getMemoryStats()); } catch { /* silent */ }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const handleFile = (file: File | undefined | null) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result || ''));
      addToast('File loaded — review the links and import');
    };
    reader.readAsText(file);
  };

  const urls = extractUrls(text);

  const startImport = async () => {
    if (urls.length === 0) { addToast('No valid video links found', 'error'); return; }
    setImporting(true);
    setResults([]);
    setDoneCount(0);
    try {
      const statuses = await api.importVideos(urls, (s) => {
        setResults(prev => {
          const idx = prev.findIndex(p => p.video_index === s.video_index);
          if (idx >= 0) { const next = [...prev]; next[idx] = s; return next; }
          return [...prev, s];
        });
        if (s.status === 'done' || s.status === 'error') setDoneCount(prev => prev + 1);
      });
      const ok = statuses.filter(s => s.status === 'done').length;
      addToast(`Import finished — ${ok}/${statuses.length} videos done`);
      if (ok > 0) onImportDone(ok);
      loadStats();
    } catch (e: any) {
      addToast(e.message || 'Import failed', 'error');
    } finally {
      setImporting(false);
    }
  };

  const sendMemory = useCallback(async (raw: string) => {
    const q = raw.trim();
    if (!q || sending) return;
    setChatError(null);
    const updated: ChatMessage[] = [...messages, { role: 'user', content: q }];
    setMessages(updated);
    setInput('');
    setSending(true);
    try {
      const res = await api.chatWithMemory(updated);
      if (res.status === 'success' && res.reply) {
        setMessages([...updated, { role: 'assistant', content: res.reply }]);
      } else {
        setChatError(res.error || 'Something went wrong');
      }
    } catch {
      setChatError('Network error — is the server running?');
    } finally {
      setSending(false);
    }
  }, [messages, sending]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal memory-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>Memory</h2>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
              {stats
                ? `${stats.count} videos · ${stats.total_words.toLocaleString()} words in memory`
                : 'Your personal video-knowledge memory'}
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="modal-tabs">
          <button className={`modal-tab ${tab === 'import' ? 'active' : ''}`} onClick={() => setTab('import')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/></svg>
            Import videos
          </button>
          <button className={`modal-tab ${tab === 'chat' ? 'active' : ''}`} onClick={() => setTab('chat')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Ask memory
          </button>
        </div>

        {tab === 'import' ? (
          <div className="memory-import">
            <div className="drop-zone" onClick={() => document.getElementById('memory-file')?.click()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 26, height: 26 }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
              </svg>
              <p><strong>{fileName || 'Drop a file of video links'}</strong></p>
              <p className="drop-hint">.txt file with one Instagram / YouTube / TikTok URL per line</p>
              <input id="memory-file" type="file" accept=".txt,.csv,.md" hidden
                onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />
            </div>

            <textarea
              className="memory-textarea"
              placeholder="…or paste video links here, one per line&#10;https://www.instagram.com/reel/…&#10;https://youtube.com/watch?v=…"
              value={text}
              onChange={e => setText(e.target.value)}
              disabled={importing}
              spellCheck={false}
            />

            <div className="memory-import-actions">
              <span className="hint">{urls.length > 0 ? `${urls.length} link${urls.length === 1 ? '' : 's'} detected` : 'No links yet'}</span>
              <button className="btn btn-primary" onClick={startImport} disabled={importing || urls.length === 0}>
                {importing ? (
                  <>
                    <span className="spin" style={{ width: 14, height: 14, borderWidth: 2, borderTopColor: '#fff', opacity: 1 }} />
                    Importing… {doneCount}/{urls.length}
                  </>
                ) : (
                  <>Import & generate notes</>
                )}
              </button>
            </div>

            {results.length > 0 && (
              <div className="import-list">
                {results.map(r => (
                  <div key={r.video_index} className={`import-item import-${r.status}`}>
                    <div className="import-ico">
                      {r.status === 'processing' && <span className="spin" style={{ width: 12, height: 12, borderWidth: 2, opacity: 1 }} />}
                      {r.status === 'done' && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="#3fb950" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                      )}
                      {r.status === 'error' && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="#f85149" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                      )}
                    </div>
                    <div className="import-body">
                      <div className="import-url">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 11, height: 11 }}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                        {truncate(hostOf(r.url), 32)}
                      </div>
                      <div className="import-msg">{r.message || r.url}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="chat-panel memory-chat">
            <div className="chat-messages" ref={scrollRef}>
              {messages.length === 0 && (
                <div className="chat-empty">
                  <p>
                    Ask anything across <strong>all</strong> your saved notes — the bot searches your
                    memory and answers from the most relevant videos.
                  </p>
                  <div className="chat-suggestions">
                    {MEMORY_SUGGESTIONS.map(s => (
                      <button key={s} className="chat-suggestion" onClick={() => sendMemory(s)} disabled={sending}>
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

              {chatError && (
                <div className="chat-error">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, flexShrink: 0 }}><circle cx="12" cy="12" r="9"/><path d="M12 8v4m0 4h.01"/></svg>
                  {chatError}
                </div>
              )}
            </div>

            <form className="chat-input-row" onSubmit={e => { e.preventDefault(); sendMemory(input); }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask your memory…"
                aria-label="Ask your memory"
                disabled={sending}
              />
              <button className="btn btn-primary" type="submit" disabled={sending || !input.trim()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                Send
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
