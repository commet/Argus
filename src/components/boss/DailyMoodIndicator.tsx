'use client';

import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { computeDailyMood, type DailyMood } from '@/lib/boss/daily-energy';
import type { YearMonthProfile } from '@/lib/boss/saju-interpreter';
import { useLocale } from '@/hooks/useLocale';

interface DailyMoodIndicatorProps {
  profile: YearMonthProfile | null;
  variant?: 'pill' | 'inline';
  showCopy?: boolean;     // 더 긴 카피 노출 (큰 화면용)
}

const MOOD_COLOR: Record<DailyMood, { bg: string; fg: string; border: string }> = {
  radiant: {
    bg: 'rgba(251, 191, 36, 0.12)',
    fg: 'rgb(180, 120, 20)',
    border: 'rgba(251, 191, 36, 0.35)',
  },
  light: {
    bg: 'rgba(96, 165, 250, 0.1)',
    fg: 'rgb(37, 99, 180)',
    border: 'rgba(96, 165, 250, 0.3)',
  },
  neutral: {
    bg: 'rgba(120, 120, 120, 0.08)',
    fg: 'var(--text-secondary)',
    border: 'rgba(120, 120, 120, 0.25)',
  },
  heavy: {
    bg: 'rgba(139, 92, 246, 0.08)',
    fg: 'rgb(91, 33, 182)',
    border: 'rgba(139, 92, 246, 0.28)',
  },
  stormy: {
    bg: 'rgba(220, 53, 69, 0.1)',
    fg: 'rgb(180, 30, 40)',
    border: 'rgba(220, 53, 69, 0.35)',
  },
};

// The underlying mood labels in daily-energy.ts are Korean-only (Saju copy).
// Map the mood key to a short English label so EN locale never shows Korean.
const MOOD_LABEL_EN: Record<DailyMood, string> = {
  radiant: 'Lifted',
  light: 'Easy',
  neutral: 'Steady',
  heavy: 'Heavy',
  stormy: 'Stormy',
};

/**
 * 오늘의 팀장 기운 pill.
 * profile이 없으면 아무것도 안 그림 (생년 미입력).
 */
export function DailyMoodIndicator({ profile, variant = 'pill', showCopy = false }: DailyMoodIndicatorProps) {
  const locale = useLocale();
  const result = useMemo(() => computeDailyMood(profile), [profile]);
  if (!result) return null;
  // Saju-driven labels are Korean-only. In English locale we only render this for
  // legacy bosses (profile exists) — swap the chrome to English but keep the
  // Korean mood label since the underlying computation is Saju-specific.
  const ko = locale === 'ko';
  const label = ko ? result.label : MOOD_LABEL_EN[result.mood];

  const color = MOOD_COLOR[result.mood];
  const title = ko
    ? `재미로 보는 오늘 기운 — ${result.copy}\n${result.breakdown.today.name}일 · ${result.breakdown.stemRelation.label} · ${result.breakdown.branchRelation.label}`
    : "Just for fun — today's mood";

  if (variant === 'inline') {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px]"
        style={{ color: color.fg, opacity: 0.75 }}
        title={title}
      >
        <span className="text-[11px] leading-none">{result.emoji}</span>
        <span className="font-medium">{label}</span>
        <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>· {ko ? '재미로' : 'just for fun'}</span>
      </span>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full"
      style={{
        background: color.bg,
        border: `1px solid ${color.border}`,
      }}
      title={title}
    >
      <motion.span
        className="text-[12px] leading-none"
        animate={result.mood === 'radiant' ? { scale: [1, 1.15, 1] } :
          result.mood === 'stormy' ? { rotate: [0, -4, 4, 0] } : {}}
        transition={{
          repeat: result.mood === 'radiant' || result.mood === 'stormy' ? Infinity : 0,
          duration: result.mood === 'radiant' ? 2.5 : 1.2,
          ease: 'easeInOut',
        }}
      >
        {result.emoji}
      </motion.span>
      <span className="text-[10px] font-bold tracking-wide" style={{ color: color.fg }}>
        {ko ? '오늘' : 'Today'} {label}
      </span>
      {showCopy && (
        <span className="text-[10px]" style={{ color: color.fg, opacity: 0.75 }}>
          · {result.copy}
        </span>
      )}
    </motion.div>
  );
}
