import { useState } from 'react';
import type { Note } from '../services/api';

interface ExampleOutputsProps {
  onSelectNote: (note: Note) => void;
}

const examples = [
  {
    type: 'Lecture',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2v-5"/></svg>,
    desc: 'Structured study notes with key concepts and examples',
    preview: '# Photosynthesis in Plants\n\n## Overview\n\nPhotosynthesis is the process by which green plants...',
    tag: 'Study Notes',
    color: '#10b981',
  },
  {
    type: 'Tutorial',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
    desc: 'Step-by-step guide with clear instructions',
    preview: '# Complete Python Tutorial\n\n## Step 1: Setup\n\nFirst, install Python from the official website...',
    tag: 'Step-by-Step Guide',
    color: '#22d3ee',
  },
  {
    type: 'Podcast',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
    desc: 'Key takeaways and main insights',
    preview: '# The Mindset of High Performers\n\n**Key Takeaway 1:**\nDiscipline beats motivation...',
    tag: 'Key Takeaways',
    color: '#a855f7',
  },
  {
    type: 'News',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8z"/></svg>,
    desc: 'Concise summary with essential points',
    preview: '# Breaking: New AI Model Released\n\n- Company XYZ announces...\n- 10x improvement in...',
    tag: 'Summary',
    color: '#fbbf24',
  },
];

export function ExampleOutputs({ onSelectNote }: ExampleOutputsProps) {
  return (
    <div className="example-outputs card">
      <div className="example-outputs-head">
        <h2>Example Outputs</h2>
        <span className="view-all-link">View all examples →</span>
      </div>
      <div className="example-grid">
        {examples.map(ex => (
          <button key={ex.type} className="example-card" onClick={() => {
            const note: Note = {
              id: 0, url: '', title: ex.preview.split('\n')[0].replace(/^#+\s*/, ''),
              content_type: ex.type.toLowerCase(), output: ex.preview,
              language: 'en', created_at: new Date().toISOString()
            };
            onSelectNote(note);
          }}>
            <div className="example-ico" style={{ color: ex.color }}>{ex.icon}</div>
            <h3>{ex.type}</h3>
            <p>{ex.desc}</p>
            <div className="example-preview">{ex.preview.split('\n').slice(0, 3).join('\n')}</div>
            <span className="example-tag" style={{ color: ex.color, borderColor: ex.color + '40' }}>{ex.tag}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
