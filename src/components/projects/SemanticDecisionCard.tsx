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
import type { DecisionKind, Predicate, Project } from '@/stores/types';
import { deriveDecisionKind, fold, type Resolution, type SemanticState } from '@/lib/decision-kernel';
import {
  axesWithPresentStandard,
  FOUNDATION_SETTLEMENT_OPTIONS,
  PRESENT_STANDARD_STATUSES,
  presentStandardLabel,
  presentStandardQuestion,
  type PresentStandardStatus,
} from '@/lib/foundation-settlement';
import {
  loadProjectSemanticEvents,
  SemanticLedgerClientError,
  submitProjectSemanticCommand,
} from '@/lib/semantic-web-client';
import { semanticProjection, type SemanticWebCommand } from '@/lib/semantic-web';
import { generateId } from '@/lib/uuid';

const KIND_CHOICES: Array<{ kind: DecisionKind; ko: string; en: string }> = [
  { kind: 'prediction', ko: '현실이 어떻게 될지 남긴 예상', en: 'A prediction about what will happen' },
  { kind: 'commitment', ko: '내가 무엇을 하겠다는 약속', en: 'A commitment about what I will do' },
  { kind: 'declaration', ko: '지금 따르려는 기준', en: 'A standard I choose to follow' },
  { kind: 'witness', ko: '다시 묻지 않고 원문만 보관', en: 'Keep the original without a future return' },
];

