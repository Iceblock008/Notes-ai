import { useRef, useCallback } from 'react';
import { useToast } from '../context/ToastContext';

interface URLInputProps {
  onSubmit: (url: string) => void;
  disabled: boolean;
  loading: boolean;
}

const platforms = [
  { name: 'YouTube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', color: '#ff4b4b' },
  { name: 'Instagram', url: 'https://www.instagram.com/reel/CHB0r5MDQhZ/', color: '#e1306c' },
  { name: 'TikTok', url: 'https://www.tiktok.com/@scout2015/video/6718335390845097222', color: '#00f2ea' },
  { name: 'X', url: 'https://x.com/i/status/1850000000000000000', color: '#1d9bf0' },
  { name: 'Vimeo', url: 'https://vimeo.com/76979871', color: '#17b3e8' },
];

export function URLInput({ onSubmit, disabled, loading }: URLInputProps) {
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
        <button type="button" className="text-btn" onClick={handlePaste} disabled={loading}>Paste</button>
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
