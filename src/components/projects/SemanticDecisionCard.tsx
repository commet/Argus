'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  FileCheck2,
  History,
  LockKeyhole,
  Plus,
  RefreshCw,
} from 'lucide-react';
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

function eventLabel(raw: unknown, ko: boolean): string {
  const event = raw as { event?: unknown };
  const labels: Record<string, [string, string]> = {
    judgment_sealed: ['처음 판단 저장', 'Decision saved'],
    return_promised: ['다시 볼 날짜 설정', 'Review date set'],
    observation_recorded: ['새 근거 추가', 'Evidence added'],
    resolution_asserted: ['확인 결과 저장', 'Outcome recorded'],
    judgment_closed: ['기록 마침', 'Review closed'],
    return_deferred: ['확인 날짜 변경', 'Review date changed'],
  };
  if (typeof event.event !== 'string') return ko ? '확인이 필요한 기록' : 'Record needs review';
  const label = labels[event.event];
  return label ? label[ko ? 0 : 1] : event.event;
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
    sealed: ['기록 완료 · 확인 날짜를 기다리는 중', 'Saved · waiting for the review date'],
    due: ['지금 결과를 확인할 수 있어요', 'Ready to record the outcome'],
    resolved_answered: ['결과를 기록했습니다', 'Outcome recorded'],
    resolved_indeterminate: ['근거 부족으로 기록을 마쳤습니다', 'Closed with insufficient evidence'],
    resolved_moot: ['상황이 바뀌어 기록을 마쳤습니다', 'Closed because the question changed'],
    conflict: ['기록 확인이 필요합니다', 'Record needs review'],
  };
  const pair = lifecycle ? copy[lifecycle] : undefined;
  return pair ? pair[ko ? 0 : 1] : (ko ? '판단 기록을 준비하는 중' : 'Preparing decision follow-up');
}

