import { useRef, useState, useEffect } from 'react';
import type { ImportStatus } from '../services/api';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';

interface BatchImportCardProps {
  onImportDone: (n: number) => void;
}

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

export function BatchImportCard({ onImportDone }: BatchImportCardProps) {
  const { addToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportStatus[]>([]);
  const [doneCount, setDoneCount] = useState(0);

  const urls = extractUrls(text);

  // Auto-scroll newest result into view
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [results]);

  const handleFile = (file: File | undefined | null) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result || ''));
      addToast('File loaded — press Import to start');
    };
    reader.readAsText(file);
  };

  const startImport = async () => {
    if (urls.length === 0) { addToast('No video links found in the file', 'error'); return; }
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
      addToast(`Finished — ${ok}/${statuses.length} reels done`);
      if (ok > 0) onImportDone(ok);
    } catch (e: any) {
      addToast(e.message || 'Import failed', 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="card batch-card">
      <div className="batch-head">
        <div className="batch-title">
          <div className="batch-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/>
            </svg>
          </div>
          <div>
            <h2>Import multiple reels at once</h2>
            <p>Upload a file with video links (one URL per line) — notes are generated for every reel automatically.</p>
          </div>
        </div>
      </div>

      <div className="drop-zone" onClick={() => fileRef.current?.click()} style={{ marginBottom: 0 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 26, height: 26 }}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>
        </svg>
        <p><strong>{fileName || 'Drop a .txt file of video links here'}</strong></p>
        <p className="drop-hint">or click to browse · Instagram / YouTube / TikTok / X links, one per line</p>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.csv,.md"
          hidden
          onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
        />
      </div>

      <textarea
        className="memory-textarea"
        style={{ minHeight: 90 }}
        placeholder="…or paste links here, one per line&#10;https://www.instagram.com/reel/…&#10;https://youtube.com/watch?v=…"
        value={text}
        onChange={e => setText(e.target.value)}
        disabled={importing}
        spellCheck={false}
      />

      <div className="memory-import-actions">
        <span className="hint">
          {urls.length > 0
            ? `${urls.length} link${urls.length === 1 ? '' : 's'} detected`
            : 'No links yet'}
        </span>
        <button className="btn btn-primary" onClick={startImport} disabled={importing || urls.length === 0}>
          {importing ? (
            <>
              <span className="spin" style={{ width: 14, height: 14, borderWidth: 2, borderTopColor: '#fff', opacity: 1 }} />
              Generating… {doneCount}/{urls.length}
            </>
          ) : (
            <>Import & generate notes</>
          )}
        </button>
      </div>

      {results.length > 0 && (
        <div className="import-list" ref={listRef} style={{ maxHeight: 200, overflowY: 'auto' }}>
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
  );
}
