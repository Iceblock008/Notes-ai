import { useState, useEffect, useMemo } from 'react';
import type { Note } from '../services/api';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';

interface HistorySidebarProps {
  onSelectNote: (note: Note) => void;
  currentNoteId?: number;
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function groupLabel(iso: string) {
  const today = dayKey(new Date().toISOString());
  const diff = (today - dayKey(iso)) / 86400000;
  if (diff < 1) return 'Today';
  if (diff < 2) return 'Yesterday';
  if (diff < 7) return 'This week';
  return 'Earlier';
}

const groupOrder = ['Today', 'Yesterday', 'This week', 'Earlier'];

export function HistorySidebar({ onSelectNote, currentNoteId }: HistorySidebarProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    try {
      const data = await api.getHistory(50);
      setNotes(data);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() =>
    notes.filter(n =>
      !search || (n.title + ' ' + n.content_type + ' ' + n.language).toLowerCase().includes(search.toLowerCase())
    ), [notes, search]);

  const groups = useMemo(() => {
    const map: Record<string, Note[]> = {};
    for (const n of filtered) {
      const g = groupLabel(n.created_at);
      (map[g] = map[g] || []).push(n);
    }
    return groupOrder.filter(g => map[g]).map(g => ({ label: g, items: map[g] }));
  }, [filtered]);

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (d >= today) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch { return ''; }
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
      <div className="card">
        <div className="card-head"><h2>History</h2><span className="pill ghost">…</span></div>
        <div className="skeleton skel-head" />
        <div className="skeleton skel-line w80" />
        <div className="skeleton skel-line w60" />
        <div className="skeleton skel-line w80" />
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>History</h2>
        <span className="pill ghost">{notes.length}</span>
      </div>
      <div className="search-row">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <input
          type="search"
          placeholder="Search notes…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Search notes"
        />
      </div>
      <div className="history-list">
        {filtered.length === 0 ? (
          <div className="empty">
            <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
            {notes.length === 0 ? 'No notes yet — paste a video link to start' : 'No matches for your search'}
          </div>
        ) : (
          groups.map(group => (
            <div key={group.label}>
              <div className="history-group-label">{group.label}</div>
              {group.items.map(note => (
                <button
                  key={note.id}
                  className={`h-item ${note.id === currentNoteId ? 'active' : ''}`}
                  onClick={() => onSelectNote(note)}
                  onContextMenu={e => { e.preventDefault(); handleDelete(e, note); }}
                  title="Right-click to delete"
                >
                  <h3>{note.title}</h3>
                  <div className="h-meta">
                    <span className="h-type">{note.content_type}</span>
                    <span>{note.language.toUpperCase()}</span>
                    <span className="h-date">{formatDate(note.created_at)}</span>
                  </div>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
