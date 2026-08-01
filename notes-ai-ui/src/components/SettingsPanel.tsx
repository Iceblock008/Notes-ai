import { useSettings } from '../context/SettingsContext';

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { theme, setTheme, groqKeyValid, assemblyKeyValid, checkKeys } = useSettings();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal settings-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="modal-body" style={{ padding: '8px 24px 16px', overflowY: 'auto', maxHeight: '60vh' }}>
          <section style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 14 }}>Appearance</h3>
            <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Theme</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>Choose light or dark mode</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className={`btn ${theme === 'dark' ? 'btn-primary' : ''}`}
                  onClick={() => setTheme('dark')}
                  style={{ minWidth: 100 }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>
                  <span style={{ marginLeft: 6 }}>Dark</span>
                </button>
                <button
                  className={`btn ${theme === 'light' ? 'btn-primary' : ''}`}
                  onClick={() => setTheme('light')}
                  style={{ minWidth: 100 }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
                  <span style={{ marginLeft: 6 }}>Light</span>
                </button>
              </div>
            </div>
          </section>

          <section style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 14 }}>API Keys Status</h3>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="pill type" style={{ fontSize: 11 }}>Groq</div>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>LLM for note generation</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {groqKeyValid === null ? (
                    <span className="pill ghost" style={{ fontSize: 11 }}>Checking…</span>
                  ) : groqKeyValid ? (
                    <>
                      <span className="pill success" style={{ fontSize: 11 }}>Valid</span>
                    </>
                  ) : (
                    <>
                      <span className="pill" style={{ fontSize: 11, background: 'rgba(248,81,73,.14)', color: 'var(--danger)', borderColor: 'rgba(248,81,73,.3)' }}>Invalid</span>
                    </>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="pill type" style={{ fontSize: 11 }}>AssemblyAI</div>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Speech-to-text</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {assemblyKeyValid === null ? (
                    <span className="pill ghost" style={{ fontSize: 11 }}>Checking…</span>
                  ) : assemblyKeyValid ? (
                    <span className="pill success" style={{ fontSize: 11 }}>Valid</span>
                  ) : (
                    <span className="pill" style={{ fontSize: 11, background: 'rgba(248,81,73,.14)', color: 'var(--danger)', borderColor: 'rgba(248,81,73,.3)' }}>Invalid</span>
                  )}
                </div>
              </div>
              <button className="btn" onClick={checkKeys} style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><path d="M23 4v6"/><path d="M1 20v-6"/><path d="M3.5 9a9 9 0 0 0 15 15"/><path d="M15.5 15a9 9 0 0 1-15-15"/></svg>
                Re-check
              </button>
            </div>
          </section>

          <section>
            <h3 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 14 }}>Shortcuts</h3>
            <div className="card" style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 10, alignItems: 'center', fontSize: 13 }}>
                <kbd style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px', fontFamily: 'var(--mono)', fontSize: 11.5 }}>⌘ /</kbd>
                <span>Focus URL input</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 10, alignItems: 'center', fontSize: 13 }}>
                <kbd style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px', fontFamily: 'var(--mono)', fontSize: 11.5 }}>Esc</kbd>
                <span>Close modal / focus input</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 10, alignItems: 'center', fontSize: 13 }}>
                <kbd style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px', fontFamily: 'var(--mono)', fontSize: 11.5 }}>⌘ K</kbd>
                <span>Open settings (soon)</span>
              </div>
            </div>
          </section>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}