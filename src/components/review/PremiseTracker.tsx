'use client';

/**
 * Living-premise tracker (D — premise monitoring). Lets the user promote a
 * review's extracted assumptions / weak claims into individually tracked
 * premises, then re-check each against reality on its own cadence.
 *
 * Spine (CLAUDE.md §Zero-Judgment): a re-check surfaces "fact + handle", never a
 * verdict. A material change is shown as a NEUTRAL QUESTION ("다시 볼까요?"), not
 * a directive; 'uncertain' stays quiet with an honest "define a rule" note. The
 * caps (5 active / 2 load-bearing, enforced in the store) keep tracking from ever
 * becoming a nag. HONEST LIMIT: Argus can't watch reality for you — the user
 * supplies the finding; a re-check is a pull, never an auto-detected change.
 */

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useLocale } from '@/hooks/useLocale';
import { type JudgmentReceipt } from '@/lib/review';
import { useReviewStore, type RecheckStatus } from '@/stores/useReviewStore';
import {
  isDueForRecheck,
  normalizePremiseText,
  MAX_ACTIVE_PREMISES,
  type PremiseState,
} from '@/lib/premises-core';

type LFn = (ko: string, en: string) => string;

function recheckSurface(status: RecheckStatus, ordinal: number, L: LFn): { tone: 'handle' | 'muted'; text: string } {
  switch (status) {
    case 'material':
      // a neutral question + the handle — NEVER a verdict or a directive.
      return { tone: 'handle', text: L(`P${ordinal}이(가) 바뀐 것 같아요 — 이 판단, 지금 다시 볼까요?`, `P${ordinal} looks changed — want to revisit this call now?`) };
    case 'uncertain':
      return { tone: 'muted', text: L('바뀌었는지 애매해요. 판단 기준을 정하면 더 정확하고, 아니면 그대로 두셔도 돼요.', 'Hard to say if it changed. A rule would sharpen it — or leave it as is.') };
    case 'unchanged':
      return { tone: 'muted', text: L('그대로예요. 기록해뒀어요.', 'Unchanged. Recorded.') };
    default: // baseline
      return { tone: 'muted', text: L('기준값으로 기록했어요. 다음 확인 때 이것과 비교할게요.', 'Recorded as the baseline. Next check compares against this.') };
  }
}

