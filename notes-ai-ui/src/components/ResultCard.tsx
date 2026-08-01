import type { Note } from '../services/api';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ResultCardProps {
  note: Note;
  onCopy: () => void;
  onDownload: () => void;
  onShare: () => void;
  onDelete: () => void;
  onOpenModal: () => void;
}

export function ResultCard({ note, onCopy, onDownload, onShare, onDelete, onOpenModal }: ResultCardProps) {
  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + 
        ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    } catch { return ''; }
  };

  const langLabel = (code: string) => {
    try { return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code.toUpperCase(); } 
    catch { return code.toUpperCase(); }
  };

  return (
    <div className="card result-card">
      <div className="result-head">
        <div style={{ minWidth: 0 }}>
          <div className="result-meta">
            <span className="pill type">{note.content_type}</span>
            <span className="pill ghost">{langLabel(note.language)}</span>
            <span className="pill ghost">{formatDate(note.created_at)}</span>
          </div>
          <h2 onClick={onOpenModal} style={{ cursor: 'pointer' }}>{note.title}</h2>
        </div>
        <div className="result-actions">
          <button className="icon-btn" onClick={onCopy} title="Copy" aria-label="Copy notes">
            <svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <button className="icon-btn" onClick={onDownload} title="Download" aria-label="Download notes">
            <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/></svg>
          </button>
          <button className="icon-btn" onClick={onShare} title="Share" aria-label="Share notes">
            <svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>
          </button>
          <button className="icon-btn" onClick={onDelete} title="Delete" aria-label="Delete note">
            <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/></svg>
          </button>
        </div>
      </div>
      <MarkdownRenderer content={note.output} />
    </div>
  );
}