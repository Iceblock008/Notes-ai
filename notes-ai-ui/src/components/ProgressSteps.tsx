interface ProgressStepsProps {
  currentStep: number;
  status: 'active' | 'done' | 'idle';
  message: string;
}

const steps = [
  { id: 1, name: 'Download audio', desc: 'Fetching the video track' },
  { id: 2, name: 'Transcribe', desc: 'Speech to text' },
  { id: 3, name: 'Generate notes', desc: 'Summarizing key points' },
  { id: 4, name: 'Save', desc: 'Stored to history' },
];

export function ProgressSteps({ currentStep, status, message }: ProgressStepsProps) {
  return (
    <div className="progress-card card">
      <div className="card-head">
        <h2>Processing</h2>
        <span className="pill accent">{message}</span>
      </div>
      <div className="steps">
        {steps.map((step, _i) => {
          const isActive = step.id === currentStep && status === 'active';
          const isDone = step.id < currentStep || (step.id === currentStep && status === 'done');
          return (
            <div key={step.id} className={`step ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`} data-step={step.id}>
              <div className="step-ico">
                <span className="num">{step.id}</span>
                <svg className="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
              </div>
              <div className="step-body">
                <div className="step-name">{step.name}</div>
                <div className="step-desc">{step.desc}</div>
              </div>
              {isActive && <div className="spin" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}