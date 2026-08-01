interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const renderMarkdown = (text: string): string => {
    if (!text) return '';
    
    // Escape HTML first
    const escapeHtml = (s: string) => s
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"');

    // Inline formatting
    const inline = (s: string) => s
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/https?:\/\/[^\s<]+/g, m => `<a href="${m}" target="_blank" rel="noopener noreferrer">${m}</a>`);

    const lines = escapeHtml(text).split('\n');
    let html = '';
    let inCode = false;
    let inList: 'ul' | 'ol' | null = null;

    const closeList = () => {
      if (inList) {
        html += `</${inList}>`;
        inList = null;
      }
    };

    for (const raw of lines) {
      // Fenced code blocks
      if (/^```/.test(raw)) {
        closeList();
        if (inCode) {
          html += '</code></pre>';
          inCode = false;
        } else {
          html += '<pre><code>';
          inCode = true;
        }
        continue;
      }
      if (inCode) {
        html += raw + '\n';
        continue;
      }

      // Headings
      const h = raw.match(/^(#{1,4})\s+(.*)/);
      if (h) {
        closeList();
        const level = h[1].length;
        html += `<h${level}>${inline(h[2])}</h${level}>`;
        continue;
      }

      // Unordered lists
      if (/^\s*([-*+])\s+/.test(raw)) {
        if (inList !== 'ul') { closeList(); html += '<ul>'; inList = 'ul'; }
        html += `<li>${inline(raw.replace(/^\s*[-*+]\s+/, ''))}</li>`;
        continue;
      }

      // Ordered lists
      if (/^\s*\d+[.)]\s+/.test(raw)) {
        if (inList !== 'ol') { closeList(); html += '<ol>'; inList = 'ol'; }
        html += `<li>${inline(raw.replace(/^\s*\d+[.)]\s+/, ''))}</li>`;
        continue;
      }

      // Horizontal rules
      if (/^\s*(---|\*\*\*|___)\s*$/.test(raw)) {
        closeList();
        html += '<hr>';
        continue;
      }

      // Empty lines
      if (!raw.trim()) {
        closeList();
        continue;
      }

      // Paragraphs
      closeList();
      html += `<p>${inline(raw)}</p>`;
    }

    if (inCode) html += '</code></pre>';
    closeList();

    return html;
  };

  return <div className="markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />;
}