import { useEffect, useState } from 'react';

export function Coach({ processing, result, error }: { processing: boolean; result: boolean; error: boolean }) {
  const [phase, setPhase] = useState<'idle' | 'listening' | 'working' | 'done'>('idle');
  const [message, setMessage] = useState('');

  const phrases = {
    idle: ['Paste a video link to begin', 'Ready when you are', 'Waiting for a URL…'],
    listening: ['Analyzing the video…', 'Fetching the audio track…', 'Downloading…'],
    working: ['Transcribing speech…', 'Extracting key points…', 'Structuring your notes…'],
    done: ['All set! Your notes are ready', 'Done — copy or save them', 'Notes generated ✨'],
  };

  useEffect(() => {
    if (processing) {
      setPhase('listening');
      setMessage(phrases.listening[0]);
      const t1 = setTimeout(() => { setPhase('working'); setMessage(phrases.working[1]); }, 3000);
      const t2 = setTimeout(() => { setMessage(phrases.working[2]); }, 6000);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    } else if (result) {
      setPhase('done');
      setMessage(phrases.done[0]);
    } else if (error) {
      setPhase('idle');
      setMessage('Something went wrong — try again');
    } else {
      setPhase('idle');
      setMessage(phrases.idle[Math.floor(Math.random() * phrases.idle.length)]);
    }
  }, [processing, result, error]);

  if (phase === 'idle' && !result && !error) return null;

  return (
    <div className={`coach coach-${phase}`} aria-live="polite" role="status">
      <div className="coach-avatar">
        {phase === 'working' && <div className="coach-pulse" />}
        {phase === 'done' && <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>}
        {phase === 'listening' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 1-14 0"/></svg>}
        {(phase === 'idle' || phase === 'working') && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg>}
      </div>
      <div className="coach-bubble">{message}</div>
    </div>
  );
}