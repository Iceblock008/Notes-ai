import { useState, useEffect, useRef, useMemo } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface StreamingTextProps {
  content: string;
  onDone?: () => void;
}

export function StreamingText({ content, onDone }: StreamingTextProps) {
  const paragraphs = useMemo(() => content.split(/\n\s*\n/).filter(p => p.trim()), [content]);
  const [reveal, setReveal] = useState(0);
  const [lastText, setLastText] = useState('');
  const revealRef = useRef(0);
  const lastRef = useRef('');
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    revealRef.current = 0;
    lastRef.current = '';
    doneRef.current = false;
    setReveal(0);
    setLastText('');
    if (paragraphs.length === 0) { onDoneRef.current?.(); return; }

    const iv = setInterval(() => {
      if (doneRef.current) { clearInterval(iv); return; }
      const idx = revealRef.current;
      if (idx >= paragraphs.length) { clearInterval(iv); return; }
      const target = paragraphs[idx];
      const prev = lastRef.current;
      const nextLen = prev.length + Math.max(1, Math.round(target.length / 50));
      if (nextLen >= target.length) {
        revealRef.current = idx + 1;
        lastRef.current = '';
        setReveal(idx + 1);
        setLastText('');
        if (idx + 1 >= paragraphs.length) {
          doneRef.current = true;
          clearInterval(iv);
          onDoneRef.current?.();
        }
      } else {
        lastRef.current = target.slice(0, nextLen);
        setLastText(lastRef.current);
      }
    }, 14);
    return () => clearInterval(iv);
  }, [paragraphs]);

  const full = paragraphs.slice(0, reveal).join('\n\n');

  if (reveal >= paragraphs.length) return <MarkdownRenderer content={content} />;

  return (
    <div className="stream-wrap">
      {full && <MarkdownRenderer content={full} />}
      {lastText && (
        <div className="stream-partial">{lastText}<span className="stream-cursor" /></div>
      )}
      {!lastText && <div className="stream-partial"><span className="stream-cursor" /></div>}
    </div>
  );
}
