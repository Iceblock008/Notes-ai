import { useState, useEffect, useCallback } from 'react';
import type { Note } from './services/api';
import { api } from './services/api';
import { Sidebar } from './components/Sidebar';
import { URLInput } from './components/URLInput';
import { ProcessingSteps } from './components/ProcessingSteps';
import { ResultCard } from './components/ResultCard';
import { ErrorCard } from './components/ErrorCard';
import { HistorySidebar } from './components/HistorySidebar';
import { NoteModal } from './components/NoteModal';
import { SettingsPanel } from './components/SettingsPanel';
import { MemoryPanel } from './components/MemoryPanel';
import { SettingsProvider } from './context/SettingsContext';
import { useTheme } from './context/ThemeContext';
import { useToast } from './context/ToastContext';

function AppContent() {
  const { theme, toggleTheme } = useTheme();
  const { addToast } = useToast();

  const [activeNav, setActiveNav] = useState('new');
  const [progressStep, setProgressStep] = useState(1);
  const [progressStatus, setProgressStatus] = useState<'active' | 'done' | 'idle'>('idle');
  const [progressMessage, setProgressMessage] = useState('Starting…');
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [result, setResult] = useState<Note | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalNote, setModalNote] = useState<Note | null>(null);
  const [modalChat, setModalChat] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => { api.connect(); }, []);

  // Track processing progress from WebSocket
  useEffect(() => {
    const unsub = api.onProgress?.((msg: any) => {
      if (msg.step !== undefined) setProgressStep(msg.step);
      if (msg.status) setProgressStatus(msg.status);
      if (msg.message) setProgressMessage(msg.message);
      if (msg.percent !== undefined) setProgressPercent(msg.percent);
      if (msg.label) setProgressLabel(msg.label);
    });
    return () => { if (unsub) unsub(); };
  }, []);

  const handleProcess = useCallback(async (url: string) => {
    setProcessing(true);
    setError(null);
    setResult(null);
    setProgressStep(1);
    setProgressStatus('active');
    setProgressMessage('Starting…');
    setProgressPercent(0);
    setProgressLabel('Initializing…');

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
      setProgressPercent(100);
      addToast('Notes ready');
    } catch (err: any) {
      setError(err.message || 'Unknown error');
      setProgressStatus('idle');
      setProgressPercent(0);
      addToast('Something went wrong', 'error');
    } finally {
      setProcessing(false);
    }
  }, [addToast]);

  const handleRetry = () => { setError(null); };
  const handleNoteSelect = (note: Note) => { setResult(note); setError(null); setActiveNav('new'); };
  const handleOpenModal = (note: Note) => { setModalNote(note); setModalChat(false); };
  const handleAskAI = (note: Note) => { setModalNote(note); setModalChat(true); };
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
    } catch { addToast('Delete failed', 'error'); }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (modalNote) handleCloseModal();
        else if (settingsOpen) setSettingsOpen(false);
        else if (memoryOpen) setMemoryOpen(false);
        else (document.getElementById('url') as HTMLInputElement)?.focus();
      } else if (e.key === '/' && !processing) {
        if (document.activeElement !== document.getElementById('url') &&
            document.activeElement !== document.getElementById('searchInput')) {
          e.preventDefault();
          (document.getElementById('url') as HTMLInputElement)?.focus();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSettingsOpen(true);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modalNote, settingsOpen, memoryOpen, processing]);

  return (
    <div className="app-layout">
      {/* Left sidebar */}
      <Sidebar
        activeNav={activeNav}
        onNavChange={setActiveNav}
        onMemoryOpen={() => setMemoryOpen(true)}
        onSettingsOpen={() => setSettingsOpen(true)}
      />

      {/* Center main content */}
      <main className="main-content">
        {/* Hero section */}
        <section className="main-hero">
          <h1>Create Notes from <span className="hero-accent">Any Video</span></h1>
          <p>Paste a video URL from YouTube, Twitter, Reddit, Instagram, TikTok, Vimeo and more.</p>
        </section>

        {/* URL Input */}
        <URLInput onSubmit={handleProcess} disabled={processing} loading={processing} />

        {/* Processing Steps */}
        <ProcessingSteps
          currentStep={progressStep}
          status={progressStatus}
          message={progressMessage}
          progressPercent={progressPercent}
          progressLabel={progressLabel}
        />

        {/* Result Card */}
        {result && (
          <ResultCard
            note={result}
            onCopy={handleCopy}
            onDownload={handleDownload}
            onShare={handleShare}
            onDelete={handleDelete}
            onOpenModal={() => handleOpenModal(result)}
            onAskAI={() => handleAskAI(result)}
          />
        )}

        {/* Error Card */}
        {error && <ErrorCard message={error} onRetry={handleRetry} />}
      </main>

      {/* Right history sidebar */}
      <HistorySidebar
        onSelectNote={handleNoteSelect}
        onOpenModal={handleOpenModal}
        currentNoteId={result?.id}
      />

      {/* Modals */}
      <NoteModal
        key={modalNote ? (modalChat ? `${modalNote.id}-chat` : `${modalNote.id}-notes`) : 'none'}
        note={modalNote}
        initialTab={modalChat ? 'chat' : 'notes'}
        onClose={handleCloseModal}
        onCopy={handleCopy}
        onDownload={handleDownload}
        onShare={handleShare}
        onDelete={handleDelete}
      />

      {memoryOpen && (
        <MemoryPanel
          onClose={() => setMemoryOpen(false)}
          onImportDone={(n) => addToast(`${n} video${n === 1 ? '' : 's'} added to memory`)}
        />
      )}

      {settingsOpen && (
        <SettingsPanel onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}

function App() {
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  );
}

export default App;
