'use client';

/**
 * RetroBadge — 「연습 · 회고」 상시 라벨 (베팅③ C2 / W3 항목 5).
 *
 * A retrospective seal (`decision_contract.origin === 'retro'`) is a PRACTICE
 * loop closed on an already-known past outcome. Honest provenance (CLAUDE.md
 * rule 1) demands this be visible, never hidden, on EVERY surface that shows a
 * retro contract: the seal certificate (SealMoment), the settlement modal, and
 * the 판단 액자 (JudgmentFrame). One component = one shade, so the three
 * surfaces can never drift apart (Single Source of Truth for the label).
 *
 * The shade DELIBERATELY matches the `ai_surfaced` provenance badge in
 * SettlementModal (text-tertiary + subtle border, no color, no emphasis) — a
 * provenance tag is a quiet fact, never an alarm and never praise. It carries
 * no verdict about the user — no ranking, no rating, no measurement, no
 * this-vs-that (spine invariant).
 *
 * `title` (optional) attaches the one honest sentence — "이미 끝난 일을 되짚은
 * 거예요, 진짜 봉인은 결과를 모르는 채로 거는 거고요" — as a hover, so the badge
 * stays compact but the framing is one hover away wherever it renders.
 *
 * Text renders as JSX nodes → React auto-escapes (XSS 헌법).
 */

import { History } from 'lucide-react';

export function RetroBadge({ ko, className = '' }: { ko: boolean; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 align-middle text-[12px] font-semibold text-[var(--text-tertiary)] border border-[var(--border)] rounded px-1.5 py-px ${className}`}
      title={
        ko
          ? '이미 끝난 일을 되짚어 보는 연습이에요. 실제 판단 기록은 결과를 모르는 시점에 남긴 결정부터 시작됩니다.'
          : "A practice on something that already played out — a real seal is one you make before you know the outcome."
      }
    >
      <History size={10} className="shrink-0" />
      {ko ? '연습 · 회고' : 'Practice · retro'}
    </span>
  );
}
