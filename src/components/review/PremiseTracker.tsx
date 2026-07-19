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
import { LocaleLink } from '@/components/ui/LocaleLink';
import { useLocale } from '@/hooks/useLocale';
import { useAuth } from '@/lib/auth';
import { type JudgmentReceipt } from '@/lib/review';
import { useReviewStore, type RecheckStatus } from '@/stores/useReviewStore';
import {
  isDueForRecheck,
  isDueForReconsider,
  normalizePremiseText,
  MAX_ACTIVE_PREMISES,
  type PremiseState,
} from '@/lib/premises-core';
import { sharedGroundCount } from '@/lib/judgment-graph';
import { Eye } from 'lucide-react';

type LFn = (ko: string, en: string) => string;
type RecheckConfidence = NonNullable<PremiseState['last_recheck']>['confidence'];

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

function confidenceLabel(confidence: RecheckConfidence, L: LFn): string {
  switch (confidence) {
    case 'high': return L('높음', 'High');
    case 'medium': return L('보통', 'Medium');
    case 'low': return L('낮음', 'Low');
    default: return L('표시 없음', 'Not shown');
  }
}

function sourceLabel(source?: string, L?: LFn): string {
  if (!L) return source || '';
  switch (source) {
    case 'url': return L('웹 출처', 'Web source');
    case 'user_stated': return L('사용자 기록', 'User stated');
    case 'host_reported': return L('최근 확인', 'Host reported');
    default: return source || L('출처 표시 없음', 'No source shown');
  }
}

function valueText(value?: number, fallback?: string): string | null {
  if (typeof value === 'number') return String(value);
  return fallback || null;
}