function formatReviewDate(value: string | undefined, ko: boolean): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(ko ? 'ko-KR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
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
  const recordUnavailable = !loading && Boolean(judgmentId) && !judgment;

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
      <Card variant="elevated" className="!overflow-hidden !border-[var(--accent)]/30 !p-0">
        <div className="border-b border-[var(--border-subtle)] bg-[var(--ai)]/55 px-5 py-5 md:px-6">
          <div className="flex items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--accent)] shadow-sm">
              <BookOpen size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-[0.08em] text-[var(--accent)]">{L('판단 추적', 'Decision follow-up')}</p>
              <h2 className="mt-1 text-[18px] font-bold leading-7 text-[var(--text-primary)]">{L('지금 판단을 저장하고, 다시 볼 날짜를 정해요', 'Save today’s decision and choose when to revisit it')}</h2>
              <p className="mt-1 text-[13px] leading-6 text-[var(--text-secondary)]">
                {L('결정 이후 새로 알게 된 근거와 실제 결과를 같은 기록에 이어서 남길 수 있습니다.', 'Keep later evidence and the actual outcome connected to this decision.')}
              </p>
            </div>
          </div>
          <ol className="mt-4 grid gap-2 sm:grid-cols-3" aria-label={L('판단 추적 순서', 'Decision follow-up steps')}>
            {[
              L('1. 지금 판단 저장', '1. Save decision'),
              L('2. 새 근거 추가', '2. Add evidence'),
              L('3. 결과 기록', '3. Record outcome'),
            ].map((label, index) => (
              <li key={label} className={`rounded-lg px-3 py-2 text-[11.5px] font-semibold ${index === 0 ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-sm' : 'bg-[var(--bg)]/55 text-[var(--text-secondary)]'}`}>
                {label}
              </li>
            ))}
          </ol>
        </div>
        <div className="p-5 md:p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 text-[12px] font-bold text-[var(--text-primary)] shadow-sm">
              {L('지금의 판단', 'Your decision now')}
              <span className="text-[11px] font-normal leading-5 text-[var(--text-tertiary)]">{L('나중에 그대로 비교할 수 있도록 현재 생각을 적습니다.', 'Write your current view so you can compare it later.')}</span>
              <textarea value={statement} onChange={(event) => setStatement(event.target.value)} maxLength={4000} rows={3} className="mt-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-[13px] font-normal leading-6 text-[var(--text-primary)] focus:border-[var(--accent)]/55 focus:outline-none" />
            </label>
            <label className="grid gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 text-[12px] font-bold text-[var(--text-primary)] shadow-sm">
              {L('나중에 확인할 질문', 'Question to revisit')}
              <span className="text-[11px] font-normal leading-5 text-[var(--text-tertiary)]">{L('무엇이 확인되면 이 판단의 결과를 알 수 있는지 질문으로 적습니다.', 'Name the question that reality can answer later.')}</span>
              <textarea value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={4000} rows={3} className="mt-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-[13px] font-normal leading-6 text-[var(--text-primary)] focus:border-[var(--accent)]/55 focus:outline-none" />
            </label>
          </div>
          <label className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-[var(--bg)]/70 px-4 py-3 text-[12px] font-bold text-[var(--text-primary)]">
            <CalendarDays size={17} className="text-[var(--accent)]" />
            <span>{L('결과를 다시 확인할 날짜', 'Date to review the outcome')}</span>
            <input type="date" value={reviewDay} onChange={(event) => setReviewDay(event.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] font-normal text-[var(--text-primary)] focus:border-[var(--accent)]/55 focus:outline-none" />
          </label>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="accent" size="sm" disabled={working} onClick={createRecord}><LockKeyhole size={14} />{L('판단 추적 시작', 'Start follow-up')}</Button>
            {onCancel && <Button variant="ghost" size="sm" onClick={onCancel}><ArrowLeft size={14} />{L('기존 기록으로 돌아가기', 'Back to current record')}</Button>}
          </div>
          <AuthorityNote ko={ko} />
          {error && <ErrorNote code={error} ko={ko} />}
        </div>
      </Card>
    );
  }

  return (
    <Card variant="elevated" className={`!overflow-hidden !p-0 ${projection?.lifecycle === 'conflict' ? '!border-[var(--risk-critical)]/60' : '!border-[var(--accent)]/30'}`}>
      <div className="border-b border-[var(--border-subtle)] bg-[var(--ai)]/45 px-5 py-5 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--accent)] shadow-sm"><FileCheck2 size={20} /></span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-[0.08em] text-[var(--accent)]">{L('판단 추적', 'Decision follow-up')}</p>
              <h2 className="mt-1 text-[18px] font-bold leading-7 text-[var(--text-primary)]">
                {recordUnavailable ? L('계정 판단 기록을 불러오지 못했어요', 'Could not load the account decision record') : statusCopy(projection?.lifecycle, ko)}
              </h2>
              <p className="mt-0.5 text-[12px] leading-5 text-[var(--text-secondary)]">{L('처음 판단부터 새 근거와 결과까지 시간순으로 이어집니다.', 'Your initial decision, later evidence, and outcome stay connected in time.')}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" disabled={loading || working} onClick={() => { setLoading(true); loadProjectSemanticEvents(project.id).then(setEvents).catch((cause) => setError(cause instanceof Error ? cause.message : 'LOAD_FAILED')).finally(() => setLoading(false)); }}><RefreshCw size={14} />{L('기록 새로고침', 'Refresh record')}</Button>
        </div>
      </div>

      {loading ? <div className="p-6 text-[13px] text-[var(--text-secondary)]">{L('판단 기록을 불러오는 중…', 'Loading decision follow-up…')}</div> : (
        <>
          <section className="grid gap-3 p-5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:p-6">
            <div className="rounded-xl bg-[var(--bg)]/70 px-4 py-4">
              <p className="text-[11px] font-bold text-[var(--text-tertiary)]">{L('처음 기록한 판단', 'Saved decision')}</p>
              <p className="mt-1.5 text-[14px] font-medium leading-6 text-[var(--text-primary)]">{projection?.statement || contract?.judgment_receipt?.human_judgment?.trim() || project.name}</p>
            </div>
            {activeReturn && <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-4 shadow-sm">
              <p className="text-[11px] font-bold text-[var(--text-tertiary)]">{L('다시 확인할 내용', 'Follow-up')}</p>
              <p className="mt-1.5 text-[13px] font-semibold leading-6 text-[var(--text-primary)]">{activeReturn.review_question}</p>
              <p className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] text-[var(--text-secondary)]"><CalendarDays size={13} className="text-[var(--accent)]" />{formatReviewDate(activeReturn.review_at, ko)}</p>
            </div>}
            {!activeReturn && contract?.check_in_at && <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-4 shadow-sm">
              <p className="text-[11px] font-bold text-[var(--text-tertiary)]">{L('다시 확인할 내용', 'Follow-up')}</p>
              <p className="mt-1.5 text-[13px] font-semibold leading-6 text-[var(--text-primary)]">{contract.judgment_receipt?.real_question?.trim() || contract.predicates?.[0]?.text || L('실제 결과를 확인합니다.', 'Review the actual outcome.')}</p>
              <p className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] text-[var(--text-secondary)]"><CalendarDays size={13} className="text-[var(--accent)]" />{formatReviewDate(contract.check_in_at, ko)}</p>
            </div>}
          </section>

          <div className="grid border-t border-[var(--border-subtle)] md:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
            <section className="border-b border-[var(--border-subtle)] p-5 md:border-r md:border-b-0 md:p-6">
              <div className="flex items-center gap-2">
                <History size={16} className="text-[var(--accent)]" />
                <h3 className="text-[13px] font-bold text-[var(--text-primary)]">{L('지금까지의 기록', 'History')}</h3>
              </div>
              <ol className="mt-4 space-y-4">
                {events.map((raw, index) => {
                  const event = raw as { event_id?: unknown; time?: { recorded_at?: unknown } };
                  return <li key={typeof event.event_id === 'string' ? event.event_id : index} className="grid grid-cols-[10px_minmax(0,1fr)] gap-3 text-[12.5px] leading-5 text-[var(--text-secondary)]">
                    <span className="mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--surface)] bg-[var(--accent)] shadow-[0_0_0_1px_var(--border)]" />
                    <div>
                    <div className="font-semibold text-[var(--text-primary)]">{eventLabel(raw, ko)}</div>
                    {eventDetail(raw) && <div className="mt-0.5 break-words">{eventDetail(raw)}</div>}
                    {typeof event.time?.recorded_at === 'string' && <time className="mt-0.5 block text-[10.5px] text-[var(--text-tertiary)]">{new Date(event.time.recorded_at).toLocaleString(ko ? 'ko-KR' : 'en-US')}</time>}
                    </div>
                  </li>;
                })}
              </ol>
            </section>

            <section className="p-5 md:p-6">
              {isTerminal ? <div className="rounded-xl bg-[var(--bg)]/70 p-4 text-[12.5px] leading-6 text-[var(--text-secondary)]"><CheckCircle2 className="mr-1.5 inline text-[var(--success)]" size={15} />{L('이 판단의 결과 확인을 마쳤습니다. 지금까지의 내용은 왼쪽 기록에서 확인할 수 있어요.', 'This outcome review is complete. The full history remains visible alongside it.')}</div> : judgment ? <div className="space-y-5">
                <div>
                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--ai)] text-[var(--accent)]"><Plus size={15} /></span>
                    <div>
                      <h3 className="text-[13px] font-bold text-[var(--text-primary)]">{L('1. 새로 알게 된 근거 추가', '1. Add new evidence')}</h3>
                      <p className="mt-0.5 text-[11.5px] leading-5 text-[var(--text-secondary)]">{L('결정 이후 확인한 사실, 수치, 사건이나 출처를 남기세요.', 'Add a fact, number, event, or source you learned after the decision.')}</p>
                    </div>
                  </div>
                  <label className="mt-3 grid gap-2 text-[12px] font-semibold text-[var(--text-secondary)]">
                    <span className="sr-only">{L('새로 확인한 근거', 'New evidence')}</span>
                    <textarea value={observation} onChange={(event) => setObservation(event.target.value)} rows={3} maxLength={4000} placeholder={L('예: 7월 고객 인터뷰 5건 중 4건에서 배송 추적 정확도를 가장 큰 문제로 꼽았습니다.', 'Example: Four of five July interviews named tracking accuracy as the main issue.')} className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-[13px] font-normal leading-6 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]/55 focus:outline-none" />
                  </label>
                  <Button className="mt-2" variant="secondary" size="sm" disabled={working || !observation.trim()} onClick={recordObservation}><Eye size={14} />{L('근거 추가', 'Add evidence')}</Button>
                </div>

                {activeReturn && !resolutionId && <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg)] text-[var(--accent)]"><CheckCircle2 size={15} /></span>
                    <div>
                      <h3 className="text-[13px] font-bold text-[var(--text-primary)]">{L('2. 확인 결과 남기기', '2. Record the outcome')}</h3>
                      <p className="mt-0.5 text-[11.5px] leading-5 text-[var(--text-secondary)]">{L('처음 적어둔 질문에 지금 답할 수 있는지 선택하세요.', 'Choose whether the original question can be answered now.')}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3">
                    <label className="grid gap-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">
                      {L('지금 어떤 상태인가요?', 'What is the current status?')}
                      <select value={resolutionKind} onChange={(event) => setResolutionKind(event.target.value as ResolutionKind)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] font-normal text-[var(--text-primary)] focus:border-[var(--accent)]/55 focus:outline-none">
                        <option value="answered">{L('근거를 바탕으로 결론을 내릴 수 있어요', 'I can reach a conclusion from the evidence')}</option>
                        <option value="indeterminate">{L('아직 판단할 근거가 부족해요', 'There is not enough evidence yet')}</option>
                        <option value="moot">{L('상황이 바뀌어 질문이 더는 유효하지 않아요', 'The situation changed and the question no longer applies')}</option>
                      </select>
                    </label>
                    <label className="grid gap-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">
                      {resolutionKind === 'answered' ? L('확인한 결과', 'What did you find?') : L('그렇게 판단한 이유', 'Why?')}
                      <textarea value={resolutionText} onChange={(event) => setResolutionText(event.target.value)} rows={3} maxLength={2000} placeholder={resolutionKind === 'answered' ? L('처음 판단과 비교해 실제로 어떻게 되었는지 적어 주세요.', 'Describe what actually happened compared with the initial decision.') : L('현재 상황을 짧게 적어 주세요.', 'Briefly describe the current situation.')} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-[13px] font-normal leading-6 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]/55 focus:outline-none" />
                    </label>
                    {resolutionKind === 'answered' && observations.length === 0 && <p className="text-[11px] leading-5 text-[var(--text-tertiary)]">{L('결론을 저장하려면 위에서 근거를 하나 이상 추가해 주세요.', 'Add at least one piece of evidence above before saving a conclusion.')}</p>}
                    <Button variant="secondary" size="sm" disabled={working || !resolutionText.trim()} onClick={recordResolution}>{resolutionKind === 'answered' ? L('결론 저장', 'Save conclusion') : L('현재 상태 저장', 'Save current status')}</Button>
                  </div>
                </div>}

                {resolutionId && <div className="rounded-xl bg-[var(--ai)]/55 p-4">
                  <h3 className="text-[13px] font-bold text-[var(--text-primary)]">{L('3. 기록 마치기', '3. Finish the review')}</h3>
                  <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">{L('확인 결과가 저장됐습니다. 더 추가할 근거가 없다면 이 기록을 마칠 수 있어요.', 'The outcome is saved. If there is no more evidence to add, you can finish this review.')}</p>
                  <Button className="mt-3" variant="accent" size="sm" disabled={working} onClick={closeRecord}><CheckCircle2 size={14} />{L('이 결과로 기록 마치기', 'Finish with this outcome')}</Button>
                </div>}

                {activeReturn && !resolutionId && <div className="flex flex-wrap items-end gap-3 rounded-xl bg-[var(--bg)]/70 px-4 py-3">
                  <label className="grid gap-1 text-[11.5px] font-semibold text-[var(--text-secondary)]">{L('아직 결과를 내리기 어렵다면 확인 날짜를 바꿀 수 있어요.', 'If it is too early to conclude, choose a new review date.')}<input type="date" value={deferDay} onChange={(event) => setDeferDay(event.target.value)} className="w-fit rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] font-normal text-[var(--text-primary)] focus:border-[var(--accent)]/55 focus:outline-none" /></label>
                  <Button variant="ghost" size="sm" disabled={working} onClick={deferReturn}><Clock3 size={14} />{L('확인 날짜 변경', 'Change review date')}</Button>
                </div>}
              </div> : <div className="rounded-xl bg-[var(--bg)]/70 p-4 text-[12.5px] leading-6 text-[var(--text-secondary)]"><AlertTriangle className="mr-1.5 inline text-[var(--warning)]" size={15} />{L('로컬 판단과 확인일은 위에 남아 있습니다. 계정 기록을 수정하려면 로그인한 뒤 새로고침해 주세요.', 'The local decision and review date remain above. Sign in and refresh to edit the account record.')}</div>}
              <AuthorityNote ko={ko} />
              {error && <ErrorNote code={error} ko={ko} />}
            </section>
          </div>
          {state.anomalies.length > 0 && <div className="mx-5 mb-5 rounded-lg border border-[var(--risk-critical)]/40 bg-[var(--risk-critical)]/8 p-3 text-[12px] leading-5 text-[var(--text-primary)] md:mx-6 md:mb-6"><AlertTriangle className="mr-1 inline text-[var(--risk-critical)]" size={14} />{L('서로 맞지 않는 기록이 있어 확인이 필요합니다. 기존 내용은 덮어쓰지 않고 그대로 보관했습니다.', 'Some entries conflict and need review. Earlier evidence has been preserved.')}</div>}
        </>
      )}
    </Card>
  );
}

