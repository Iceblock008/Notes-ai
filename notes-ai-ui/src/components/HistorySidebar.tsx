import { useState, useEffect } from 'react';
import type { Note } from '../services/api';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';

interface HistorySidebarProps {
  onSelectNote: (note: Note) => void;
  currentNoteId?: number;
}

export function HistorySidebar({ onSelectNote, currentNoteId }: HistorySidebarProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await api.getHistory(50);
      setNotes(data);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  const filteredNotes = notes.filter(n => 
    !search || (n.title + ' ' + n.content_type + ' ' + n.language).toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch { return ''; }
  };

  const handleDelete = async (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    if (!confirm('Delete this note?')) return;
    try {
      await api.deleteNote(note.id);
      setNotes(prev => prev.filter(n => n.id !== note.id));
      addToast('Note deleted');
    } catch {
      addToast('Delete failed', 'error');
    }
  };

  if (loading) return <div className="card history-card"><div className="card-skeleton" /></div>;

  return (
    <div className="card history-card">
      <div className="card-head">
        <h2>History</h2>
        <span className="pill ghost">{notes.length}</span>
      </div>
      <div className="search-row">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>
        </svg>
        <input 
          type="search" 
          placeholder="Search notes…" 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          aria-label="Search notes"
        />
      </div>
      <div className="history-list">
        {filteredNotes.length === 0 ? (
          <div className="empty" style={{padding: '20px', textAlign: 'center', color: 'var(--muted)'}}>
            {notes.length === 0 ? 'No notes yet' : 'No matches'}
          </div>
        ) : (
          filteredNotes.map(note => (
            <button
              key={note.id}
              className={`h-item ${note.id === currentNoteId ? 'active' : ''}`}
              onClick={() => onSelectNote(note)}
              onContextMenu={e => { e.preventDefault(); handleDelete(e, note); }}
            >
              <h3>{note.title}</h3>
              <div className="h-meta">
                <span className="h-type">{note.content_type}</span>
                <span>{note.language.toUpperCase()}</span>
                <span className="h-date">{formatDate(note.created_at)}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}