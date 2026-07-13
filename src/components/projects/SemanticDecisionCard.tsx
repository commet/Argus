'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, CheckCircle2, Clock3, Eye, LockKeyhole, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useLocale } from '@/hooks/useLocale';
import { useProjectStore } from '@/stores/useProjectStore';
import type { Project } from '@/stores/types';
import { fold, type Resolution, type SemanticState } from '@/lib/decision-kernel';
import { loadProjectSemanticEvents, SemanticLedgerClientError, submitProjectSemanticCommand } from '@/lib/semantic-web-client';
import { semanticProjection, type SemanticWebCommand } from '@/lib/semantic-web';
import { generateId } from '@/lib/uuid';

type ResolutionKind = Resolution['kind'];

function dayFromIso(iso?: string): string {
  const date = iso ? new Date(iso) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function isoFromDay(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const value = `${day}T00:00:00.000Z`;
  return Number.isNaN(new Date(value).getTime()) ? null : value;
}

function eventLabel(raw: unknown): string {
  const event = raw as { event?: unknown };
  const labels: Record<string, string> = {
    judgment_sealed: 'Judgment sealed',
    return_promised: 'Return promised',
    observation_recorded: 'Observation recorded',
    resolution_asserted: 'Answer recorded',
    judgment_closed: 'Record closed',
    return_deferred: 'Return deferred',
  };
  return typeof event.event === 'string' ? (labels[event.event] ?? event.event) : 'Invalid event retained';
}

function eventDetail(raw: unknown): string | undefined {
  const event = raw as Record<string, unknown>;
  if (typeof event.statement === 'string') return event.statement;
  if (typeof event.review_question === 'string') return event.review_question;
  if (typeof event.text === 'string') return event.text;
  const resolution = event.resolution as { answer_summary?: unknown; reason?: unknown } | undefined;
  if (typeof resolution?.answer_summary === 'string') return resolution.answer_summary;
  if (typeof resolution?.reason === 'string') return resolution.reason;
  if (typeof event.reason === 'string') return event.reason;
  return undefined;
}

function statusCopy(lifecycle: string | undefined, ko: boolean): string {
  const copy: Record<string, [string, string]> = {
    sealed: ['기록됨 · 돌아올 날짜를 기다리는 중', 'Recorded · waiting for the return date'],
    due: ['다시 볼 준비가 됨', 'Ready to revisit'],
    resolved_answered: ['답을 남기고 닫힘', 'Answer recorded and closed'],
    resolved_indeterminate: ['불확정으로 닫힘', 'Closed as indeterminate'],
    resolved_moot: ['질문이 무의미해져 닫힘', 'Closed as moot'],
    conflict: ['충돌 검토 필요', 'Conflict needs review'],
  };
  const pair = lifecycle ? copy[lifecycle] : undefined;
  return pair ? pair[ko ? 0 : 1] : (ko ? '정본 기록 준비 중' : 'Preparing canonical record');
}

/**
 * The v6 web projection. This deliberately reads as an evidence timeline, not
 * a scorecard: observation, answer, and closure remain independently visible.
 */
export function SemanticDecisionCard({ project, onCancel }: { project: Project; onCancel?: () => void }) {
  const ko = useLocale() === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);
  const updateProject = useProjectStore((state) => state.updateProject);
  const contract = project.decision_contract;
  const judgmentId = contract?.semantic_judgment_id;
  const [events, setEvents] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(!!judgmentId);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statement, setStatement] = useState(contract?.judgment_receipt?.human_judgment?.trim() || project.name || '');
  const [question, setQuestion] = useState(contract?.judgment_receipt?.real_question?.trim() || contract?.predicates?.[0]?.text || '');
  const [reviewDay, setReviewDay] = useState(dayFromIso(contract?.check_in_at));
  const [observation, setObservation] = useState('');
  const [deferDay, setDeferDay] = useState(dayFromIso(contract?.check_in_at));
  const [resolutionKind, setResolutionKind] = useState<ResolutionKind>('answered');
  const [resolutionText, setResolutionText] = useState('');

  useEffect(() => {
    if (!judgmentId) return;
    let active = true;
    setLoading(true);
    loadProjectSemanticEvents(project.id)
      .then((next) => { if (active) setEvents(next); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'LOAD_FAILED'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [judgmentId, project.id]);

  const state = useMemo(() => fold(events) as SemanticState, [events]);
  const judgment = judgmentId ? state.judgments.get(judgmentId) : undefined;
  const projection = judgmentId ? semanticProjection(events, judgmentId) : undefined;
  const activeReturn = judgment?.active_return_contract_id
    ? judgment.return_contracts.get(judgment.active_return_contract_id)
    : undefined;
  const observations = [...state.observations.values()];
  const resolutionId = judgment?.resolution?.id;
  const isTerminal = projection?.lifecycle.startsWith('resolved_') ?? false;

  async function submit(command: SemanticWebCommand, after?: (next: unknown[]) => void) {
    setWorking(true);
    setError(null);
    try {
      const next = await submitProjectSemanticCommand(project.id, command);
      setEvents(next);
      after?.(next);
    } catch (cause) {
      setError(cause instanceof SemanticLedgerClientError ? cause.code : 'WRITE_FAILED');
    } finally {
      setWorking(false);
    }
  }

  function createRecord() {
    const reviewAt = isoFromDay(reviewDay);
    const cleanStatement = statement.trim();
    const cleanQuestion = question.trim();
    if (!cleanStatement || !cleanQuestion || !reviewAt) {
      setError('STATEMENT_QUESTION_AND_DATE_REQUIRED');
      return;
    }
    const nextJudgmentId = `web-judgment:${generateId()}`;
    const command: SemanticWebCommand = {
      kind: 'seal', command_id: generateId(), judgment_id: nextJudgmentId,
      return_contract_id: `${nextJudgmentId}:return`, statement: cleanStatement,
      review_at: reviewAt, review_question: cleanQuestion,
    };
    void submit(command, () => {
      if (!contract) return;
      updateProject(project.id, { decision_contract: { ...contract, semantic_judgment_id: nextJudgmentId } });
    });
  }

  function recordObservation() {
    const text = observation.trim();
    if (!text) return;
    void submit({ kind: 'observe', command_id: generateId(), observation_id: `web-observation:${generateId()}`, text }, () => setObservation(''));
  }

  function deferReturn() {
    const reviewAt = isoFromDay(deferDay);
    if (!activeReturn || !reviewAt) {
      setError('RETURN_DATE_REQUIRED');
      return;
    }
    void submit({ kind: 'defer', command_id: generateId(), return_contract_id: activeReturn.id, review_at: reviewAt });
  }

  function recordResolution() {
    if (!judgmentId || !activeReturn) return;
    const text = resolutionText.trim();
    if (!text || (resolutionKind === 'answered' && observations.length === 0)) {
      setError(resolutionKind === 'answered' ? 'ANSWER_REQUIRES_AN_OBSERVATION' : 'REASON_REQUIRED');
      return;
    }
    const resolution: Resolution = resolutionKind === 'answered'
      ? { kind: 'answered', answer_summary: text, evidence_refs: observations.map((item) => item.id) }
      : resolutionKind === 'indeterminate'
        ? { kind: 'indeterminate', reason: text, evidence_refs: observations.map((item) => item.id) }
        : { kind: 'moot', reason: text, evidence_refs: observations.map((item) => item.id) };
    void submit({ kind: 'resolve', command_id: generateId(), resolution_id: `web-resolution:${generateId()}`, judgment_id: judgmentId, return_contract_id: activeReturn.id, resolution }, () => setResolutionText(''));
  }

  function closeRecord() {
    if (!judgmentId || !resolutionId) return;
    void submit({ kind: 'close', command_id: generateId(), judgment_id: judgmentId, resolution_id: resolutionId });
  }

  if (!judgmentId) {
    return (
      <Card variant="elevated" className="border-[var(--accent)]/30">
        <div className="flex gap-3">
          <BookOpen className="mt-0.5 shrink-0 text-[var(--accent)]" size={20} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[var(--text-tertiary)]">Decision record</p>
            <h3 className="mt-1 text-[16px] font-bold text-[var(--text-primary)]">{L('판단을 정본 기록으로 남기기', 'Start a canonical judgment record')}</h3>
            <p className="mt-1 text-[13px] leading-5 text-[var(--text-secondary)]">
              {L('예측 점수 대신, 지금의 판단·나중의 관찰·답변·종결을 분리해 남깁니다.', 'This records today’s judgment, later observations, an answer, and a separate close — never a score.')}
            </p>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">
                {L('내가 지금 내리는 판단', 'My judgment now')}
                <textarea value={statement} onChange={(event) => setStatement(event.target.value)} maxLength={4000} rows={2} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] font-normal text-[var(--text-primary)]" />
              </label>
              <label className="grid gap-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">
                {L('나중에 답할 질문', 'Question to answer later')}
                <textarea value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={4000} rows={2} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] font-normal text-[var(--text-primary)]" />
              </label>
              <label className="grid gap-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">
                {L('다시 볼 날짜', 'Return date')}
                <input type="date" value={reviewDay} onChange={(event) => setReviewDay(event.target.value)} className="w-fit rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] font-normal text-[var(--text-primary)]" />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="accent" size="sm" disabled={working} onClick={createRecord}><LockKeyhole size={14} />{L('이 판단을 기록', 'Record this judgment')}</Button>
              {onCancel && <Button variant="ghost" size="sm" onClick={onCancel}>{L('돌아가기', 'Back')}</Button>}
            </div>
            <AuthorityNote ko={ko} />
            {error && <ErrorNote code={error} />}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card variant="elevated" className={projection?.lifecycle === 'conflict' ? 'border-[var(--risk-critical)]/60' : 'border-[var(--accent)]/30'}>
      <div className="flex items-start gap-3">
        <BookOpen className="mt-0.5 shrink-0 text-[var(--accent)]" size={20} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[var(--text-tertiary)]">Canonical decision record</p>
              <h3 className="mt-1 text-[16px] font-bold text-[var(--text-primary)]">{statusCopy(projection?.lifecycle, ko)}</h3>
            </div>
            <Button variant="ghost" size="sm" disabled={loading || working} onClick={() => { setLoading(true); loadProjectSemanticEvents(project.id).then(setEvents).catch((cause) => setError(cause instanceof Error ? cause.message : 'LOAD_FAILED')).finally(() => setLoading(false)); }}><RefreshCw size={14} />{L('새로고침', 'Refresh')}</Button>
          </div>

          {loading ? <p className="mt-3 text-[13px] text-[var(--text-secondary)]">{L('기록을 불러오는 중…', 'Loading the ledger…')}</p> : (
            <>
              <section className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--bg)]/50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">{L('판단', 'Judgment')}</p>
                <p className="mt-1 text-[14px] leading-6 text-[var(--text-primary)]">{projection?.statement ?? L('정본 판단을 찾을 수 없습니다.', 'The canonical judgment is unavailable.')}</p>
                {activeReturn && <p className="mt-2 text-[12px] leading-5 text-[var(--text-secondary)]"><Clock3 className="mr-1 inline" size={13} />{L('다시 답할 질문: ', 'Return question: ')}{activeReturn.review_question}</p>}
              </section>

              <ol className="mt-4 border-l border-[var(--border)] pl-4 space-y-4">
                {events.map((raw, index) => {
                  const event = raw as { event_id?: unknown; time?: { recorded_at?: unknown } };
                  return <li key={typeof event.event_id === 'string' ? event.event_id : index} className="relative text-[13px] leading-5 text-[var(--text-secondary)] before:absolute before:-left-[21px] before:top-1.5 before:h-2 before:w-2 before:rounded-full before:bg-[var(--accent)]">
                    <div className="font-semibold text-[var(--text-primary)]">{eventLabel(raw)}</div>
                    {eventDetail(raw) && <div>{eventDetail(raw)}</div>}
                    {typeof event.time?.recorded_at === 'string' && <time className="text-[11px] text-[var(--text-tertiary)]">{new Date(event.time.recorded_at).toLocaleString(ko ? 'ko-KR' : 'en-US')}</time>}
                  </li>;
                })}
              </ol>

              {!isTerminal && judgment && <div className="mt-5 space-y-3 border-t border-[var(--border)] pt-4">
                <label className="grid gap-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">
                  <span><Eye className="mr-1 inline" size={13} />{L('관찰 기록', 'Record an observation')}</span>
                  <textarea value={observation} onChange={(event) => setObservation(event.target.value)} rows={2} maxLength={4000} placeholder={L('무엇을, 언제, 어떤 근거로 보았나요?', 'What did you observe, when, and from what source?')} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] font-normal text-[var(--text-primary)]" />
                </label>
                <Button variant="secondary" size="sm" disabled={working || !observation.trim()} onClick={recordObservation}>{L('관찰만 남기기', 'Record observation only')}</Button>

                {activeReturn && !resolutionId && <div className="grid gap-3 rounded-lg border border-[var(--border)] p-3">
                  <label className="grid gap-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">
                    {L('답의 종류', 'Answer type')}
                    <select value={resolutionKind} onChange={(event) => setResolutionKind(event.target.value as ResolutionKind)} className="w-fit rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] font-normal text-[var(--text-primary)]">
                      <option value="answered">{L('질문에 답할 수 있음', 'Answered')}</option>
                      <option value="indeterminate">{L('증거가 부족함', 'Indeterminate')}</option>
                      <option value="moot">{L('질문이 더는 유효하지 않음', 'Moot')}</option>
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">
                    {resolutionKind === 'answered' ? L('답변 요약', 'Answer summary') : L('이유', 'Reason')}
                    <textarea value={resolutionText} onChange={(event) => setResolutionText(event.target.value)} rows={2} maxLength={2000} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] font-normal text-[var(--text-primary)]" />
                  </label>
                  <Button variant="secondary" size="sm" disabled={working || !resolutionText.trim()} onClick={recordResolution}>{L('답변 기록', 'Record answer')}</Button>
                </div>}

                {resolutionId && <div className="rounded-lg border border-[var(--accent)]/35 bg-[var(--ai)]/40 p-3">
                  <p className="text-[13px] leading-5 text-[var(--text-primary)]">{L('답변은 기록됐지만 아직 종결되지 않았습니다. 이 해석으로 기록을 닫을지 별도로 확인하세요.', 'The answer is recorded but not closed. Confirm separately if you want to close this record with that interpretation.')}</p>
                  <Button className="mt-3" variant="accent" size="sm" disabled={working} onClick={closeRecord}><CheckCircle2 size={14} />{L('이 답변으로 기록 종결', 'Close with this answer')}</Button>
                </div>}

                {activeReturn && !resolutionId && <div className="flex flex-wrap items-end gap-2">
                  <label className="grid gap-1 text-[12px] font-semibold text-[var(--text-secondary)]">{L('나중에 다시 보기', 'Defer return')}<input type="date" value={deferDay} onChange={(event) => setDeferDay(event.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] font-normal text-[var(--text-primary)]" /></label>
                  <Button variant="ghost" size="sm" disabled={working} onClick={deferReturn}>{L('종결하지 않고 미루기', 'Defer without closing')}</Button>
                </div>}
              </div>}

              {state.anomalies.length > 0 && <div className="mt-4 rounded-lg border border-[var(--risk-critical)]/40 bg-[var(--risk-critical)]/8 p-3 text-[12px] leading-5 text-[var(--text-primary)]"><AlertTriangle className="mr-1 inline text-[var(--risk-critical)]" size={14} />{L('기록 충돌 또는 유효하지 않은 항목이 보존되어 있습니다. 최신 항목이 이전 기록을 덮어쓰지 않았습니다.', 'A conflict or invalid item is retained. No later write has overwritten earlier evidence.')}</div>}
              <AuthorityNote ko={ko} />
              {error && <ErrorNote code={error} />}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function AuthorityNote({ ko }: { ko: boolean }) {
  return <p className="mt-4 text-[11px] leading-5 text-[var(--text-tertiary)]">{ko ? '이 화면의 클릭은 “기록/답변/종결” 명령의 근거로 남습니다. 관찰 내용 자체를 시스템이 검증하거나 자동 판정하지는 않습니다.' : 'Each click is retained as evidence for a record, answer, or close command. The system does not verify the observation itself or infer a verdict.'}</p>;
}

function ErrorNote({ code }: { code: string }) {
  const message = code === 'NOT_SIGNED_IN'
    ? 'Sign in to write to the account’s canonical ledger.'
    : `The record was not changed: ${code}.`;
  return <p role="alert" className="mt-3 text-[12px] text-[var(--risk-critical)]">{message}</p>;
}
