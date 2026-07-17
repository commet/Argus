'use client';

import { useMemo } from 'react';
import { Compass, X } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { getNavigatorUsageFacts } from '@/lib/navigator';
import { useT } from '@/contexts/LocaleProvider';

/* E1 quarantine: this legacy shell may show usage facts, but derived strategy,
   override, eval, coda, DQ, and AI-generated axis interpretations stay hidden
   until E2 can supply a scoped grant and trace. */

/* ────────────────────────────────────
   Main Component
   ──────────────────────────────────── */

export function NavigatorStrip() {
  const t = useT();
  const { navigatorOpen, toggleNavigator } = useWorkspaceStore();

  const usage = useMemo(() => getNavigatorUsageFacts(), []);
  const hasNewInsights = false;

  // Collapsed state (48px)
  if (!navigatorOpen) {
    return (
      <button
        onClick={toggleNavigator}
        className={`hidden lg:flex shrink-0 w-12 flex-col items-center justify-start pt-4 gap-2 border-l border-[var(--border)] bg-[var(--surface)] cursor-pointer hover:bg-[var(--ai)] transition-colors relative ${
          hasNewInsights ? 'animate-subtle-pulse' : ''
        }`}
        title={t('navigator.open')}
      >
        <div className="absolute inset-y-0 left-0 w-[2px]" style={{ background: 'var(--gradient-gold)' }} />
        <Compass size={18} className="text-[var(--gold)]" />
        {hasNewInsights && (
          <span className="w-2 h-2 rounded-full bg-[var(--gold)] shadow-[var(--glow-gold)]" />
        )}
      </button>
    );
  }

  // Expanded state (300px)
  return (
    <div className="hidden lg:flex shrink-0 w-[300px] flex-col border-l border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      {/* Gold gradient top accent */}
      <div className="h-[2px] w-full shrink-0" style={{ background: 'var(--gradient-gold)' }} />
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Compass size={16} className="text-[var(--gold)]" />
          <span className="text-[14px] font-bold text-[var(--text-primary)]">{t('navigator.title')}</span>
        </div>
        <button
          onClick={toggleNavigator}
          className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Profile summary */}
      <div className="px-4 py-3 border-b border-[var(--border-subtle)] space-y-1">
        <p className="text-[13px] text-[var(--text-primary)]">
          {t('navigator.sessions', { count: usage.sessionCount })}
          {usage.projectCount > 0 && ` · ${t('navigator.projects', { count: usage.projectCount })}`}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3 space-y-2">
          <p className="text-[12px] text-[var(--text-secondary)] text-center py-4">
            {usage.sessionCount === 0 ? t('navigator.firstSession') : t('navigator.noInsights')}
          </p>
        </div>
      </div>
    </div>
  );
}