export function PremiseTracker({ receipt }: { receipt: JudgmentReceipt }) {
  const locale = useLocale();
  const L: LFn = (ko, en) => (locale === 'ko' ? ko : en);
  const { user } = useAuth();
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
            const isOpenQ = p.kind === 'open_question';
            const due = armed && (isOpenQ ? isDueForReconsider(p, today) : isDueForRecheck(p, today));
            const shared = isOpenQ ? 0 : sharedGroundCount(store.receipts ?? [], receipt.receipt_id, p.text);
            const last = p.last_recheck;
            const res = result?.id === p.premise_id ? result.status : null;
            const surface = res ? recheckSurface(res, p.ordinal, L) : null;
            return (
              <div
                id={`premise-${p.premise_id}`}
                key={p.premise_id}
                tabIndex={-1}
                className="text-[13px] border-b border-[var(--border-subtle)] last:border-0 pb-2.5 last:pb-0 scroll-mt-24 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
              >
                <div className="flex items-start gap-2">
                  <span className="inline-block px-1 py-0.5 mt-0.5 text-[10px] rounded border border-[var(--border-subtle)] text-[var(--text-tertiary)] tabular-nums shrink-0">P{p.ordinal}</span>
                  <div className="min-w-0 flex-1">
                    <span className="text-[var(--text-primary)]">{p.text}</span>
                    {p.load_bearing && <span className="ml-1.5 text-[10px] text-[var(--accent)]">{L('핵심', 'load-bearing')}</span>}
                    {isOpenQ && <span className="ml-1.5 text-[10px] text-[var(--text-tertiary)]">{L('미결', 'open')}</span>}
                    {due && (
                      <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/30">{L('확인할 때', 'due')}</span>
                    )}
                    {shared > 0 && (
                      /* Quiet cross-link (judgment graph): a count, never a nudge —
                         the same ground literally appears under other judgments. */
                      <p className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
                        {L(`이 전제는 다른 판단 ${shared}개 아래에도 있어요.`, `Also under ${shared} other judgment${shared === 1 ? '' : 's'}.`)}
                      </p>
                    )}
                    {last && (
                      <div className="mt-1 space-y-1 text-[11px] text-[var(--text-tertiary)]">
                        <p>
                          {L('지난 확인', 'Last check')}: {last.finding}
                          {last.drifted && <span className="text-[var(--warning)]"> · {L('바뀜', 'changed')}</span>}
                        </p>
                        <div className="grid gap-1 sm:grid-cols-2">
                          <p>
                            <span className="font-semibold text-[var(--text-secondary)]">{L('기록 당시 값', 'Value when recorded')}:</span>{' '}
                            {valueText(last.baseline_numeric_value, last.baseline_finding) ?? (last.baseline_only ? L('첫 기준값', 'First baseline') : L('표시 없음', 'Not shown'))}
                          </p>
                          <p>
                            <span className="font-semibold text-[var(--text-secondary)]">{L('지금 값', 'Current value')}:</span>{' '}
                            {valueText(last.numeric_value, last.finding) ?? L('표시 없음', 'Not shown')}
                          </p>
                        </div>
                        <p className="break-words">
                          <span className="font-semibold text-[var(--text-secondary)]">{L('출처', 'Source')}:</span>{' '}
                          {sourceLabel(last.source, L)}
                          {last.source_detail ? ` · ${last.source_detail}` : ''}
                          <span className="mx-1.5">·</span>
                          <span className="font-semibold text-[var(--text-secondary)]">{L('확신도', 'Confidence')}:</span>{' '}
                          {confidenceLabel(last.confidence, L)}
                        </p>
                      </div>
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

                {/* auto-watch opt-in (Workstream E) — monitored premises + open questions. */}
                {(p.load_bearing || isOpenQ) && (
                  <div className="mt-1.5 pl-7 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                    <button
                      onClick={() => store.setAutoWatch(receipt.receipt_id, p.premise_id, !p.auto_watch)}
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${p.auto_watch ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border-subtle)] text-[var(--text-tertiary)]'}`}
                    >
                      <Eye size={12} aria-hidden="true" />
                      {p.auto_watch
                        ? (isOpenQ ? L('✓ Argus가 새 정보 확인 중', '✓ Argus is watching for news') : L('✓ Argus가 대신 확인 중', '✓ Argus is watching'))
                        : (isOpenQ ? L('Argus가 새 정보 확인', 'Watch for new info') : L('Argus가 대신 확인', 'Let Argus watch'))}
                    </button>
                    {p.auto_watch && (
                      <span className="text-[var(--text-tertiary)]">
                        {isOpenQ
                          ? L('이 질문 관련 새 정보가 나오면 알려드려요.', 'Pings you when new info to decide this appears.')
                          : L('이 전제 텍스트로 최신 웹을 검색해, 바뀌면 알려드려요.', 'Searches the recent web for this and pings you if it shifts.')}
                      </span>
                    )}
                    {p.auto_watch && !user && (
                      <span className="text-[var(--warning)]">
                        {L('알림은 이메일이 있어야 가요 — ', 'Alerts need an email — ')}
                        <LocaleLink href="/login" className="underline hover:text-[var(--accent)]">{L('이메일 등록', 'register')}</LocaleLink>
                      </span>
                    )}
                  </div>
                )}

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
                          <button onClick={() => setChanged(true)} className={`px-2 py-0.5 rounded-full border ${changed === true ? 'border-amber-500 text-[var(--warning)]' : 'border-[var(--border-subtle)] text-[var(--text-tertiary)]'}`}>{L('바뀜', 'Changed')}</button>
                          <button onClick={() => setChanged(false)} className={`px-2 py-0.5 rounded-full border ${changed === false ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border-subtle)] text-[var(--text-tertiary)]'}`}>{L('그대로', 'Same')}</button>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => submitRecheck(p)} disabled={!finding.trim()}>{L('기록', 'Record')}</Button>
                      <button onClick={() => store.retirePremise(receipt.receipt_id, p.premise_id)} className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--danger)]">{L('추적 그만', 'Stop tracking')}</button>
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
              {L(`추적할 항목 고르기 (${candidates.length})`, `Track an item (${candidates.length})`)}
            </button>
          ) : (
            <div className="space-y-1.5">
              <p className="text-[11px] text-[var(--text-tertiary)]">
                {atCap
                  ? L(`최대 ${MAX_ACTIVE_PREMISES}개까지예요. 하나를 그만 추적하면 더 추가할 수 있어요.`, `Up to ${MAX_ACTIVE_PREMISES} items. Stop tracking one to add more.`)
                  : L('전제(사실 가정)나 아직 못 정한 판단(미결)을 고르세요. 확인일이 되면 이메일로 알려드려요.', 'Pick a premise (a fact you\'re assuming) or a decision you haven\'t made (open). We email you at the cadence.')}
              </p>
              {candidates.map((t) => (
                <div key={t} className="flex items-start gap-2 text-[12px]">
                  <div className="flex gap-1 shrink-0">
                    <button
                      disabled={atCap}
                      onClick={() => store.promotePremise(receipt.receipt_id, { text: t, load_bearing: true, external: true })}
                      className="text-[11px] px-1.5 py-0.5 rounded border border-[var(--border-subtle)] text-[var(--accent)] hover:border-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed"
                      title={L('사실 가정으로 추적 — 바뀌면 알림', 'Track as a fact assumption — alert on change')}
                    >
                      {L('전제로', 'As premise')}
                    </button>
                    <button
                      disabled={atCap}
                      onClick={() => store.promotePremise(receipt.receipt_id, { text: t, load_bearing: false, external: true, kind: 'open_question' })}
                      className="text-[11px] px-1.5 py-0.5 rounded border border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed"
                      title={L('아직 못 정한 판단 — 도울 새 정보 나오면 알림', 'A decision you haven\'t made — alert on new info to decide it')}
                    >
                      {L('미결로', 'As open')}
                    </button>
                  </div>
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
