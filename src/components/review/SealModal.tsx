'use client';

/**
 * Judgment Ownership / Seal modal (design doc §"Judgment Ownership Modal" +
 * §Activation Event). Sealing one falsifiable follow-up IS the activation event.
 *
 * Spine rules baked in:
 *  - The user writes/edits the predicate themselves — Argus only pre-fills its
 *    ai_surfaced draft and offers a falsifiability nudge. Sealing flips
 *    predicate_owner to 'user' (honest authorship; no relabeled AI line).
 *  - No verdict, no "proceed". The user owns the lean, the conditions, the date.
 */

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { type FalsifiableFollowup } from '@/lib/review';
import { type SealPatch } from '@/stores/useReviewStore';

export function SealModal({
  followups,
  onSeal,
  onClose,
}: {
  followups: FalsifiableFollowup[];
  onSeal: (followupId: string, patch: SealPatch) => void;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState(followups[0]?.followup_id ?? '');
  const selected = followups.find((f) => f.followup_id === selectedId) ?? followups[0];

  const [predicate, setPredicate] = useState(selected?.predicate ?? '');
  const [lean, setLean] = useState(selected?.lean ?? '');
  const [assumption, setAssumption] = useState(selected?.key_assumption ?? '');
  const [pass, setPass] = useState(selected?.pass_condition ?? '');
  const [fail, setFail] = useState(selected?.fail_condition ?? '');
  const [checkBy, setCheckBy] = useState(selected?.check_by ?? '');

  const pickFollowup = (f: FalsifiableFollowup) => {
    setSelectedId(f.followup_id);
    setPredicate(f.predicate);
    setLean(f.lean ?? '');
    setAssumption(f.key_assumption ?? '');
    setPass(f.pass_condition);
    setFail(f.fail_condition);
    setCheckBy(f.check_by);
  };

  const today = new Date().toISOString().slice(0, 10);
  const canSeal = predicate.trim().length > 5 && /^\d{4}-\d{2}-\d{2}$/.test(checkBy) && checkBy > today;

  if (!selected) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <Card variant="elevated">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[16px] font-bold text-[var(--text-primary)]">이 판단을 봉인하기</h3>
            <button onClick={onClose} className="text-[var(--text-tertiary)] text-[18px] leading-none">×</button>
          </div>
          <p className="text-[12px] text-[var(--text-secondary)] mb-4">
            나중에 현실이 맞다/틀리다로 답할 예측을 하나 봉인합니다. Argus가 판단하지 않습니다 — 확인일에 당신이 정산합니다.
          </p>

          {followups.length > 1 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {followups.map((f) => (
                <button
                  key={f.followup_id}
                  onClick={() => pickFollowup(f)}
                  className={`px-2 py-1 text-[11px] rounded-full border ${
                    f.followup_id === selectedId
                      ? 'border-[var(--accent)] text-[var(--accent)]'
                      : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
                  }`}
                >
                  {f.predicate.slice(0, 18)}…
                </button>
              ))}
            </div>
          )}

          <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
            내가 책임질 예측 {selected.predicate_owner === 'ai_surfaced' && <span className="text-[var(--text-tertiary)] font-normal">(Argus 초안 — 당신 말로 고쳐 쓰세요)</span>}
          </label>
          <textarea
            value={predicate}
            onChange={(e) => setPredicate(e.target.value)}
            maxLength={400}
            className="w-full h-20 resize-y px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-transparent text-[13px] outline-none"
          />

          {/* The user writes their own lean + assumption. Argus never fills a
              pole here — that would tilt the judgment (spine §Ownership Modal). */}
          <div className="grid grid-cols-1 gap-2 mt-3">
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
                지금 내 lean <span className="text-[var(--text-tertiary)] font-normal">(내 판단 — 당신이 직접)</span>
              </label>
              <input value={lean} onChange={(e) => setLean(e.target.value)} maxLength={200}
                placeholder="예: 그래도 이번 분기엔 리빌드가 맞다고 본다"
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-transparent text-[13px] outline-none placeholder:text-[var(--text-tertiary)]" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
                내가 믿고 있는 핵심 가정
              </label>
              <input value={assumption} onChange={(e) => setAssumption(e.target.value)} maxLength={200}
                placeholder="예: 이탈의 주원인이 온보딩 복잡도라는 것"
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-transparent text-[13px] outline-none placeholder:text-[var(--text-tertiary)]" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 mt-3">
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">맞았다고 볼 조건</label>
              <input value={pass} onChange={(e) => setPass(e.target.value)} maxLength={200}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-transparent text-[13px] outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">틀렸다고 볼 조건</label>
              <input value={fail} onChange={(e) => setFail(e.target.value)} maxLength={200}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-transparent text-[13px] outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">확인 날짜</label>
              <input type="date" value={checkBy} min={today} onChange={(e) => setCheckBy(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-transparent text-[13px] outline-none" />
            </div>
          </div>

          <div className="flex gap-2 mt-5">
            <Button
              variant="accent"
              size="md"
              onClick={() => onSeal(selected.followup_id, { predicate, lean, key_assumption: assumption, pass_condition: pass, fail_condition: fail, check_by: checkBy })}
              disabled={!canSeal}
              style={canSeal ? undefined : { opacity: 0.5 }}
            >
              봉인하기
            </Button>
            <Button variant="ghost" size="md" onClick={onClose}>
              취소
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
