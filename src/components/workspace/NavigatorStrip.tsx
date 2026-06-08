'use client';

import { useState, useMemo } from 'react';
import { Music2, X, Lightbulb, BarChart3, TrendingUp, AlertTriangle, Target, Eye } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { buildNavigatorProfile, buildNavigatorInsights, buildLearningCurve } from '@/lib/navigator';
import type { NavigatorInsight, LearningCurve } from '@/lib/navigator';
import { t } from '@/lib/i18n';

const STRATEGY_KEYS: Record<string, Parameters<typeof t>[0]> = {
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

const TREND_COLOR: Record<string, string> = {
  improving: 'text-emerald-500',
  stable: 'text-[var(--text-secondary)]',
  declining: 'text-amber-500',
  not_enough_data: 'text-[var(--text-tertiary)]',
};

const TREND_KEY: Record<string, Parameters<typeof t>[0]> = {
  improving: 'learning.trendImproving',
  stable: 'learning.trendStable',
  declining: 'learning.trendDeclining',
  not_enough_data: 'learning.trendNoData',
};

/* ────────────────────────────────────
   DQ Sparkline — 인라인 SVG 학습 곡선
   ConvergenceChart.tsx 패턴 재사용
   ──────────────────────────────────── */

function DQSparkline({ points }: { points: LearningCurve['dq_points'] }) {
  if (points.length < 2) return null;

  // Show last 7 points max for compactness
  const data = points.slice(-7);
  const W = 260;
  const H = 48;
  const pad = 4;
  const usable = W - pad * 2;

  const values = data.map(d => d.overall_dq);
  const maxVal = Math.max(...values, 100);
  const minVal = Math.min(...values, 0);
  const range = Math.max(maxVal - minVal, 20); // Prevent flat line for similar scores

  const getX = (i: number) => data.length === 1 ? W / 2 : (i / (data.length - 1)) * usable + pad;
  const getY = (v: number) => H - pad - ((v - minVal) / range) * (H - pad * 2);

  const polylinePoints = data.map((d, i) => `${getX(i)},${getY(d.overall_dq)}`).join(' ');

  // Gradient: trend direction determines color
  const isImproving = data.length >= 2 && data[data.length - 1].overall_dq > data[0].overall_dq;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: H }}>
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={isImproving ? 'var(--gold)' : 'var(--text-tertiary)'} stopOpacity="0.4" />
          <stop offset="100%" stopColor={isImproving ? 'var(--gold)' : 'var(--text-tertiary)'} stopOpacity="1" />
        </linearGradient>
      </defs>

      {/* Line */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke="url(#sparkGrad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Data points */}
      {data.map((d, i) => (
        <g key={i}>
          <circle
            cx={getX(i)}
            cy={getY(d.overall_dq)}
            r={i === data.length - 1 ? 3.5 : 2}
            fill={i === data.length - 1 ? 'var(--gold)' : 'var(--text-tertiary)'}
            stroke="var(--surface)"
            strokeWidth="1.5"
          />
          {/* Show score label on last point */}
          {i === data.length - 1 && (
            <text
              x={getX(i) - 4}
              y={getY(d.overall_dq) - 7}
              textAnchor="end"
              fill="var(--gold)"
              fontSize="10"
              fontWeight="bold"
            >
              {d.overall_dq}
            </text>
          )}
          {/* Show score label on first point for comparison */}
          {i === 0 && data.length > 1 && (
            <text
              x={getX(i) + 4}
              y={getY(d.overall_dq) - 7}
              textAnchor="start"
              fill="var(--text-tertiary)"
              fontSize="9"
            >
              {d.overall_dq}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

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
   Tier Progress — 티어 진행률
   ──────────────────────────────────── */

function TierProgress({ tier, progress }: { tier: 1 | 2 | 3; progress: number }) {
  const tierLabels = ['', t('learning.tierBeginner'), t('learning.tierSkilled'), t('learning.tierMaster')];
  const nextTierLabels = ['', t('learning.tierSkilled'), t('learning.tierMaster'), ''];

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[var(--gold)] font-medium">
        Tier {tier} {tierLabels[tier]}
      </span>
      {tier < 3 && (
        <>
          <div className="flex-1 h-[3px] rounded-full bg-[var(--border-subtle)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--gold)]/60 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[9px] text-[var(--text-tertiary)]">
            → {nextTierLabels[tier]}
          </span>
        </>
      )}
    </div>
  );
}

/* ────────────────────────────────────
   Main Component
   ──────────────────────────────────── */

export function NavigatorStrip() {
  const { navigatorOpen, toggleNavigator } = useWorkspaceStore();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

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
        aria-label={t('navigator.open')}
        title={t('navigator.open')}
      >
        <div className="absolute inset-y-0 left-0 w-[2px]" style={{ background: 'var(--gradient-gold)' }} />
        <Music2 size={18} className="text-[var(--gold)]" />
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
          <Music2 size={16} className="text-[var(--gold)]" />
          <span className="text-[14px] font-bold text-[var(--text-primary)]">{t('navigator.title')}</span>
        </div>
        <button
          onClick={toggleNavigator}
          className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
          aria-label={t('navigator.close')}
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
        {/* Tier progress */}
        <TierProgress tier={profile.tier} progress={learningCurve.tier_progress} />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── Learning Curve Section (3+ DQ scores) ── */}
        {learningCurve.has_data && learningCurve.dq_points.length >= 2 && (
          <div className="px-4 py-3 border-b border-[var(--border-subtle)] space-y-2">
            <div className="flex items-center gap-1.5">
              <TrendingUp size={12} className="text-[var(--gold)]" />
              <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{t('learning.dqTrend')}</span>
            </div>

            {/* DQ Sparkline */}
            <DQSparkline points={learningCurve.dq_points} />

            {/* Trend + Most improved */}
            <div className="flex items-center justify-between">
              <span className={`text-[11px] ${TREND_COLOR[learningCurve.trend]}`}>
                {t(TREND_KEY[learningCurve.trend])}
                {learningCurve.avg_dq > 0 && ` · ${t('navigator.avgSuffix', { n: learningCurve.avg_dq })}`}
              </span>
              {learningCurve.most_improved_element && learningCurve.improvement_delta > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px]">
                  <Target size={9} />
                  {learningCurve.most_improved_element} +{learningCurve.improvement_delta}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Single DQ score (only 1 point, no sparkline) ── */}
        {learningCurve.has_data && learningCurve.dq_points.length === 1 && (
          <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[var(--text-secondary)]">{t('navigator.dqScore')}</span>
              <span className="text-[14px] font-bold text-[var(--gold)]">
                {learningCurve.dq_points[0].overall_dq}
                <span className="text-[10px] font-normal text-[var(--text-tertiary)]">/100</span>
              </span>
            </div>
          </div>
        )}

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
                    onClick={() => setDismissed((prev) => new Set(prev).add(insight.id))}
                    className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1.5 -m-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-opacity shrink-0"
                    aria-label={t('navigator.close')}
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
