'use client';

import { useState, useMemo, useEffect } from 'react';
import { Compass, X, Lightbulb, BarChart3, TrendingUp, AlertTriangle, Eye } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { getStorage, setStorage } from '@/lib/storage';
import { buildNavigatorProfile, buildNavigatorInsights, buildLearningCurve } from '@/lib/navigator';
import type { NavigatorInsight } from '@/lib/navigator';
import { useT } from '@/contexts/LocaleProvider';

const STRATEGY_KEYS: Record<string, Parameters<ReturnType<typeof useT>>[0]> = {
  challenge_existence: 'strategy.challengeExistence',
  narrow_scope: 'strategy.narrowScope',
  diagnose_root: 'strategy.diagnoseRoot',
  redirect_angle: 'strategy.redirectAngle',
};

const CATEGORY_ICON: Record<NavigatorInsight['category'], typeof Lightbulb> = {
  pattern: BarChart3,
  coaching: Lightbulb,
  growth: TrendingUp,
  warning: AlertTriangle,
};

/* (Removed 2026-07-03, P0-3 — spine rule 2) DQ sparkline, trend labels, single
   DQ score, and tier progress were user-facing verdicts ("판단 품질 · 초보/숙련/
   마스터 · 하락"). The underlying data (buildLearningCurve) stays internal for
   routing; only the axis-coverage observation below remains user-visible.
   Do not re-add a score, grade, or trend rendering here. */

/* ────────────────────────────────────
   Axis Coverage Bar — Axis Fingerprint 시각화
   ──────────────────────────────────── */

function AxisCoverageBar({ coverage, gap }: { coverage: Record<string, number>; gap: string | null }) {
  const entries = Object.entries(coverage);
  if (entries.every(([, v]) => v === 0)) return null;

  return (
    <div className="space-y-1.5">
      {entries.map(([label, pct]) => {
        const isGap = label === gap;
        return (
          <div key={label} className="flex items-center gap-2">
            <span className={`text-[10px] w-[52px] shrink-0 text-right ${isGap ? 'text-amber-500 font-medium' : 'text-[var(--text-tertiary)]'}`}>
              {label}
            </span>
            <div className="flex-1 h-[4px] rounded-full bg-[var(--border-subtle)] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isGap ? 'bg-amber-500/60' : 'bg-[var(--gold)]/40'}`}
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
            <span className={`text-[9px] w-6 text-right ${isGap ? 'text-amber-500' : 'text-[var(--text-tertiary)]'}`}>
              {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────
   Main Component
   ──────────────────────────────────── */

/** Dismissed-insight ids live in localStorage so they don't revive on remount. */
const DISMISSED_KEY = 'argus-navigator-dismissed';

export function NavigatorStrip() {
  const t = useT();
  const { navigatorOpen, toggleNavigator } = useWorkspaceStore();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Hydrate persisted dismissals after mount (SSR-safe; getStorage parses defensively)
  useEffect(() => {
    const saved = getStorage<string[]>(DISMISSED_KEY, []);
    if (saved.length > 0) {
      setDismissed(new Set(saved.filter((v): v is string => typeof v === 'string')));
    }
  }, []);

  const dismissInsight = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev).add(id);
      setStorage(DISMISSED_KEY, Array.from(next));
      return next;
    });
  };

  const profile = useMemo(() => buildNavigatorProfile(), []);
  const allInsights = useMemo(() => buildNavigatorInsights(profile), [profile]);
  const learningCurve = useMemo(() => buildLearningCurve(), []);
  const insights = useMemo(
    () => allInsights.filter((i) => !dismissed.has(i.id)),
    [allInsights, dismissed]
  );

  const hasNewInsights = insights.length > 0;

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
          {t('navigator.sessions', { count: profile.sessionCount })}
          {profile.projectCount > 0 && ` · ${t('navigator.projects', { count: profile.projectCount })}`}
        </p>
        {profile.dominantStrategy && (
          <p className="text-[12px] text-[var(--text-secondary)]">
            {t('navigator.preferredStrategy', { strategy: STRATEGY_KEYS[profile.dominantStrategy] ? t(STRATEGY_KEYS[profile.dominantStrategy]) : profile.dominantStrategy })}
          </p>
        )}
        {profile.totalJudgments >= 3 && (
          <p className="text-[12px] text-[var(--text-secondary)]">
            {t('navigator.overrideRate', { rate: Math.round(profile.overrideRate * 100) })}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── Axis Fingerprint (3+ sessions) ── */}
        {profile.sessionCount >= 1 && Object.values(learningCurve.axis_coverage).some(v => v > 0) && (
          <div className="px-4 py-3 border-b border-[var(--border-subtle)] space-y-2">
            <div className="flex items-center gap-1.5">
              <Eye size={12} className="text-[var(--gold)]" />
              <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{t('learning.exploredAxes')}</span>
            </div>
            <AxisCoverageBar coverage={learningCurve.axis_coverage} gap={learningCurve.axis_gap} />
            {learningCurve.axis_gap && (
              <p className="text-[10px] text-amber-500">
                {t('learning.axisGap', { axis: learningCurve.axis_gap })}
              </p>
            )}
          </div>
        )}

        {/* ── Insights ── */}
        <div className="px-4 py-3 space-y-2">
          {insights.length === 0 && !learningCurve.has_data && (
            <p className="text-[12px] text-[var(--text-secondary)] text-center py-4">
              {profile.sessionCount === 0
                ? t('navigator.firstSession')
                : t('navigator.noInsights')}
            </p>
          )}
          {insights.map((insight) => {
            const Icon = CATEGORY_ICON[insight.category];
            return (
              <div
                key={insight.id}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg)] p-3 group"
              >
                <div className="flex items-start gap-2">
                  <Icon size={13} className="text-[var(--gold)] mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-[var(--text-primary)] leading-relaxed">
                      {insight.message}
                    </p>
                    {insight.detail && (
                      <p className="text-[11px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                        {insight.detail}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => dismissInsight(insight.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-opacity"
                    title={t('navigator.close')}
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
