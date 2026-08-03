import { useState, useEffect, useRef } from 'react';
import type { Note } from '../services/api';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';

interface HistorySidebarProps {
  onSelectNote: (note: Note) => void;
  currentNoteId?: number;
  /** Increment to force a refresh (e.g. after a new note is generated). */
  refreshKey?: number;
}

const platformColors: Record<string, string> = {
  youtube: '#ff0000',
  instagram: '#e1306c',
  tiktok: '#00f2ea',
  'twitter.com': '#1d9bf0',
  'x.com': '#1d9bf0',
  reddit: '#ff4500',
  vimeo: '#17b3e8',
};

function getPlatformColor(url: string): string {
  const h = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }})();
  for (const [k, v] of Object.entries(platformColors)) { if (h.includes(k)) return v; }
  return '#10b981';
}

function shortDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today, ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday, ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ago';
}

// Render text with every case-insensitive match of `q` wrapped in <mark>
function Highlight({ text, q }: { text: string; q: string }) {
  const ql = q.trim().toLowerCase();
  if (!ql) return <>{text}</>;
  const lower = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  let idx = lower.indexOf(ql);
  while (idx !== -1) {
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(<mark key={idx}>{text.slice(idx, idx + ql.length)}</mark>);
    i = idx + ql.length;
    idx = lower.indexOf(ql, i);
  }
  if (i < text.length) parts.push(text.slice(i));
  return <>{parts}</>;
}

// Short excerpt of the note body around the first keyword match
function makeSnippet(output: string, q: string, maxLen = 170): string {
  const clean = output.replace(/\s+/g, ' ').trim();
  const ql = q.trim().toLowerCase();
  const idx = ql ? clean.toLowerCase().indexOf(ql) : -1;
  if (idx === -1) return clean.slice(0, maxLen);
  const start = Math.max(0, idx - 55);
  const end = Math.min(clean.length, idx + ql.length + 95);
  return (start > 0 ? '…' : '') + clean.slice(start, end) + (end < clean.length ? '…' : '');
}

export function HistorySidebar({ onSelectNote, currentNoteId, refreshKey }: HistorySidebarProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Note[] | null>(null); // null => not searching
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchId = useRef(0);
  const { addToast } = useToast();

  // Reload the recent list whenever a new note is generated/imported.
  useEffect(() => { loadHistory(); }, [refreshKey]);

  const loadHistory = async () => {
    try { setNotes(await api.getHistory(50)); } catch { /* silent */ } finally { setLoading(false); }
  };

  // Debounced full-text search over ALL saved notes (limit -1 = no cap).
  // searchId discards stale responses if the query changed mid-flight.
  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults(null); setSearching(false); return; }
    const id = ++searchId.current;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await api.getHistory(-1, q);
        if (searchId.current === id) setResults(res);
      } catch {
        if (searchId.current === id) setResults([]);
      }
      if (searchId.current === id) setSearching(false);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, refreshKey]);

  const clearSearch = () => { setQuery(''); searchRef.current?.focus(); };

  const handleDelete = async (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    if (!confirm('Delete this note?')) return;
    try {
      await api.deleteNote(note.id);
      setNotes(prev => prev.filter(n => n.id !== note.id));
      setResults(prev => prev ? prev.filter(n => n.id !== note.id) : prev);
      addToast('Note deleted');
    } catch { addToast('Delete failed', 'error'); }
  };

  const activeQuery = query.trim();
  const searchingActive = activeQuery !== '';

  const renderCard = (note: Note) => {
    const color = getPlatformColor(note.url);
    return (
      <button
        key={note.id}
        className={`history-card ${note.id === currentNoteId ? 'active' : ''}`}
        onClick={() => onSelectNote(note)}
      >
        <div className="history-card-thumb" style={{ borderColor: color }}>
          <div className="thumb-placeholder" style={{ background: `linear-gradient(135deg, ${color}22, ${color}11)` }}>
            <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{width:20,height:20,opacity:.6}}>
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </div>
          <div className="thumb-duration" style={{ background: color }}>1:{Math.floor(Math.random() * 59).toString().padStart(2, '0')}</div>
        </div>
        <div className="history-card-info">
          <h3><Highlight text={note.title} q={activeQuery} /></h3>
          {searchingActive && (
            <div className="history-snippet"><Highlight text={makeSnippet(note.output, activeQuery)} q={activeQuery} /></div>
          )}
          <div className="history-card-meta">
            <span className="history-date">{shortDate(note.created_at)}</span>
            <span className="history-type-pill" style={{ color, borderColor: color + '40' }}>{note.content_type}</span>
          </div>
        </div>
        <button className="history-card-menu" onClick={e => { e.stopPropagation(); handleDelete(e, note); }} title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </button>
      </button>
    );
  };

  if (loading && !searchingActive) {
    return (
      <aside className="history-panel">
        <div className="history-panel-head"><h2>Recent History</h2><span className="view-all-link">View all</span></div>
        {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12, marginBottom: 10 }} />)}
      </aside>
    );
  }

  return (
    <aside className="history-panel">
      <div className="history-panel-head">
        <h2>{searchingActive ? 'Search results' : 'Recent History'}</h2>
        {!searchingActive && (
          <span className="view-all-link" onClick={() => searchRef.current?.focus()}>View all</span>
        )}
      </div>

      <div className="history-search">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <input
          ref={searchRef}
          id="searchInput"
          type="search"
          placeholder="Search all notes…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Search all notes"
        />
        {activeQuery && (
          <button className="history-search-clear" onClick={clearSearch} title="Clear search" aria-label="Clear search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      {searchingActive ? (
        searching ? (
          <div className="empty">Searching…</div>
        ) : results && results.length > 0 ? (
          <>
            <div className="history-result-count">{results.length} result{results.length === 1 ? '' : 's'} for “{activeQuery}”</div>
            <div className="history-cards">{results.map(renderCard)}</div>
          </>
        ) : (
          <div className="empty">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            No notes match “{activeQuery}”
          </div>
        )
      ) : (
        <>
          <div className="history-cards">
            {notes.slice(0, 6).map(renderCard)}
          </div>

          {notes.length > 6 && (
            <button className="history-view-all" onClick={() => searchRef.current?.focus()}>
              View all history →
            </button>
          )}
          {notes.length === 0 && (
            <div className="empty">No notes yet — paste a video link to start</div>
          )}
        </>
      )}
    </aside>
  );
}
