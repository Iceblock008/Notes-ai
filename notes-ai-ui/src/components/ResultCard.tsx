import { useMemo } from 'react';
import type { Note } from '../services/api';
import { StreamingText } from './StreamingText';

interface ResultCardProps {
  note: Note;
  onCopy: () => void;
  onDownload: () => void;
  onShare: () => void;
  onDelete: () => void;
  onOpenModal: () => void;
  onAskAI: () => void;
}

export function ResultCard({ note, onCopy, onDownload, onShare, onDelete, onOpenModal, onAskAI }: ResultCardProps) {
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

  const stats = useMemo(() => {
    const words = note.output ? note.output.trim().split(/\s+/).filter(Boolean).length : 0;
    return { words, readMin: Math.max(1, Math.round(words / 200)) };
  }, [note.output]);

  const sourceHost = useMemo(() => {
    try { return new URL(note.url).hostname.replace(/^www\./, ''); } catch { return note.url; }
  }, [note.url]);

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
          <a className="source-chip" href={note.url} target="_blank" rel="noopener noreferrer" title={note.url}>
            <svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            {sourceHost}
          </a>
        </div>
        <div className="result-actions">
          <button className="icon-btn chat-launch-btn" onClick={onAskAI} title="Ask AI about these notes" aria-label="Ask AI about these notes">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </button>
          <button className="icon-btn" onClick={onCopy} title="Copy" aria-label="Copy notes">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <button className="icon-btn" onClick={onDownload} title="Download" aria-label="Download notes">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/></svg>
          </button>
          <button className="icon-btn" onClick={onShare} title="Share" aria-label="Share notes">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>
          </button>
          <button className="icon-btn" onClick={onDelete} title="Delete" aria-label="Delete note">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/></svg>
          </button>
        </div>
      </div>
      <StreamingText content={note.output} />
      <div className="result-stats">
        <span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 12, height: 12 }}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          {stats.words.toLocaleString()} words
        </span>
        <span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 12, height: 12 }}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          ~{stats.readMin} min read
        </span>
        <span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 12, height: 12 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          AI-generated
        </span>
      </div>
    </div>
  );
}
