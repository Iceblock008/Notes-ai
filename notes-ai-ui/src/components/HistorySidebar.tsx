import { useState, useEffect, useMemo } from 'react';
import type { Note } from '../services/api';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';

interface HistorySidebarProps {
  onSelectNote: (note: Note) => void;
  onOpenModal: (note: Note) => void;
  currentNoteId?: number;
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

function getPlatform(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '').split('.')[0]; }
  catch { return ''; }
}

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

const typePillColors: Record<string, string> = {
  'lecture': '#10b981',
  'tutorial': '#22d3ee',
  'podcast': '#a855f7',
  'news': '#fbbf24',
  'motivational': '#f472b6',
};

export function HistorySidebar({ onSelectNote, onOpenModal, currentNoteId }: HistorySidebarProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    try { setNotes(await api.getHistory(50)); } catch { /* silent */ } finally { setLoading(false); }
  };

  const handleDelete = async (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    if (!confirm('Delete this note?')) return;
    try {
      await api.deleteNote(note.id);
      setNotes(prev => prev.filter(n => n.id !== note.id));
      addToast('Note deleted');
    } catch { addToast('Delete failed', 'error'); }
  };

  if (loading) {
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
        <h2>Recent History</h2>
        <span className="view-all-link">View all</span>
      </div>

      <div className="history-cards">
        {notes.slice(0, 6).map(note => {
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
                <h3>{note.title}</h3>
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
        })}
      </div>

      {notes.length > 6 && (
        <button className="history-view-all">
          View all history →
        </button>
      )}
      {notes.length === 0 && (
        <div className="empty">No notes yet — paste a video link to start</div>
      )}
    </aside>
  );
}
