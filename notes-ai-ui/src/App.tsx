import { useState, useEffect, useCallback } from 'react';
import type { Note } from './services/api';
import { api } from './services/api';
import { URLInput } from './components/URLInput';
import { ProgressSteps } from './components/ProgressSteps';
import { ResultCard } from './components/ResultCard';
import { ErrorCard } from './components/ErrorCard';
import { HistorySidebar } from './components/HistorySidebar';
import { NoteModal } from './components/NoteModal';
import { useTheme } from './context/ThemeContext';
import { useToast } from './context/ToastContext';

function App() {
  const { theme, toggleTheme } = useTheme();
  const { addToast } = useToast();
  
  const [progressStep, setProgressStep] = useState(1);
  const [progressStatus, setProgressStatus] = useState<'active' | 'done' | 'idle'>('idle');
  const [progressMessage, setProgressMessage] = useState('Starting…');
  const [result, setResult] = useState<Note | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalNote, setModalNote] = useState<Note | null>(null);
  const [processing, setProcessing] = useState(false);

  // Load history on mount
  useEffect(() => {
    api.connect();
  }, []);

  const handleProcess = useCallback(async (url: string) => {
    setProcessing(true);
    setError(null);
    setResult(null);
    setProgressStep(1);
    setProgressStatus('active');
    setProgressMessage('Starting…');

    try {
      const res = await api.process(url);
      if (res.status === 'error') throw new Error(res.error);
      
      const note: Note = {
        id: res.id!,
        url,
        title: res.title!,
        content_type: res.content_type!,
        output: res.notes!,
        language: res.language!,
        created_at: new Date().toISOString(),
      };
      setResult(note);
      setProgressStep(4);
      setProgressStatus('done');
      setProgressMessage('Done!');
      addToast('Notes ready');
    } catch (err: any) {
      setError(err.message || 'Unknown error');
      setProgressStatus('idle');
      addToast('Something went wrong', 'error');
    } finally {
      setProcessing(false);
    }
  }, [addToast]);

  const handleRetry = () => {
    // URLInput will handle re-submission
    setError(null);
  };

  const handleNoteSelect = (note: Note) => {
    setResult(note);
    setError(null);
  };

  const handleOpenModal = (note: Note) => setModalNote(note);
  const handleCloseModal = () => setModalNote(null);

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.output).then(() => addToast('Copied')).catch(() => addToast('Copy failed', 'error'));
  };

  const handleDownload = () => {
    if (!result) return;
    const content = `Title: ${result.title}\nType: ${result.content_type}\nURL: ${result.url}\nCreated: ${result.created_at}\n\n${'='.repeat(60)}\n\n${result.output}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${result.title.replace(/[^\w\- ]+/g, '').slice(0, 60)}.txt`;
    document.body.appendChild(a); a.click(); a.remove();
    addToast('Downloaded');
  };

  const handleShare = async () => {
    if (!result) return;
    if (navigator.share) {
      try { await navigator.share({ title: result.title, text: result.output.slice(0, 4000) }); return; } catch {}
    }
    handleCopy();
  };

  const handleDelete = async () => {
    if (!result) return;
    if (!confirm('Delete this note?')) return;
    try {
      await api.deleteNote(result.id);
      setResult(null);
      addToast('Note deleted');
    } catch {
      addToast('Delete failed', 'error');
    }
  };

  const handleModalCopy = handleCopy;
  const handleModalDownload = handleDownload;
  const handleModalShare = handleShare;
  const handleModalDelete = handleDelete;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (modalNote) handleCloseModal();
        else (document.getElementById('url') as HTMLInputElement)?.focus();
      } else if (e.key === '/' && !processing) {
        if (document.activeElement !== document.getElementById('url') && 
            document.activeElement !== document.getElementById('searchInput')) {
          e.preventDefault();
          (document.getElementById('url') as HTMLInputElement)?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modalNote, processing]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/>
            </svg>
          </div>
          <div>
            <h1>Video Notes AI</h1>
            <p className="tagline">Turn any video URL into smart notes</p>
          </div>
        </div>
        <div className="top-actions">
          <button className="icon-btn" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            {theme === 'dark' ? (
              <svg className="ico-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>
              </svg>
            ) : (
              <svg className="ico-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>
              </svg>
            )}
          </button>
        </div>
      </header>

      <main className="grid">
        <section className="col-main">
          <URLInput onSubmit={handleProcess} disabled={processing} loading={processing} />
          
          {processing && (
            <ProgressSteps 
              currentStep={progressStep} 
              status={progressStatus} 
              message={progressMessage} 
            />
          )}

          {result && <ResultCard 
            note={result} 
            onCopy={handleCopy} 
            onDownload={handleDownload} 
            onShare={handleShare} 
            onDelete={handleDelete} 
            onOpenModal={() => handleOpenModal(result)} 
          />}

          {error && <ErrorCard message={error} onRetry={handleRetry} />}
        </section>

        <aside className="col-side">
          <HistorySidebar 
            onSelectNote={handleNoteSelect} 
            currentNoteId={result?.id} 
          />
        </aside>
      </main>

      <footer className="footer">
        Server: <code>{window.location.origin}</code>
      </footer>

      <NoteModal
        note={modalNote}
        onClose={handleCloseModal}
        onCopy={handleModalCopy}
        onDownload={handleModalDownload}
        onShare={handleModalShare}
        onDelete={handleModalDelete}
      />
    </div>
  );
}

export default App;