export function PremiseTracker({ receipt }: { receipt: JudgmentReceipt }) {
  const locale = useLocale();
  const L: LFn = (ko, en) => (locale === 'ko' ? ko : en);
  const store = useReviewStore();
  const today = new Date().toISOString().slice(0, 10);

  const tracked = (receipt.tracked_premises ?? []).filter((p) => p.status === 'active');
  const armed = receipt.state === 'sealed' || receipt.falsifiable_followups.some((f) => f.sealed_at && !f.settled_at);
  const atCap = tracked.length >= MAX_ACTIVE_PREMISES;
  const trackedTexts = new Set(tracked.map((p) => normalizePremiseText(p.text)));

  // Candidates to promote: risky assumptions + claims that aren't settled-supported.
  const rawCandidates = [
    ...receipt.hidden_assumptions.map((a) => a.text),
    ...receipt.claim_ledger.filter((c) => c.status !== 'supported').map((c) => c.text),
  ];
  const seen = new Set<string>();
  const candidates = rawCandidates.filter((t) => {
    const k = normalizePremiseText(t || '');
    if (!t || !k || trackedTexts.has(k) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const [recheckId, setRecheckId] = useState<string | null>(null);
  const [finding, setFinding] = useState('');
  const [mode, setMode] = useState<'fact' | 'number'>('fact');
  const [numeric, setNumeric] = useState('');
  const [changed, setChanged] = useState<boolean | null>(null);
  const [result, setResult] = useState<{ id: string; status: RecheckStatus } | null>(null);
  const [showCandidates, setShowCandidates] = useState(false);

  if (tracked.length === 0 && candidates.length === 0) return null;

  const openRecheck = (id: string) => {
    setRecheckId(id);
    setFinding(''); setNumeric(''); setChanged(null); setMode('fact');
  };

  const submitRecheck = (p: PremiseState) => {
    const f = finding.trim();
    if (!f) return;
    const parsed = mode === 'number' && numeric.trim() !== '' ? Number(numeric) : undefined;
    const status = store.recheckPremise(receipt.receipt_id, p.premise_id, {
      finding: f,
      numeric_value: typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : undefined,
      changed: mode === 'fact' && changed !== null ? changed : undefined,
      source: 'user_stated',
    });
    setResult({ id: p.premise_id, status });
    setRecheckId(null);
  };

  return (
    <Card variant="muted">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)] mb-2">
        {L('추적 중인 전제', 'Tracked premises')}
      </div>

      {tracked.length > 0 && (
        <div className="space-y-3">
          {tracked.map((p) => {
            const due = armed && isDueForRecheck(p, today);
            const last = p.last_recheck;
            const res = result?.id === p.premise_id ? result.status : null;
            const surface = res ? recheckSurface(res, p.ordinal, L) : null;
            return (
              <div key={p.premise_id} className="text-[13px] border-b border-[var(--border-subtle)] last:border-0 pb-2.5 last:pb-0">
                <div className="flex items-start gap-2">
                  <span className="inline-block px-1 py-0.5 mt-0.5 text-[10px] rounded border border-[var(--border-subtle)] text-[var(--text-tertiary)] tabular-nums shrink-0">P{p.ordinal}</span>
                  <div className="min-w-0 flex-1">
                    <span className="text-[var(--text-primary)]">{p.text}</span>
                    {p.load_bearing && <span className="ml-1.5 text-[10px] text-[var(--accent)]">{L('핵심', 'load-bearing')}</span>}
                    {due && (
                      <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">{L('확인할 때', 'due')}</span>
                    )}
                    {last && (
                      <p className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
                        {L('지난 확인', 'Last check')}: {last.finding}
                        {last.drifted && <span className="text-amber-700"> · {L('바뀜', 'changed')}</span>}
                      </p>
                    )}
                    {surface && (
                      <p className={`mt-1 text-[12px] ${surface.tone === 'handle' ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>{surface.text}</p>
                    )}
                  </div>
                  <button
                    onClick={() => (recheckId === p.premise_id ? setRecheckId(null) : openRecheck(p.premise_id))}
                    className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--accent)] shrink-0"
                  >
                    {recheckId === p.premise_id ? L('닫기', 'Close') : L('지금 현실은?', 'Reality now?')}
                  </button>
                </div>

                {recheckId === p.premise_id && (
                  <div className="mt-2 pl-7 space-y-2">
                    <textarea
                      value={finding}
                      onChange={(e) => setFinding(e.target.value)}
                      maxLength={400}
                      rows={2}
                      placeholder={L('지금 현실이 어떤지 한 문장으로 (예: "기준금리 3.75%로 올랐다")', 'One sentence on reality now')}
                      className="w-full text-[12px] p-2 rounded border border-[var(--border-subtle)] bg-[var(--bg)] text-[var(--text-primary)]"
                    />
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <button onClick={() => setMode('fact')} className={`px-2 py-0.5 rounded-full border ${mode === 'fact' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border-subtle)] text-[var(--text-tertiary)]'}`}>{L('사실', 'Fact')}</button>
                      <button onClick={() => setMode('number')} className={`px-2 py-0.5 rounded-full border ${mode === 'number' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border-subtle)] text-[var(--text-tertiary)]'}`}>{L('수치', 'Number')}</button>
                      {mode === 'number' ? (
                        <input
                          value={numeric}
                          onChange={(e) => setNumeric(e.target.value)}
                          inputMode="decimal"
                          placeholder={L('지금 값 (예: 3.75)', 'Value now')}
                          className="w-28 px-2 py-0.5 rounded border border-[var(--border-subtle)] bg-[var(--bg)] text-[var(--text-primary)]"
                        />
                      ) : (
                        <>
                          <span className="text-[var(--text-tertiary)]">{L('기준 대비:', 'vs baseline:')}</span>
                          <button onClick={() => setChanged(true)} className={`px-2 py-0.5 rounded-full border ${changed === true ? 'border-amber-500 text-amber-700' : 'border-[var(--border-subtle)] text-[var(--text-tertiary)]'}`}>{L('바뀜', 'Changed')}</button>
                          <button onClick={() => setChanged(false)} className={`px-2 py-0.5 rounded-full border ${changed === false ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border-subtle)] text-[var(--text-tertiary)]'}`}>{L('그대로', 'Same')}</button>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => submitRecheck(p)} disabled={!finding.trim()}>{L('기록', 'Record')}</Button>
                      <button onClick={() => store.retirePremise(receipt.receipt_id, p.premise_id)} className="text-[11px] text-[var(--text-tertiary)] hover:text-red-600">{L('추적 그만', 'Stop tracking')}</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {candidates.length > 0 && (
        <div className={tracked.length > 0 ? 'mt-3 pt-3 border-t border-[var(--border-subtle)]' : ''}>
          {!showCandidates ? (
            <button onClick={() => setShowCandidates(true)} className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--accent)]">
              {L(`전제로 추적하기 (${candidates.length})`, `Track a premise (${candidates.length})`)}
            </button>
          ) : (
            <div className="space-y-1.5">
              <p className="text-[11px] text-[var(--text-tertiary)]">
                {atCap
                  ? L(`전제는 최대 ${MAX_ACTIVE_PREMISES}개까지예요. 하나를 그만 추적하면 더 추가할 수 있어요.`, `Up to ${MAX_ACTIVE_PREMISES} premises. Stop tracking one to add more.`)
                  : L('현실이 바뀌면 확인하고 싶은 전제를 고르세요. 봉인 후 확인일이 되면 이메일로 알려드려요(감시가 아니라 초대예요).', 'Pick premises to re-check as reality moves. After sealing, we email a reminder at the cadence — an invite, not surveillance.')}
              </p>
              {candidates.map((t) => (
                <div key={t} className="flex items-start gap-2 text-[12px]">
                  <button
                    disabled={atCap}
                    onClick={() => store.promotePremise(receipt.receipt_id, { text: t, load_bearing: true, external: true })}
                    className="text-[11px] px-1.5 py-0.5 rounded border border-[var(--border-subtle)] text-[var(--accent)] hover:border-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    {L('추적', 'Track')}
                  </button>
                  <span className="text-[var(--text-secondary)]">{t}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
