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
import { Compass } from 'lucide-react';
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
      <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5">
        <div className="flex items-center gap-1.5">
          <Compass size={13} className="text-[var(--text-tertiary)]" />
          <span className="text-[12px] text-[var(--text-secondary)]">
            {leanAfter.view === 'same'
              ? L('지난번 돌아봤을 때: 그때 시야 그대로', 'Last look: same view as when you sealed')
              : L('지난번 돌아봤을 때: 시야가 조금 바뀜', 'Last look: your view had shifted a little')}
          </span>
        </div>
        {leanAfter.note && (
          <p className="text-[12px] text-[var(--text-primary)] leading-[1.5] mt-1 pl-[19px]">“{leanAfter.note}”</p>
        )}
        <button
          onClick={() => setOpen(true)}
          className="mt-1.5 ml-[19px] text-[11px] text-[var(--text-tertiary)] hover:text-[var(--accent)] cursor-pointer transition-colors"
        >
          {L('다시 돌아보기', 'Look again')}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-[var(--accent)]/25 bg-[var(--surface)] p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Compass size={13} className="text-[var(--accent)]" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--accent)]">
          {L('돌아보기', 'A look back')}
        </span>
      </div>
      <p className="text-[11px] font-semibold text-[var(--text-tertiary)]">{L('그때의 나', 'What you thought then')}</p>
      <p className="text-[13px] text-[var(--text-primary)] leading-[1.5] mt-0.5">{anchor}</p>

      <p className="text-[12px] text-[var(--text-secondary)] mt-2.5 mb-1.5">
        {L('결과는 아직이지만 — 지금도 그렇게 보이나요?', 'Reality is not in yet — but does it still look that way to you?')}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => onRecord('same', note.trim() || undefined)}
          className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50 cursor-pointer transition-colors"
        >
          {L('그때 그대로 본다', 'Still see it the same')}
        </button>
        <button
          onClick={() => onRecord('shifted', note.trim() || undefined)}
          className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50 cursor-pointer transition-colors"
        >
          {L('시야가 좀 바뀌었다', 'My view has shifted')}
        </button>
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={200}
        placeholder={L('무엇이 그대로거나 바뀌었나요? (선택)', "What held, or moved? (optional)")}
        className="mt-2 w-full text-[12px] text-[var(--text-primary)] bg-[var(--bg)] border border-[var(--border)] rounded-md px-2.5 py-1.5 focus:outline-none focus:border-[var(--accent)]/50 placeholder:text-[var(--text-tertiary)]"
      />
    </div>
  );
}
