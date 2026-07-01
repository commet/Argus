'use client';

/**
 * Settlement (design doc §5 Settle + §Settlement View). On the check-by date
 * Argus does NOT judge — it asks what reality did and lets the user settle.
 * The old prediction and the reality sit on one screen; no praise, no blame.
 */

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { type FalsifiableFollowup, type FollowupOutcome } from '@/lib/review';

const OUTCOMES: { id: FollowupOutcome; label: string }[] = [
  { id: 'happened', label: '그렇게 됐다' },
  { id: 'avoided', label: '피했다 / 안 그랬다' },
  { id: 'partial', label: '부분적으로' },
  { id: 'unclear', label: '아직 불분명' },
];

export function SettleModal({
  followup,
  onSettle,
  onClose,
}: {
  followup: FalsifiableFollowup;
  onSettle: (outcome: FollowupOutcome, whatHappened: string) => void;
  onClose: () => void;
}) {
  const [outcome, setOutcome] = useState<FollowupOutcome | null>(null);
  const [what, setWhat] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <Card variant="elevated">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[16px] font-bold text-[var(--text-primary)]">현실이 어떻게 답했나요?</h3>
            <button onClick={onClose} className="text-[var(--text-tertiary)] text-[18px] leading-none">×</button>
          </div>

          {/* the past prediction — shown, not graded */}
          <Card variant="muted" className="mb-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-tertiary)] mb-1">
              그때 봉인한 예측 · 확인일 {followup.check_by}
            </div>
            <p className="text-[13px] text-[var(--text-primary)]">{followup.predicate}</p>
            {(followup.pass_condition || followup.fail_condition) && (
              <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
                맞음: {followup.pass_condition || '—'} · 틀림: {followup.fail_condition || '—'}
              </p>
            )}
          </Card>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {OUTCOMES.map((o) => (
              <button
                key={o.id}
                onClick={() => setOutcome(o.id)}
                className={`px-3 py-1.5 text-[12px] rounded-full border ${
                  outcome === o.id
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                    : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">무슨 일이 있었나요? (선택)</label>
          <textarea
            value={what}
            onChange={(e) => setWhat(e.target.value)}
            maxLength={500}
            placeholder="현실에서 실제로 어떻게 되었는지 한두 줄로"
            className="w-full h-20 resize-y px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-transparent text-[13px] outline-none"
          />

          <div className="flex gap-2 mt-5">
            <Button
              variant="accent"
              size="md"
              onClick={() => outcome && onSettle(outcome, what)}
              disabled={!outcome}
              style={outcome ? undefined : { opacity: 0.5 }}
            >
              정산하기
            </Button>
            <Button variant="ghost" size="md" onClick={onClose}>
              나중에
            </Button>
          </div>
          <p className="mt-3 text-[11px] text-[var(--text-tertiary)]">
            Argus는 맞다/틀리다를 판정하지 않습니다. 현실이 답하고, 당신이 기록합니다.
          </p>
        </Card>
      </div>
    </div>
  );
}
