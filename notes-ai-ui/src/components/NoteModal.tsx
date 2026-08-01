import type { Note } from '../services/api';
import { StreamingText } from './StreamingText';

interface NoteModalProps {
  note: Note | null;
  onClose: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onShare: () => void;
  onDelete: () => void;
}

export function NoteModal({ note, onClose, onCopy, onDownload, onShare, onDelete }: NoteModalProps) {
  if (!note) return null;

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
        ' at ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    } catch { return ''; }
  };

  const langLabel = (code: string) => {
    try { return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code.toUpperCase(); }
    catch { return code.toUpperCase(); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{note.title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="modal-meta">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
            <span className="pill type">{note.content_type}</span>
            <span className="pill ghost">{langLabel(note.language)}</span>
            <span className="pill ghost">{formatDate(note.created_at)}</span>
          </div>
          <a href={note.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: 'var(--accent-1)', textDecoration: 'none', wordBreak: 'break-all' }}>
            {note.url}
          </a>
        </div>
        <div className="modal-body markdown">
          <StreamingText content={note.output} />
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onCopy}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copy
          </button>
          <button className="btn" onClick={onDownload}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/></svg>
            Download
          </button>
          <button className="btn" onClick={onShare}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>
            Share
          </button>
          <button className="btn btn-danger" onClick={onDelete}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/></svg>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}