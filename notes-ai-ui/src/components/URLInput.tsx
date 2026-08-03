import { useRef, useCallback } from 'react';
import { useToast } from '../context/ToastContext';

interface URLInputProps {
  onSubmit: (url: string) => void;
  disabled: boolean;
  loading: boolean;
  onBatchImport?: () => void;
}

const platforms = [
  { name: 'YouTube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', color: '#ff4b4b' },
  { name: 'Instagram', url: 'https://www.instagram.com/reel/CHB0r5MDQhZ/', color: '#e1306c' },
  { name: 'TikTok', url: 'https://www.tiktok.com/@scout2015/video/6718335390845097222', color: '#00f2ea' },
  { name: 'X', url: 'https://x.com/i/status/1850000000000000000', color: '#1d9bf0' },
  { name: 'Vimeo', url: 'https://vimeo.com/76979871', color: '#17b3e8' },
];

export function URLInput({ onSubmit, disabled, loading, onBatchImport }: URLInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const url = inputRef.current?.value.trim();
    if (!url) { inputRef.current?.focus(); return; }
    onSubmit(url);
  }, [onSubmit]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (inputRef.current) {
        inputRef.current.value = text.trim();
        inputRef.current.focus();
        addToast('Pasted from clipboard');
      }
    } catch {
      addToast('Clipboard access blocked', 'error');
    }
  };

  const handlePlatform = (url: string) => {
    if (inputRef.current) {
      inputRef.current.value = url;
      inputRef.current.focus();
      addToast('Sample URL filled — press Generate');
    }
  };

  return (
    <form className="card input-card" onSubmit={handleSubmit}>
      <label className="field-label" htmlFor="url">Video URL</label>
      <div className="url-row">
        <input
          ref={inputRef}
          id="url"
          type="url"
          inputMode="url"
          placeholder="Paste any video link…"
          autoComplete="url"
          spellCheck={false}
          enterKeyHint="go"
          disabled={disabled || loading}
        />
        <button className="btn btn-primary" type="submit" disabled={disabled || loading}>
          {loading ? 'Working…' : 'Generate'}
        </button>
      </div>
      <div className="hint-row">
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <button type="button" className="text-btn" onClick={handlePaste} disabled={loading}>Paste</button>
          {onBatchImport && (
            <button type="button" className="text-btn" onClick={onBatchImport} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>
              Upload file of links
            </button>
          )}
        </div>
        <span className="hint">YouTube · Instagram · TikTok · X · Vimeo</span>
      </div>
      <div className="platform-row">
        <span className="platform-hint">Or try a demo:</span>
        <div className="platform-chips">
          {platforms.map(p => (
            <button
              key={p.name}
              type="button"
              className="platform-chip"
              onClick={() => handlePlatform(p.url)}
              disabled={loading}
              style={{ ['--chip-color' as any]: p.color }}
            >
              <span className="platform-dot" />
              {p.name}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}
