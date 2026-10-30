import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  if (!content) return null;

  // Strict constraint: strip all image markdown and img tags completely
  const sanitizedContent = content
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/<img[^>]*>/gi, '');

  const lines = sanitizedContent.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockLanguage = '';
  let codeBlockLines: string[] = [];
  let listItems: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let tableRows: string[][] = [];
  let inTable = false;

  const flushTable = (keyPrefix: string) => {
    if (inTable && tableRows.length > 0) {
      const headerRow = tableRows[0];
      const dataRows = tableRows.slice(1);

      elements.push(
        <div key={`${keyPrefix}-table`} className="my-6 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/90 text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">
                {headerRow.map((cell, idx) => (
                  <th key={idx} className="p-3.5 font-bold tracking-tight text-xs sm:text-sm">
                    <span dangerouslySetInnerHTML={{ __html: formatInline(cell.replace(/\*\*/g, '')) }} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900/60">
              {dataRows.map((row, rIdx) => (
                <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-transparent' : 'bg-slate-50/50 dark:bg-slate-800/30'}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="p-3.5 text-slate-700 dark:text-slate-300 align-top text-xs sm:text-sm leading-relaxed">
                      <span dangerouslySetInnerHTML={{ __html: formatInline(cell) }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
    }
  };

  const flushList = (keyPrefix: string) => {
    if (listItems.length > 0 && listType) {
      if (listType === 'ul') {
        elements.push(
          <ul key={`${keyPrefix}-ul`} className="list-disc pl-6 space-y-1.5 my-3 text-slate-700 dark:text-slate-200">
            {listItems.map((item, idx) => (
              <li key={idx} dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
            ))}
          </ul>
        );
      } else {
        elements.push(
          <ol key={`${keyPrefix}-ol`} className="list-decimal pl-6 space-y-1.5 my-3 text-slate-700 dark:text-slate-200">
            {listItems.map((item, idx) => (
              <li key={idx} dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
            ))}
          </ol>
        );
      }
      listItems = [];
      listType = null;
    }
  };

  const formatInline = (text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-900 dark:text-white">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
      .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-mono text-sm border border-slate-200 dark:border-slate-700">$1</code>')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-teal-600 dark:text-teal-400 hover:underline font-medium">$1</a>');
  };

  lines.forEach((line, index) => {
    // Code block toggle
    if (line.startsWith('```')) {
      flushTable(`before-code-${index}`);
      flushList(`before-code-${index}`);
      if (inCodeBlock) {
        elements.push(
          <div key={`code-${index}`} className="my-4 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-md">
            {codeBlockLanguage && (
              <div className="bg-slate-900 px-4 py-1.5 text-xs font-mono text-slate-400 border-b border-slate-800 flex justify-between items-center">
                <span>{codeBlockLanguage}</span>
                <span className="text-[10px] text-slate-500 uppercase">code</span>
              </div>
            )}
            <pre className="p-4 overflow-x-auto text-sm font-mono text-emerald-400 leading-relaxed">
              <code>{codeBlockLines.join('\n')}</code>
            </pre>
          </div>
        );
        inCodeBlock = false;
        codeBlockLines = [];
        codeBlockLanguage = '';
      } else {
        inCodeBlock = true;
        codeBlockLanguage = line.replace('```', '').trim();
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      return;
    }

    // Markdown Table row
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList(`before-table-${index}`);
      const cells = trimmed.split('|').slice(1, -1).map((c) => c.trim());
      // Check if separator line
      const isSeparator = cells.every((c) => /^:?-+:?$/.test(c));
      if (!isSeparator) {
        inTable = true;
        tableRows.push(cells);
      }
      return;
    } else {
      flushTable(`end-table-${index}`);
    }

    // List item detection
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
    const olMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);

    if (ulMatch) {
      if (listType === 'ol') flushList(`switch-ol-${index}`);
      listType = 'ul';
      listItems.push(ulMatch[2]);
      return;
    } else if (olMatch) {
      if (listType === 'ul') flushList(`switch-ul-${index}`);
      listType = 'ol';
      listItems.push(olMatch[2]);
      return;
    } else {
      flushList(`end-list-${index}`);
    }

    // Empty lines
    if (!trimmed) {
      return;
    }

    // Horizontal Rule
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      elements.push(<hr key={`hr-${index}`} className="my-6 border-slate-200 dark:border-slate-800" />);
      return;
    }

    // Blockquote & Clinical Callouts
    if (line.startsWith('>')) {
      const quoteText = line.replace(/^>\s*/, '');
      
      // Clinical Callout classification
      let calloutVariant: 'research' | 'evidence' | 'guidance' | 'redflag' | 'default' = 'default';
      let icon = '📌';
      let label = 'Clinical Note';

      if (/Research Insight/i.test(quoteText)) {
        calloutVariant = 'research';
        icon = '🔬';
        label = 'Research Insight';
      } else if (/Evidence Note/i.test(quoteText)) {
        calloutVariant = 'evidence';
        icon = '🧪';
        label = 'Evidence Note';
      } else if (/UK Guidance Note|NICE|MHRA/i.test(quoteText)) {
        calloutVariant = 'guidance';
        icon = '🏛️';
        label = 'UK Guidance Note';
      } else if (/Red Flag|Urgent|Warning/i.test(quoteText)) {
        calloutVariant = 'redflag';
        icon = '🚨';
        label = 'Urgent Clinical Alert';
      }

      const cleanQuote = quoteText
        .replace(/^\s*\*\*.*?\*\*:\s*/, '')
        .replace(/^\s*\*\*.*?\*\*\s*/, '');

      if (calloutVariant === 'research') {
        elements.push(
          <div key={`quote-${index}`} className="my-4 p-4 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border-l-4 border-blue-600 text-slate-800 dark:text-slate-200 shadow-xs">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 mb-1">
              <span>{icon}</span>
              <span>{label}</span>
            </div>
            <div className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: formatInline(cleanQuote) }} />
          </div>
        );
        return;
      }

      if (calloutVariant === 'evidence') {
        elements.push(
          <div key={`quote-${index}`} className="my-4 p-4 rounded-2xl bg-teal-50/80 dark:bg-teal-950/40 border-l-4 border-teal-600 text-slate-800 dark:text-slate-200 shadow-xs">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300 mb-1">
              <span>{icon}</span>
              <span>{label}</span>
            </div>
            <div className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: formatInline(cleanQuote) }} />
          </div>
        );
        return;
      }

      if (calloutVariant === 'guidance') {
        elements.push(
          <div key={`quote-${index}`} className="my-4 p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border-l-4 border-indigo-600 text-slate-800 dark:text-slate-200 shadow-xs">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 mb-1">
              <span>{icon}</span>
              <span>{label}</span>
            </div>
            <div className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: formatInline(cleanQuote) }} />
          </div>
        );
        return;
      }

      if (calloutVariant === 'redflag') {
        elements.push(
          <div key={`quote-${index}`} className="my-4 p-4 rounded-2xl bg-rose-50/90 dark:bg-rose-950/40 border-l-4 border-rose-600 text-slate-800 dark:text-slate-200 shadow-xs">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 mb-1">
              <span>{icon}</span>
              <span>{label}</span>
            </div>
            <div className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: formatInline(cleanQuote) }} />
          </div>
        );
        return;
      }

      elements.push(
        <blockquote
          key={`quote-${index}`}
          className="my-3 pl-4 border-l-4 border-slate-400 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/40 py-3 pr-4 rounded-r-2xl italic text-slate-700 dark:text-slate-300 text-sm"
          dangerouslySetInnerHTML={{ __html: formatInline(quoteText) }}
        />
      );
      return;
    }

    // Headings
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${index}`} className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-6 mb-3 tracking-tight">
          <span dangerouslySetInnerHTML={{ __html: formatInline(line.replace('# ', '')) }} />
        </h1>
      );
      return;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${index}`} className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-7 mb-3 pb-1 border-b border-slate-100 dark:border-slate-800">
          <span dangerouslySetInnerHTML={{ __html: formatInline(line.replace('## ', '')) }} />
        </h2>
      );
      return;
    }
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${index}`} className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-5 mb-2">
          <span dangerouslySetInnerHTML={{ __html: formatInline(line.replace('### ', '')) }} />
        </h3>
      );
      return;
    }
    if (line.startsWith('#### ')) {
      elements.push(
        <h4 key={`h4-${index}`} className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-1.5">
          <span dangerouslySetInnerHTML={{ __html: formatInline(line.replace('#### ', '')) }} />
        </h4>
      );
      return;
    }

    // FAQ Question line
    if (/^\*\*\d+\.\s+.*\*\*$/.test(trimmed)) {
      elements.push(
        <div key={`faq-q-${index}`} className="mt-5 mb-1.5 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border-l-4 border-teal-600 text-slate-900 dark:text-white font-bold text-sm">
          <span dangerouslySetInnerHTML={{ __html: formatInline(trimmed.replace(/\*\*/g, '')) }} />
        </div>
      );
      return;
    }

    // Paragraph
    elements.push(
      <p
        key={`p-${index}`}
        className="my-3 text-slate-700 dark:text-slate-300 leading-relaxed text-[15px]"
        dangerouslySetInnerHTML={{ __html: formatInline(line) }}
      />
    );
  });

  flushTable('final');
  flushList('final');

  return <div className={`prose-container font-sans ${className}`}>{elements}</div>;
};
