'use client';

/**
 * Settlement (design doc §5 Settle + §Settlement View). On the check-by date
 * Argus does NOT judge — it asks what reality did and lets the user settle.
 * The old prediction and the reality sit on one screen; no praise, no blame.
 */

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useLocale } from '@/hooks/useLocale';
import { type FalsifiableFollowup, type FollowupOutcome, type SettledOutcome } from '@/lib/review';
import { ArgusMascot } from '@/components/brand/ArgusMascot';

export function SettleModal({
  followup,
  onSettle,
  onRevise,
  onClose,
}: {
  followup: FalsifiableFollowup;
  onSettle: (outcome: SettledOutcome, whatHappened: string, learned: string) => void;
  onRevise?: (newCheckBy: string, reason: string) => void;
  onClose: () => void;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const [outcome, setOutcome] = useState<FollowupOutcome | null>(null);
  const [what, setWhat] = useState('');
  const [learned, setLearned] = useState('');
  const [newDate, setNewDate] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  // "아직 불분명" is not an outcome — reality has not answered, so the honest move
  // is to pick a new date, not to file a settlement. Choosing it opens the date
  // picker and disables Settle. Previously this chip stamped settled_at and the
  // decision vanished from the dashboard, the due badge, and the Brief email —
  // while a separate ghost button did the right thing. One concept, one control.
  const deferring = outcome === 'unclear';

  const OUTCOMES: { id: FollowupOutcome; label: string }[] = [
    { id: 'happened', label: L('그렇게 됐다', 'It happened') },
    { id: 'avoided', label: L('피했다 / 안 그랬다', 'Avoided / did not happen') },
    { id: 'partial', label: L('부분적으로', 'Partially') },
    { id: 'unclear', label: L('아직 불분명 (날짜 미루기)', 'Still unclear (push the date)') },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <Card variant="elevated">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <ArgusMascot moment="returning" size="sm" alt="" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{L('약속한 날의 귀환', 'Return on the promised day')}</p>
                <h3 className="text-[16px] font-bold text-[var(--text-primary)]">{L('현실이 어떻게 답했나요?', 'How did reality answer?')}</h3>
              </div>
            </div>
            <button onClick={onClose} className="text-[var(--text-tertiary)] text-[18px] leading-none">×</button>
          </div>

          {/* the past prediction — shown, not graded */}
          <Card variant="muted" className="mb-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-tertiary)] mb-1">
              {L(`그때 봉인한 예측 · 확인일 ${followup.check_by}`, `The prediction you sealed · check by ${followup.check_by}`)}
            </div>
            <p className="text-[13px] text-[var(--text-primary)]">{followup.predicate}</p>
            {(followup.pass_condition || followup.fail_condition) && (
              <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
                {L('맞음', 'Pass')}: {followup.pass_condition || '—'} · {L('틀림', 'Fail')}: {followup.fail_condition || '—'}
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

          {/* Deferring? Then nothing happened yet — asking "what happened" would be
              a question about a thing that has not occurred. Ask why instead. */}
          <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
            {deferring
              ? L('아직 답이 안 나온 이유 (선택)', 'Why it has not answered yet (optional)')
              : L('무슨 일이 있었나요? (선택)', 'What happened? (optional)')}
          </label>
          <textarea
            value={what}
            onChange={(e) => setWhat(e.target.value)}
            maxLength={500}
            placeholder={deferring
              ? L('예: 데이터가 다음 달에나 나온다', 'e.g. the trial data does not land until next month')
              : L('현실에서 실제로 어떻게 되었는지 한두 줄로', 'A line or two on how it actually went')}
            className="w-full h-20 resize-y px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-transparent text-[13px] outline-none"
          />

          {/* 배운 점 — Settlement View §937 "아래: 배운 점". Nothing to learn from a
              non-answer, so it is hidden while deferring. */}
          {!deferring && (<>
          <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1 mt-3">{L('배운 점 (선택)', 'What you learned (optional)')}</label>
          <textarea
            value={learned}
            onChange={(e) => setLearned(e.target.value)}
            maxLength={500}
            placeholder={L('다음 판단에 가져갈 한 줄 — 없어도 됩니다', "One line to carry into your next judgment — it's fine to leave empty")}
            className="w-full h-16 resize-y px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-transparent text-[13px] outline-none"
          />
          </>)}

          {/* unclear = reality is silent → pick when to look again. Nothing is settled. */}
          {deferring && (
            <div className="mt-4 rounded-lg bg-[var(--accent)]/[0.04] px-4 py-3">
              <p className="text-[12px] text-[var(--text-secondary)] mb-2">
                {L(
                  '정산하지 않습니다. 현실이 아직 답하지 않았으니, 언제 다시 볼지만 정하세요.',
                  'Nothing gets settled. Reality has not answered — just choose when to look again.',
                )}
              </p>
              <div className="flex items-center gap-2">
                <input type="date" value={newDate} min={today} onChange={(e) => setNewDate(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-transparent text-[13px] outline-none" />
                <Button variant="accent" size="sm" disabled={!(newDate > today)} style={newDate > today ? undefined : { opacity: 0.5 }}
                  onClick={() => onRevise?.(newDate, what)}>
                  {L('이 날짜에 다시', 'Look again then')}
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-5">
            {!deferring && (
              <Button
                variant="accent"
                size="md"
                onClick={() => outcome && onSettle(outcome, what, learned)}
                disabled={!outcome}
                style={outcome ? undefined : { opacity: 0.5 }}
              >
                {L('정산하기', 'Settle')}
              </Button>
            )}
            <Button variant="ghost" size="md" onClick={onClose}>
              {L('나중에', 'Later')}
            </Button>
          </div>
          <p className="mt-3 text-[11px] text-[var(--text-tertiary)]">
            {L(
              'Argus는 맞다/틀리다를 판정하지 않습니다. 현실이 답하고, 당신이 기록합니다.',
              'Argus does not judge right or wrong. Reality answers, and you record it.',
            )}
          </p>
        </Card>
      </div>
    </div>
  );
}
