'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';

export interface ContextChainItem {
  label: string;
  count: number;
  details: string[];
  color?: string;
}

interface ContextChainBlockProps {
  summary: string;
  items: ContextChainItem[];
}

export function ContextChainBlock({ summary, items }: ContextChainBlockProps) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const toggle = (idx: number) => {
    setExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <Card className="!bg-[var(--checkpoint)] !p-3">
      <p className="text-[11px] font-bold text-[var(--warning)] mb-2">{L('이전 단계에서', 'From the previous step')}</p>
      <p className="text-[12px] text-[var(--text-primary)] leading-relaxed">{summary}</p>
      {items.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {items.map((item, i) => (
            <div key={i}>
              <button
                onClick={() => toggle(i)}
                className={`flex items-center gap-1.5 text-[12px] cursor-pointer hover:underline ${item.color || 'text-[var(--warning)]'}`}
              >
                {item.label} <span className="font-bold">{item.count}{L('건', '')}</span>
                {item.details.length > 0 && (
                  expanded[i]
                    ? <ChevronUp size={11} />
                    : <ChevronDown size={11} />
                )}
              </button>
              {expanded[i] && item.details.length > 0 && (
                <ul className="mt-1 ml-3 space-y-0.5 animate-fade-in">
                  {item.details.map((d, j) => (
                    <li key={j} className="text-[11px] text-[var(--text-primary)]">• {d}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
