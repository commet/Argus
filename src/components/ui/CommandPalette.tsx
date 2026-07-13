'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Modal } from './Modal';

export interface CommandPaletteItem {
  href: string;
  label: string;
  description: string;
  group: string;
  keywords?: string[];
  icon: LucideIcon;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  locale: 'ko' | 'en';
  items: CommandPaletteItem[];
}

export function CommandPalette({ open, onClose, locale, items }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;

  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return items;
    return items.filter((item) => (
      [item.label, item.description, item.group, ...(item.keywords ?? [])]
        .join(' ')
        .toLocaleLowerCase()
        .includes(normalized)
    ));
  }, [items, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open || results.length === 0) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open, results.length]);

  const choose = (item: CommandPaletteItem) => {
    onClose();
    router.push(`/${locale}${item.href}`);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (results.length === 0) return;
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (results.length === 0) return;
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault();
      choose(results[activeIndex]);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={L('Argus에서 이동', 'Go somewhere in Argus')}
      widthClass="max-w-xl"
      initialFocusRef={inputRef}
      closeLabel={L('빠른 이동 닫기', 'Close quick navigation')}
    >
      <div className="-m-6">
        <div className="relative border-b border-[var(--border-subtle)]">
          <Search
            size={18}
            className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            role="combobox"
            aria-expanded="true"
            aria-controls="argus-command-results"
            aria-activedescendant={results[activeIndex] ? `argus-command-${activeIndex}` : undefined}
            aria-autocomplete="list"
            aria-label={L('페이지와 기능 검색', 'Search pages and features')}
            autoComplete="off"
            maxLength={80}
            placeholder={L('페이지나 기능 검색…', 'Search pages and features…')}
            className="h-16 w-full bg-transparent pl-13 pr-5 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
          />
        </div>

        <div id="argus-command-results" role="listbox" className="max-h-[min(52vh,420px)] overflow-y-auto p-2">
          {results.length > 0 ? results.map((item, index) => {
            const Icon = item.icon;
            const active = index === activeIndex;
            return (
              <button
                ref={(node) => { optionRefs.current[index] = node; }}
                type="button"
                key={item.href}
                id={`argus-command-${index}`}
                role="option"
                aria-selected={active}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(item)}
                className={`group flex min-h-[58px] w-full items-center gap-3 rounded-xl px-3 text-left transition-colors ${
                  active
                    ? 'bg-[var(--accent)]/[0.09] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${
                  active
                    ? 'border-[var(--accent)]/30 bg-[var(--surface)] text-[var(--accent)] shadow-[var(--shadow-xs)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg)] text-[var(--text-tertiary)]'
                }`}>
                  <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-semibold">{item.label}</span>
                    <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">{item.group}</span>
                  </span>
                  <span className="block truncate text-[11px] text-[var(--text-tertiary)]">{item.description}</span>
                </span>
                <ArrowRight size={14} className={`shrink-0 transition-all ${active ? 'translate-x-0 opacity-70' : '-translate-x-1 opacity-0'}`} aria-hidden="true" />
              </button>
            );
          }) : (
            <section role="status" aria-live="polite" className="grid min-h-40 place-items-center px-6 text-center">
              <div>
                <p className="text-[14px] font-semibold text-[var(--text-primary)]">{L('일치하는 항목이 없어요', 'No matching destination')}</p>
                <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">{L('다른 이름이나 기능으로 검색해 보세요.', 'Try another page name or feature.')}</p>
              </div>
            </section>
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-[var(--border-subtle)] bg-[var(--bg)]/70 px-4 py-2 text-[10px] text-[var(--text-tertiary)]">
          <span><kbd className="font-mono">↑↓</kbd> {L('이동', 'move')}</span>
          <span><kbd className="font-mono">Enter</kbd> {L('열기', 'open')}</span>
          <span className="ml-auto"><kbd className="font-mono">Esc</kbd> {L('닫기', 'close')}</span>
        </div>
      </div>
    </Modal>
  );
}
