'use client';

/**
 * FirstSettlementCard — 1차 정산 (thought↔thought), the return on-ramp
 * (DESIGN-judgment-checkpoints-v2 §8).
 *
 * Shown on a SEALED-but-not-yet-due decision: the first return can't be a
 * "report reality" (reality hasn't arrived — that's homework), so it asks the
 * only thing answerable now — "그때 이렇게 봤는데, 지금도 그렇게 보이나요?".
 * A shifted view is NOT worse than an unchanged one; a moved view is itself
 * judgment data. Zero AI verdict, no outcome required, one optional line. This
 * is the lever the doc argues actually moves activation (1차가 2차를 판다).
 */

import { useState } from 'react';
import { ArrowRightLeft, CircleHelp, Compass, Equal } from 'lucide-react';
import type { LeanAfter } from '@/stores/types';

export function FirstSettlementCard({
  anchor,
  leanAfter,
  onRecord,
  ko,
}: {
  /** The user's own sealed line (human_judgment), shown verbatim as the anchor. */
  anchor: string;
  leanAfter?: LeanAfter;
  onRecord: (view: LeanAfter['view'], note?: string) => void;
  ko: boolean;
}) {
  const L = (k: string, e: string) => (ko ? k : e);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(leanAfter?.note ?? '');

  // Already reflected → a calm one-line record + a quiet re-open.
  if (leanAfter && !open) {
    return (
      <div className="mt-5 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--bg)]/65 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--ai)] text-[var(--accent)]">
              <Compass size={15} />
            </span>
            <div>
              <p className="text-[12.5px] font-semibold text-[var(--text-tertiary)]">{L('최근 돌아보기', 'Latest reflection')}</p>
              <p className="text-[13px] font-semibold text-[var(--text-primary)]">
            {leanAfter.view === 'same'
              ? L('처음 판단과 생각이 같습니다', 'Your view is unchanged')
              : leanAfter.view === 'shifted'
                ? L('처음 판단에서 생각이 달라졌습니다', 'Your view has changed')
                : L('아직 판단하기 어렵습니다', 'You are still unsure')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/45 hover:text-[var(--accent)] cursor-pointer"
          >
            {L('다시 확인', 'Check again')}
          </button>
        </div>
        {leanAfter.note && (
          <p className="px-4 py-3 text-[12.5px] leading-6 text-[var(--text-primary)]">“{leanAfter.note}”</p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-[var(--accent)]/25 bg-[var(--surface)] shadow-[0_8px_24px_rgba(0,0,0,0.055)]">
      <div className="border-b border-[var(--border-subtle)] bg-[var(--ai)]/55 px-4 py-3.5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--accent)] shadow-sm">
            <Compass size={17} />
          </span>
          <div>
            <h4 className="text-[14px] font-bold text-[var(--text-primary)]">{L('처음 판단을 잠깐 돌아보세요', 'Take a quick look at your initial decision')}</h4>
            <p className="mt-0.5 text-[12px] leading-5 text-[var(--text-secondary)]">
              {L('아직 실제 결과를 평가하는 단계는 아닙니다. 지금 생각이 달라졌는지만 남겨요.', 'This is not the outcome check yet. Just note whether your view has changed.')}
            </p>
          </div>
        </div>
      </div>
      <div className="grid gap-5 p-4 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:p-5">
        <div className="rounded-xl bg-[var(--bg)]/75 px-4 py-3.5">
          <p className="text-[12.5px] font-semibold text-[var(--text-tertiary)]">{L('처음 기록한 판단', 'Your initial decision')}</p>
          <p className="mt-1.5 text-[13px] font-medium leading-6 text-[var(--text-primary)]">“{anchor}”</p>
        </div>
        <div>
          <p className="text-[13px] font-bold text-[var(--text-primary)]">{L('지금도 같은 생각인가요?', 'Do you still see it the same way?')}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {[
              { view: 'same' as const, icon: Equal, ko: '생각이 같아요', en: 'Same view' },
              { view: 'shifted' as const, icon: ArrowRightLeft, ko: '생각이 달라졌어요', en: 'My view changed' },
              { view: 'unknown' as const, icon: CircleHelp, ko: '아직 잘 모르겠어요', en: 'Still unsure' },
            ].map(({ view, icon: Icon, ko: koLabel, en }) => (
              <button
                key={view}
                type="button"
                onClick={() => onRecord(view, note.trim() || undefined)}
                className="flex min-h-16 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-[12px] font-semibold leading-5 text-[var(--text-secondary)] transition-[transform,border-color,box-shadow] hover:-translate-y-px hover:border-[var(--accent)]/45 hover:shadow-sm cursor-pointer"
              >
                <Icon size={15} className="shrink-0 text-[var(--accent)]" />
                {L(koLabel, en)}
              </button>
            ))}
          </div>
          <label className="mt-3 grid gap-1.5 text-[12.5px] font-semibold text-[var(--text-secondary)]">
            {L('바뀐 점이나 그대로인 이유 (선택)', 'What changed, or why it still holds (optional)')}
            <input
              type="text"
              aria-label={L('돌아보기 메모', 'Reflection note')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder={L('예: 고객 인터뷰 후 우선순위가 달라졌어요.', 'Example: Customer interviews changed the priority.')}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[12px] font-normal text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]/50 focus:outline-none"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