function dayFromIso(iso?: string): string {
  const date = iso ? new Date(iso) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function isoFromDay(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const value = `${day}T00:00:00.000Z`;
  return Number.isNaN(new Date(value).getTime()) ? null : value;
}

function formatReviewDate(value: string | undefined, ko: boolean): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(ko ? 'ko-KR' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function isAiPredicate(predicate: Predicate | undefined): boolean {
  return predicate?.authored === 'ai_surfaced'
    || predicate?.attribution?.wording_source === 'ai_surfaced';
}

function eventLabel(raw: unknown, ko: boolean): string {
  const event = raw as { event?: unknown };
  const labels: Record<string, [string, string]> = {
    proposal_created: ['Argus 제안', 'Argus proposal'],
    judgment_sealed: ['처음 문장 저장', 'Initial statement saved'],
    return_promised: ['다시 볼 시점 설정', 'Return date set'],
    observation_recorded: ['새 근거 추가', 'Evidence added'],
    resolution_asserted: ['돌아온 답 저장', 'Return recorded'],
    judgment_closed: ['기록 마침', 'Record closed'],
    return_deferred: ['확인 날짜 변경', 'Return date changed'],
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
    sealed: ['기록 완료 · 다시 볼 시점을 기다리는 중', 'Saved · waiting for the return date'],
    due: ['지금 돌아온 답을 남길 수 있어요', 'Ready to record what changed'],
    resolved_answered: ['돌아온 답을 기록했습니다', 'Return recorded'],
    resolved_indeterminate: ['근거가 부족한 상태로 기록했습니다', 'Recorded with insufficient evidence'],
    resolved_moot: ['질문이 더는 유효하지 않다고 기록했습니다', 'Recorded because the question no longer applies'],
    conflict: ['기록 확인이 필요합니다', 'Record needs review'],
  };
  const pair = lifecycle ? copy[lifecycle] : undefined;
  return pair ? pair[ko ? 0 : 1] : (ko ? '돌아올 기록을 준비하는 중' : 'Preparing the return record');
}

/**
 * Account-backed semantic record. The screen keeps proposal, human seal,
 * observations, resolution, and closure distinct while presenting one short
 * user journey instead of the kernel's internal vocabulary.
 */
export function SemanticDecisionCard({ project, onCancel }: { project: Project; onCancel?: () => void }) {
  const ko = useLocale() === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);
  const updateDecisionContract = useProjectStore((state) => state.updateDecisionContract);
  const contract = project.decision_contract;
  const judgmentId = contract?.semantic_judgment_id;
  const initialPredicate = contract?.predicates?.find((predicate) => predicate.source === 'user_lean')
    ?? contract?.predicates?.[0];
  const initialAiPredicate = isAiPredicate(initialPredicate) ? initialPredicate : undefined;
  const initialStatement = contract?.judgment_receipt?.human_judgment?.trim()
    || initialPredicate?.text?.trim()
    || '';
  const initialKind = contract?.kind
    ?? deriveDecisionKind({ statement: initialStatement, has_return_handle: true }).kind;

  const [events, setEvents] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(!!judgmentId);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statement, setStatement] = useState(initialStatement);
  const [question, setQuestion] = useState(
    contract?.review_condition?.trim()
    || contract?.judgment_receipt?.real_question?.trim()
    || '',
  );
  const [selectedKind, setSelectedKind] = useState<DecisionKind>(initialKind);
  const [keepsAiOrigin, setKeepsAiOrigin] = useState(Boolean(initialAiPredicate));
  const [reviewDay, setReviewDay] = useState(dayFromIso(contract?.check_in_at));
  const [observation, setObservation] = useState('');
  const [deferDay, setDeferDay] = useState(dayFromIso(contract?.check_in_at));
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string | null>(null);

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
  const resolutionId = judgment?.resolution?.id;
  const currentKind: DecisionKind = judgment?.kind ?? selectedKind;
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
    const cleanStatement = statement.trim();
    const cleanQuestion = question.trim();
    const reviewAt = selectedKind === 'witness' ? null : isoFromDay(reviewDay);
    if (!cleanStatement || (selectedKind !== 'witness' && (!cleanQuestion || !reviewAt))) {
      setError(selectedKind === 'witness' ? 'STATEMENT_REQUIRED' : 'STATEMENT_QUESTION_AND_DATE_REQUIRED');
      return;
    }
    const nextJudgmentId = `web-judgment:${generateId()}`;
    const recordedAt = new Date().toISOString();
    const knownOrigin = contract?.origin_utterance?.trim();
    const userOrigin = knownOrigin
      || (!initialAiPredicate
        || !keepsAiOrigin
        || cleanStatement !== initialAiPredicate.text.trim()
        ? cleanStatement
        : undefined);
    const command: SemanticWebCommand = {
      kind: 'seal',
      command_id: generateId(),
      judgment_id: nextJudgmentId,
      statement: cleanStatement,
      decision_kind: selectedKind,
      kind_evidence: {
        source: 'elicitation_answer',
        rule: 'explicit_kind_choice',
        question: L('이 문장은 나중에 무엇을 확인하기 위한 기록인가요?', 'What should this statement help you revisit?'),
        answer: selectedKind,
        recorded_at: recordedAt,
      },
      ...(userOrigin ? { origin_utterance: userOrigin } : {}),
      review_condition_status: selectedKind === 'witness'
        ? 'not_asked'
        : 'answered',
      ...(selectedKind === 'witness' ? {} : { review_condition: cleanQuestion }),
      ...(selectedKind === 'witness' ? {} : {
        return_contract_id: `${nextJudgmentId}:return`,
        review_at: reviewAt!,
        review_question: cleanQuestion,
      }),
      ...(initialAiPredicate && keepsAiOrigin ? {
        proposal_id: `web-contract:${initialAiPredicate.id}`,
        proposal_text: initialAiPredicate.text,
        source_ref: `project:${project.id}:decision-contract:${contract?.id ?? 'local'}`,
        adoption_mode: cleanStatement === initialAiPredicate.text.trim() ? 'wording' : 'basis',
      } : {}),
    };
    void submit(command, () => {
      if (!contract) return;
      updateDecisionContract(project.id, (latest) =>
        latest ? { ...latest, semantic_judgment_id: nextJudgmentId } : latest);
    });
  }

  function recordObservation() {
    const text = observation.trim();
    if (!text) return;
    void submit({
      kind: 'observe',
      command_id: generateId(),
      observation_id: `web-observation:${generateId()}`,
      text,
    }, () => setObservation(''));
  }

  function deferReturn() {
    const reviewAt = isoFromDay(deferDay);
    if (!activeReturn || !reviewAt) {
      setError('RETURN_DATE_REQUIRED');
      return;
    }
    void submit({
      kind: 'defer',
      command_id: generateId(),
      return_contract_id: activeReturn.id,
      review_at: reviewAt,
    });
  }

  function recordResolution(status: PresentStandardStatus) {
    if (!judgmentId || !activeReturn || currentKind === 'witness') return;
    const selected = FOUNDATION_SETTLEMENT_OPTIONS[currentKind]
      .find((option) => option.id === selectedOutcomeId);
    if (!selected) return;
    const responseText = ko ? selected.ko : selected.en;
    const presentResponse = presentStandardLabel(currentKind, status, ko ? 'ko' : 'en');
    const axes = axesWithPresentStandard(selected.axes, status);
    const observationId = `web-observation:${generateId()}`;
    const present_standard = { status, response_text: presentResponse };
    const resolution: Resolution = axes.question === 'moot'
      ? {
          kind: 'moot',
          reason: responseText,
          ...(axes.reality ? { criterion_result: axes.reality } : {}),
          ...(axes.commitment ? { commitment_result: axes.commitment } : {}),
          question_validity: 'moot',
          present_standard,
          evidence_refs: [observationId],
        }
      : axes.question === 'indeterminate'
        ? {
            kind: 'indeterminate',
            reason: responseText,
            ...(axes.reality ? { criterion_result: axes.reality } : {}),
            ...(axes.commitment ? { commitment_result: axes.commitment } : {}),
            question_validity: 'indeterminate',
            present_standard,
            evidence_refs: [observationId],
          }
        : {
            kind: 'answered',
            answer_summary: responseText,
            ...(axes.reality ? { criterion_result: axes.reality } : {}),
            ...(axes.commitment ? { commitment_result: axes.commitment } : {}),
            question_validity: axes.question,
            present_standard,
            evidence_refs: [observationId],
          };
    void submit({
      kind: 'observe_and_resolve',
      command_id: generateId(),
      observation_id: observationId,
      observation_text: responseText,
      observation_source_kind: 'user_report',
      resolution_id: `web-resolution:${generateId()}`,
      judgment_id: judgmentId,
      return_contract_id: activeReturn.id,
      resolution,
    }, () => setSelectedOutcomeId(null));
  }

  function closeRecord() {
    if (!judgmentId || !resolutionId) return;
    void submit({
      kind: 'close',
      command_id: generateId(),
      judgment_id: judgmentId,
      resolution_id: resolutionId,
    });
  }

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setEvents(await loadProjectSemanticEvents(project.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'LOAD_FAILED');
    } finally {
      setLoading(false);
    }
  }

  if (!judgmentId) {
    return (
      <Card variant="elevated" className="!overflow-hidden !border-[var(--accent)]/30 !p-0">
        <header className="border-b border-[var(--border-subtle)] bg-[var(--ai)]/55 px-5 py-5 md:px-6">
          <div className="flex items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--accent)] shadow-sm">
              <BookOpen size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-[0.08em] text-[var(--accent)]">
                {L('돌아올 기록', 'Return record')}
              </p>
              <h2 className="mt-1 text-[18px] font-bold leading-7 text-[var(--text-primary)]">
                {L('지금의 문장을 남기고, 현실이 답할 때 다시 보세요', 'Keep today’s statement and return when reality can answer')}
              </h2>
              <p className="mt-1 text-[13px] leading-6 text-[var(--text-secondary)]">
                {L('이후에 알게 된 근거와 돌아온 답을 같은 기록에 시간 순서로 이어 둡니다.', 'Later evidence and the answer you return with stay connected in one timeline.')}
              </p>
            </div>
          </div>
        </header>

        <div className="p-5 md:p-6">
          <label className="grid gap-1.5 text-[12px] font-bold text-[var(--text-primary)]">
            {L('지금 남길 문장', 'Statement to keep')}
            <span className="text-[11px] font-normal leading-5 text-[var(--text-tertiary)]">
              {L('나중의 내가 비교할 수 있도록 지금 생각을 내 말로 확인하세요.', 'Confirm the wording in your own voice so your future self can compare it.')}
            </span>
            <textarea
              value={statement}
              onChange={(event) => setStatement(event.target.value)}
              maxLength={4000}
              rows={3}
              className="mt-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-3 text-[13px] font-normal leading-6 text-[var(--text-primary)] focus:border-[var(--accent)]/55 focus:outline-none"
            />
          </label>

          {initialAiPredicate && (
            <label className="mt-3 flex items-start gap-2.5 rounded-xl bg-[var(--ai)]/45 px-3.5 py-3 text-[11.5px] leading-5 text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={keepsAiOrigin}
                onChange={(event) => setKeepsAiOrigin(event.target.checked)}
                className="mt-0.5"
              />
              <span>
                {L('이 문장은 Argus 제안에서 시작했습니다. 출처는 남지만, 확정하는 사람은 나입니다.', 'This statement started from an Argus proposal. Its source remains visible, while the final seal is yours.')}
              </span>
            </label>
          )}

          <fieldset className="mt-5">
            <legend className="text-[12px] font-bold text-[var(--text-primary)]">
              {L('나중에 무엇을 확인할 기록인가요?', 'What should this record help you revisit?')}
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {KIND_CHOICES.map((choice) => (
                <button
                  key={choice.kind}
                  type="button"
                  onClick={() => setSelectedKind(choice.kind)}
                  aria-pressed={selectedKind === choice.kind}
                  className={`rounded-xl border px-3.5 py-3 text-left text-[12.5px] font-medium leading-5 transition-colors ${
                    selectedKind === choice.kind
                      ? 'border-[var(--accent)]/60 bg-[var(--ai)] text-[var(--text-primary)]'
                      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--accent)]/35'
                  }`}
                >
                  {ko ? choice.ko : choice.en}
                </button>
              ))}
            </div>
          </fieldset>

          {selectedKind !== 'witness' && (
            <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
              <label className="grid gap-1.5 text-[12px] font-bold text-[var(--text-primary)]">
                {L('돌아와서 확인할 질문', 'Question to revisit')}
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  maxLength={4000}
                  rows={2}
                  placeholder={L('현실이 나중에 답할 수 있는 한 가지 질문', 'One question reality can answer later')}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-3 text-[13px] font-normal leading-6 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]/55 focus:outline-none"
                />
              </label>
              <label className="grid content-start gap-1.5 text-[12px] font-bold text-[var(--text-primary)]">
                {L('다시 볼 날짜', 'Return date')}
                <input
                  type="date"
                  value={reviewDay}
                  onChange={(event) => setReviewDay(event.target.value)}
                  className="h-[50px] rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] font-normal text-[var(--text-primary)] focus:border-[var(--accent)]/55 focus:outline-none"
                />
              </label>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="accent" size="sm" disabled={working} onClick={createRecord}>
              <LockKeyhole size={14} />
              {selectedKind === 'witness'
                ? L('이 원문 그대로 보관', 'Keep exactly as written')
                : L('이 기록 시작', 'Start this record')}
            </Button>
            {onCancel && (
              <Button variant="ghost" size="sm" onClick={onCancel}>
                <ArrowLeft size={14} />
                {L('기존 기록으로 돌아가기', 'Back to the current record')}
              </Button>
            )}
          </div>
          <AuthorityNote ko={ko} />
          {error && <ErrorNote code={error} ko={ko} />}
        </div>
      </Card>
    );
  }

  return (
    <Card
      variant="elevated"
      className={`!overflow-hidden !p-0 ${
        projection?.lifecycle === 'conflict'
          ? '!border-[var(--risk-critical)]/60'
          : '!border-[var(--accent)]/30'
      }`}
    >
      <header className="border-b border-[var(--border-subtle)] bg-[var(--ai)]/45 px-5 py-5 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--accent)] shadow-sm">
              <FileCheck2 size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-[0.08em] text-[var(--accent)]">
                {L('돌아올 기록', 'Return record')}
              </p>
              <h2 className="mt-1 text-[18px] font-bold leading-7 text-[var(--text-primary)]">
                {recordUnavailable
                  ? L('계정 기록을 불러오지 못했어요', 'Could not load the account record')
                  : statusCopy(projection?.lifecycle, ko)}
              </h2>
              <p className="mt-0.5 text-[12px] leading-5 text-[var(--text-secondary)]">
                {L('처음 문장, 이후 근거, 돌아온 답을 시간 순서로 이어 둡니다.', 'The initial statement, later evidence, and return stay connected in time.')}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" disabled={loading || working} onClick={() => void refresh()}>
            <RefreshCw size={14} />
            {L('새로고침', 'Refresh')}
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="p-6 text-[13px] text-[var(--text-secondary)]">
          {L('기록을 불러오는 중…', 'Loading the record…')}
        </div>
      ) : (
        <>
          <section className="grid gap-3 p-5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:p-6">
            <div className="rounded-xl bg-[var(--bg)]/70 px-4 py-4">
              <p className="text-[11px] font-bold text-[var(--text-tertiary)]">
                {L('처음 남긴 문장', 'Initial statement')}
              </p>
              <p className="mt-1.5 text-[14px] font-medium leading-6 text-[var(--text-primary)]">
                {projection?.statement || judgment?.statement || contract?.judgment_receipt?.human_judgment?.trim()}
              </p>
            </div>
            {activeReturn && (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-4 shadow-sm">
                <p className="text-[11px] font-bold text-[var(--text-tertiary)]">
                  {L('돌아와서 확인할 질문', 'Question to revisit')}
                </p>
                <p className="mt-1.5 text-[13px] font-semibold leading-6 text-[var(--text-primary)]">
                  {activeReturn.review_question}
                </p>
                <p className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] text-[var(--text-secondary)]">
                  <CalendarDays size={13} className="text-[var(--accent)]" />
                  {formatReviewDate(activeReturn.review_at, ko)}
                </p>
              </div>
            )}
          </section>

          <div className="grid border-t border-[var(--border-subtle)] md:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
            <section className="border-b border-[var(--border-subtle)] p-5 md:border-r md:border-b-0 md:p-6">
              <div className="flex items-center gap-2">
                <History size={16} className="text-[var(--accent)]" />
                <h3 className="text-[13px] font-bold text-[var(--text-primary)]">
                  {L('지금까지의 기록', 'Timeline')}
                </h3>
              </div>
              <ol className="mt-4 space-y-4">
                {events.map((raw, index) => {
                  const event = raw as { event_id?: unknown; time?: { recorded_at?: unknown } };
                  return (
                    <li
                      key={typeof event.event_id === 'string' ? event.event_id : index}
                      className="grid grid-cols-[10px_minmax(0,1fr)] gap-3 text-[12.5px] leading-5 text-[var(--text-secondary)]"
                    >
                      <span className="mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--surface)] bg-[var(--accent)] shadow-[0_0_0_1px_var(--border)]" />
                      <div>
                        <div className="font-semibold text-[var(--text-primary)]">{eventLabel(raw, ko)}</div>
                        {eventDetail(raw) && <div className="mt-0.5 break-words">{eventDetail(raw)}</div>}
                        {typeof event.time?.recorded_at === 'string' && (
                          <time className="mt-0.5 block text-[10.5px] text-[var(--text-tertiary)]">
                            {new Date(event.time.recorded_at).toLocaleString(ko ? 'ko-KR' : 'en-US')}
                          </time>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className="p-5 md:p-6">
              {judgment?.closed ? (
                <div className="rounded-xl bg-[var(--bg)]/70 p-4 text-[12.5px] leading-6 text-[var(--text-secondary)]">
                  <CheckCircle2 className="mr-1.5 inline text-[var(--success)]" size={15} />
                  {L('이번 확인을 마쳤습니다. 처음 문장과 돌아온 답은 옆 기록에 그대로 남아 있어요.', 'This return is complete. The initial statement and your answer remain in the timeline.')}
                </div>
              ) : judgment ? (
                <div className="space-y-5">
                  {currentKind !== 'witness' && (
                    <div>
                      <div className="flex items-start gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--ai)] text-[var(--accent)]">
                          <Plus size={15} />
                        </span>
                        <div>
                          <h3 className="text-[13px] font-bold text-[var(--text-primary)]">
                            {L('새로 알게 된 근거', 'New evidence')}
                          </h3>
                          <p className="mt-0.5 text-[11.5px] leading-5 text-[var(--text-secondary)]">
                            {L('결정 뒤 확인한 사실, 수치, 사건이나 출처만 적으세요. 해석은 섞지 않아도 됩니다.', 'Add a fact, number, event, or source learned after the decision.')}
                          </p>
                        </div>
                      </div>
                      <textarea
                        value={observation}
                        onChange={(event) => setObservation(event.target.value)}
                        rows={3}
                        maxLength={4000}
                        placeholder={L('예: 7월 고객 인터뷰 5건 중 4건이 같은 문제를 짚었다.', 'Example: Four of five July interviews named the same issue.')}
                        className="mt-3 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-[13px] font-normal leading-6 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]/55 focus:outline-none"
                      />
                      <Button className="mt-2" variant="secondary" size="sm" disabled={working || !observation.trim()} onClick={recordObservation}>
                        <Eye size={14} />
                        {L('근거 추가', 'Add evidence')}
                      </Button>
                    </div>
                  )}

                  {currentKind === 'witness' ? (
                    <div className="rounded-xl bg-[var(--bg)]/70 p-4 text-[12.5px] leading-6 text-[var(--text-secondary)]">
                      {L('이 기록은 다시 묻지 않고 원문만 보관하기로 한 문장입니다.', 'This statement was kept without a future return.')}
                    </div>
                  ) : activeReturn && !resolutionId ? (
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-sm">
                      {selectedOutcomeId ? (
                        <>
                          <p className="text-[12px] font-semibold text-[var(--text-secondary)]">
                            {presentStandardQuestion(currentKind, ko ? 'ko' : 'en')}
                          </p>
                          <p className="mt-1 text-[11px] leading-5 text-[var(--text-tertiary)]">
                            {L('한 가지만 더 고르면 이번 답이 기록됩니다.', 'Choose one more answer to save this return.')}
                          </p>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {PRESENT_STANDARD_STATUSES.map((status: PresentStandardStatus) => (
                              <button
                                key={status}
                                type="button"
                                disabled={working}
                                onClick={() => recordResolution(status)}
                                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-left text-[12.5px] font-medium leading-5 text-[var(--text-primary)] transition-colors hover:border-[var(--accent)]/50 disabled:opacity-50"
                              >
                                {presentStandardLabel(currentKind, status, ko ? 'ko' : 'en')}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedOutcomeId(null)}
                            className="mt-3 text-[11.5px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                          >
                            {L('앞으로 돌아가기', 'Back')}
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="text-[12px] font-semibold text-[var(--text-secondary)]">
                            {currentKind === 'prediction'
                              ? L('실제로는 어떻게 되었나요?', 'What actually happened?')
                              : currentKind === 'commitment'
                                ? L('그 약속은 지금 어떻게 되었나요?', 'What happened to that commitment?')
                                : L('그 기준을 지금은 어떻게 보고 있나요?', 'How do you see that standard now?')}
                          </p>
                          <div className="mt-3 grid gap-2">
                            {FOUNDATION_SETTLEMENT_OPTIONS[currentKind].map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                disabled={working}
                                onClick={() => setSelectedOutcomeId(option.id)}
                                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-left text-[12.5px] font-medium leading-5 text-[var(--text-primary)] transition-colors hover:border-[var(--accent)]/50 disabled:opacity-50"
                              >
                                {ko ? option.ko : option.en}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ) : null}

                  {resolutionId && (
                    <div className="rounded-xl bg-[var(--ai)]/55 p-4">
                      <h3 className="text-[13px] font-bold text-[var(--text-primary)]">
                        {L('돌아온 답을 확인했어요', 'Your return is saved')}
                      </h3>
                      <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
                        {L('더 보탤 근거가 없다면 이 확인을 마치세요. 저장한 답은 고쳐 쓰지 않고 기록에 남습니다.', 'If there is no more evidence to add, finish this return. The saved answer remains in the timeline.')}
                      </p>
                      <Button className="mt-3" variant="accent" size="sm" disabled={working} onClick={closeRecord}>
                        <CheckCircle2 size={14} />
                        {L('이번 확인 마치기', 'Finish this return')}
                      </Button>
                    </div>
                  )}

                  {activeReturn && !resolutionId && (
                    <div className="flex flex-wrap items-end gap-3 rounded-xl bg-[var(--bg)]/70 px-4 py-3">
                      <label className="grid gap-1 text-[11.5px] font-semibold text-[var(--text-secondary)]">
                        {L('아직 답하기 이르다면 다시 볼 날짜를 바꾸세요.', 'If it is too early to answer, choose a new return date.')}
                        <input
                          type="date"
                          value={deferDay}
                          onChange={(event) => setDeferDay(event.target.value)}
                          className="w-fit rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] font-normal text-[var(--text-primary)] focus:border-[var(--accent)]/55 focus:outline-none"
                        />
                      </label>
                      <Button variant="ghost" size="sm" disabled={working} onClick={deferReturn}>
                        <Clock3 size={14} />
                        {L('날짜 변경', 'Change date')}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl bg-[var(--bg)]/70 p-4 text-[12.5px] leading-6 text-[var(--text-secondary)]">
                  <AlertTriangle className="mr-1.5 inline text-[var(--warning)]" size={15} />
                  {L('로컬 기록은 그대로 남아 있습니다. 계정 기록을 수정하려면 로그인 상태를 확인하고 새로고침해 주세요.', 'Your local record is intact. Check your sign-in and refresh before editing the account record.')}
                </div>
              )}
              <AuthorityNote ko={ko} />
              {error && <ErrorNote code={error} ko={ko} />}
            </section>
          </div>

          {state.anomalies.length > 0 && (
            <div className="mx-5 mb-5 rounded-lg border border-[var(--risk-critical)]/40 bg-[var(--risk-critical)]/8 p-3 text-[12px] leading-5 text-[var(--text-primary)] md:mx-6 md:mb-6">
              <AlertTriangle className="mr-1 inline text-[var(--risk-critical)]" size={14} />
              {L('서로 맞지 않는 기록이 있어 확인이 필요합니다. 앞선 내용은 지우지 않고 그대로 보관했습니다.', 'Some entries conflict and need review. Earlier entries remain intact.')}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function AuthorityNote({ ko }: { ko: boolean }) {
  return (
    <p className="mt-4 text-[11px] leading-5 text-[var(--text-tertiary)]">
      {ko
        ? 'Argus의 제안과 사용자가 확정한 문장을 구분해 남깁니다. 근거와 돌아온 답은 사용자가 직접 확인합니다.'
        : 'Argus proposals remain distinct from statements you seal. You verify the evidence and the answer you return with.'}
    </p>
  );
}

function ErrorNote({ code, ko }: { code: string; ko: boolean }) {
  const known: Record<string, [string, string]> = {
    NOT_SIGNED_IN: ['계정에 저장하려면 먼저 로그인해 주세요.', 'Sign in to save this record to your account.'],
    STATEMENT_REQUIRED: ['보관할 문장을 적어 주세요.', 'Enter the statement you want to keep.'],
    STATEMENT_QUESTION_AND_DATE_REQUIRED: ['문장, 확인할 질문, 다시 볼 날짜를 모두 적어 주세요.', 'Enter the statement, return question, and return date.'],
    RETURN_DATE_REQUIRED: ['새로 확인할 날짜를 골라 주세요.', 'Choose a new return date.'],
    PRESENT_STANDARD_REQUIRED: ['지금의 기준에 대한 답을 골라 주세요.', 'Choose how your present standard relates to the original.'],
    PROPOSAL_LINEAGE_INCOMPLETE: ['Argus 제안의 출처를 온전히 기록하지 못했습니다.', 'The Argus proposal source could not be recorded completely.'],
  };
  const pair = known[code];
  const message = pair
    ? pair[ko ? 0 : 1]
    : ko
      ? `기록을 바꾸지 못했습니다. 다시 시도해 주세요. (${code})`
      : `The record was not changed. Try again. (${code})`;
  return <p role="alert" className="mt-3 text-[12px] text-[var(--risk-critical)]">{message}</p>;
}
