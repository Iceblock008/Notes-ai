import { useRef, useCallback } from 'react';
import { useToast } from '../context/ToastContext';

interface URLInputProps {
  onSubmit: (url: string) => void;
  disabled: boolean;
  loading: boolean;
}

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

  return (
    <form className="card" onSubmit={handleSubmit}>
      <div className="card-head">
        <h2>New Video</h2>
        <span className="pill success">Ready</span>
      </div>
      <label className="field-label" htmlFor="url">Video URL</label>
      <div className="url-row">
        <input
          ref={inputRef}
          id="url"
          type="url"
          inputMode="url"
          placeholder="https://youtube.com/watch?v=..."
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
        <span className="hint">YouTube · Instagram · Twitter/X · TikTok · Vimeo</span>
      </div>
    </form>
  );
}