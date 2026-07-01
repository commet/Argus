import React from 'react';

/* ═══ Inline markdown — bold only ═══ */
export function renderInline(text: string): React.ReactNode {
  const p = text.split(/(\*\*[^*]+\*\*)/g);
  if (p.length === 1) return text;
  return p.map((s, i) =>
    s.startsWith('**') && s.endsWith('**')
      ? <strong key={i} className="font-semibold text-[var(--text-primary)]">{s.slice(2, -2)}</strong>
      : s,
  );
}

/* ═══ Parse a markdown table row into trimmed cells ═══ */
function parseRow(line: string): string[] {
  return line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map(s => s.trim());
}

/* ═══ Match a table separator row like |---|---| or | :--- | ---: | ═══ */
function isTableSeparator(line: string): boolean {
  return /^\s*\|[\s\-:|]+\|\s*$/.test(line) && line.includes('-');
}

/* ═══ Render a single non-table line ═══ */
function renderLine(l: string, k: number): React.ReactNode {
  if (l.startsWith('# ')) return <h1 key={k} className="text-[24px] md:text-[28px] font-bold text-[var(--text-primary)] mt-1 mb-3 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>{l.slice(2)}</h1>;
  if (l.startsWith('### ')) return <h3 key={k} className="text-[15px] font-bold text-[var(--text-primary)] mt-5 mb-1.5 tracking-tight">{l.slice(4)}</h3>;
  if (l.startsWith('## ')) return <h2 key={k} className="text-[16px] md:text-[17px] font-bold text-[var(--text-primary)] mt-7 mb-2.5 tracking-tight">{l.slice(3)}</h2>;
  if (l.startsWith('> ')) return <blockquote key={k} className="border-l-[3px] border-[var(--accent)]/30 pl-4 py-1 text-[14px] text-[var(--text-secondary)] italic my-3 leading-[1.65]">{renderInline(l.slice(2))}</blockquote>;
  if (l.startsWith('- ')) return <div key={k} className="flex items-start gap-2.5 text-[14px] text-[var(--text-primary)] ml-1 leading-[1.75]"><span className="w-1 h-1 rounded-full bg-[var(--accent)]/60 mt-2.5 shrink-0" /><span>{renderInline(l.slice(2))}</span></div>;
  if (l.startsWith('---')) return <hr key={k} className="border-[var(--border-subtle)] my-4" />;
  if (l.match(/^\d+\. /)) return <div key={k} className="flex items-start gap-2.5 text-[14px] text-[var(--text-primary)] ml-1 leading-[1.75]"><span className="text-[var(--accent)]/70 font-mono text-[12px] mt-0.5 shrink-0">{l.match(/^\d+/)![0]}.</span><span>{renderInline(l.replace(/^\d+\.\s*/, ''))}</span></div>;
  if (l.startsWith('<!--')) return null;
  if (l.trim() === '') return <div key={k} className="h-2.5" />;
  return <p key={k} className="text-[14px] text-[var(--text-primary)] leading-[1.8]">{renderInline(l)}</p>;
}

/* ═══ Block-level markdown renderer (with table support) ═══ */
export function renderMd(c: string) {
  const lines = c.split('\n');
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const l = lines[i];

    // Table block: header row + separator + data rows
    if (l.trim().startsWith('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = parseRow(l);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && !isTableSeparator(lines[i])) {
        rows.push(parseRow(lines[i]));
        i++;
      }
      out.push(
        <div key={key++} className="my-4 -mx-1 overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[var(--text-primary)]/15">
                {header.map((h, hi) => (
                  <th key={hi} className="text-left py-2 px-2.5 font-semibold text-[var(--text-tertiary)] text-[10px] uppercase tracking-[0.08em] align-bottom">
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-b border-[var(--border-subtle)] last:border-b-0">
                  {row.map((cell, ci) => (
                    <td key={ci} className="py-2.5 px-2.5 text-[13px] text-[var(--text-primary)] leading-[1.5] align-top">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    out.push(renderLine(l, key++));
    i++;
  }

  return out;
}
