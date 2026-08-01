import type { Note } from '../services/api';
import { MarkdownRenderer } from './MarkdownRenderer';

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
          <a href={note.url} target="_blank" rel="noopener noreferrer">{note.url}</a>
        </div>
        <div className="markdown modal-body">
          <MarkdownRenderer content={note.output} />
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onCopy}>Copy</button>
          <button className="btn" onClick={onDownload}>Download</button>
          <button className="btn" onClick={onShare}>Share</button>
          <button className="btn btn-danger" onClick={onDelete}>Delete</button>
        </div>
      </div>
    </div>
  );
}