function AuthorityNote({ ko }: { ko: boolean }) {
  return <p className="mt-4 text-[11px] leading-5 text-[var(--text-tertiary)]">{ko ? '입력한 판단·근거·결과를 시간순으로 보관합니다. 각 내용의 사실 여부와 최종 결론은 사용자가 직접 확인합니다.' : 'Your decision, evidence, and outcome are kept in time order. You remain responsible for checking the facts and conclusion.'}</p>;
}

function ErrorNote({ code, ko }: { code: string; ko: boolean }) {
  const known: Record<string, [string, string]> = {
    NOT_SIGNED_IN: ['계정에 저장하려면 먼저 로그인해 주세요.', 'Sign in to save this decision follow-up to your account.'],
    STATEMENT_QUESTION_AND_DATE_REQUIRED: ['지금의 판단, 확인할 질문, 날짜를 모두 입력해 주세요.', 'Enter the decision, follow-up question, and review date.'],
    ANSWER_REQUIRES_AN_OBSERVATION: ['결론을 저장하기 전에 근거를 하나 이상 추가해 주세요.', 'Add at least one piece of evidence before saving a conclusion.'],
    REASON_REQUIRED: ['현재 상태를 설명하는 내용을 입력해 주세요.', 'Describe why this is the current status.'],
    RETURN_DATE_REQUIRED: ['새 확인 날짜를 선택해 주세요.', 'Choose a new review date.'],
  };
  const pair = known[code];
  const message = pair ? pair[ko ? 0 : 1] : (ko ? `기록을 저장하지 못했습니다. 다시 시도해 주세요. (${code})` : `The record was not changed. Try again. (${code})`);
  return <p role="alert" className="mt-3 text-[12px] text-[var(--risk-critical)]">{message}</p>;
}
