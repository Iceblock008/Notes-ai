import { useState, useEffect, useRef } from 'react';

interface ProcessingStepsProps {
  currentStep: number;
  status: 'active' | 'done' | 'idle';
  message: string;
  progressPercent?: number;
  progressLabel?: string;
}

const steps = [
  { id: 1, name: 'Downloading', desc: 'Extracting audio from video', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> },
  { id: 2, name: 'Transcribing', desc: 'Converting speech to text', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg> },
  { id: 3, name: 'Generating Notes', desc: 'AI is analyzing and creating notes', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg> },
  { id: 4, name: 'Saving', desc: 'Notes saved to your history', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
];

function useElapsed() {
  const startRef = useRef(Date.now());
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    startRef.current = Date.now();
    setSeconds(0);
    const iv = setInterval(() => setSeconds(Math.floor((Date.now() - startRef.current) / 1000)), 500);
    return () => clearInterval(iv);
  }, []);
  return seconds;
}

export function ProcessingSteps({ currentStep, status, message, progressPercent = 0, progressLabel }: ProcessingStepsProps) {
  const elapsed = useElapsed();
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  if (status === 'idle') return null;

  return (
    <div className="processing-panel card">
      <div className="processing-head">
        <h2>Processing Steps</h2>
        <span className="processing-live">
          <span className="live-dot" /> Live
        </span>
      </div>

      <div className="processing-steps-row">
        {steps.map((step, idx) => {
          const isActive = step.id === currentStep && status === 'active';
          const isDone = step.id < currentStep || (step.id === currentStep && status === 'done');
          return (
            <div key={step.id} className={`proc-step ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
              <div className="proc-step-circle">
                {isDone ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{width:20,height:20}}><path d="M20 6 9 17l-5-5"/></svg>
                ) : (
                  <span className="proc-step-icon">{step.icon}</span>
                )}
              </div>
              <div className="proc-step-text">
                <strong>{step.name}</strong>
                <span>{step.desc}</span>
              </div>
              {idx < steps.length - 1 && <div className={`proc-step-line ${isDone ? 'done' : ''}`} />}
            </div>
          );
        })}
      </div>

      <div className="processing-progress">
        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="progress-info">
          <span className="progress-label">{progressLabel || message}</span>
          <span className="progress-pct">{progressPercent}%</span>
        </div>
      </div>

      <div className="progress-timer">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{width:13,height:13}}>
          <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
        </svg>
        <span>Elapsed <span className="timer">{fmt(elapsed)}</span></span>
      </div>
    </div>
  );
}
