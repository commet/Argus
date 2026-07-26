'use client';

import { useState } from 'react';
import { BookOpen, CalendarClock, Pencil } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { useProjectStore } from '@/stores/useProjectStore';
import type { DecisionContract, DecisionKind, Project } from '@/stores/types';
import {
  correctContractKind,
  decisionKind,
  reviseContractStatement,
} from '@/lib/decision-contract';
import { Card } from '@/components/ui/Card';

const KIND_LABELS: Record<DecisionKind, { ko: string; en: string }> = {
  prediction: { ko: '현실에서 확인할 생각', en: 'Something reality can answer' },
  commitment: { ko: '내가 지킬 약속', en: 'Something I mean to do' },
  declaration: { ko: '내가 세운 기준', en: 'A standard I chose' },
  witness: { ko: '그대로 남길 기록', en: 'Something to preserve' },
};

function formatDate(value: string | undefined, locale: 'ko' | 'en'): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', { dateStyle: 'medium' }).format(date);
}

function sealedStatement(contract: DecisionContract, project: Project): string {
  return contract.judgment_receipt?.human_judgment?.trim()
    || contract.predicates.find((predicate) => predicate.source === 'user_lean')?.text
    || contract.predicates[0]?.text
    || contract.origin_utterance?.trim()
    || project.name;
}

function currentStatement(contract: DecisionContract, project: Project): string {
  return contract.statement_revisions?.at(-1)?.to_statement
    || sealedStatement(contract, project);
}

export function FoundationDecisionRecordCard({
  project,
  onReturn,
}: {
  project: Project;
  onReturn?: () => void;
}) {
  const locale = useLocale();
  const ko = locale === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);
  const updateProject = useProjectStore((state) => state.updateProject);
  const contract = project.decision_contract!;
  const kind = decisionKind(contract);
  const returns = contract.settlements ?? [];
  const latest = returns.at(-1);
  const sourceStatement = sealedStatement(contract, project);
  const statement = currentStatement(contract, project);
  const [editing, setEditing] = useState(false);
  const [draftStatement, setDraftStatement] = useState(statement);
  const [draftKind, setDraftKind] = useState<DecisionKind>(kind);
  const [reason, setReason] = useState('');
  const [returnDate, setReturnDate] = useState(contract.check_in_at?.slice(0, 10) ?? '');
  const needsReturnDate = draftKind !== 'witness' && !contract.check_in_at && !returnDate;

  const saveRevision = () => {
    if (!draftStatement.trim() || needsReturnDate) return;
    const now = Date.now();
    let next = reviseContractStatement(contract, draftStatement, reason, now);
    next = correctContractKind(next, draftKind, now);
    if (draftKind !== 'witness' && returnDate) {
      const parsed = new Date(`${returnDate}T09:00:00`);
      if (!Number.isNaN(parsed.getTime())) next = { ...next, check_in_at: parsed.toISOString() };
    }
    updateProject(project.id, { decision_contract: next });
    setEditing(false);
    setReason('');
  };

  return (
    <Card className="border-[var(--border)]">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--bg)] text-[var(--text-secondary)]">
          {kind === 'witness' ? <BookOpen size={17} /> : <CalendarClock size={17} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-bold leading-6 text-[var(--text-primary)]">
              {latest
                ? L('그때의 문장과 지금의 답', 'Then, with your answer now')
                : kind === 'witness'
                  ? L('남겨 둔 기록', 'Saved record')
                  : L('다시 볼 판단', 'A judgment to revisit')}
            </h3>
            <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--text-tertiary)]">
              {ko ? KIND_LABELS[kind].ko : KIND_LABELS[kind].en}
            </span>
            {contract.adoption_lineage?.length ? (
              <span className="text-[10.5px] text-[var(--text-tertiary)]">
                {L('Argus 제안을 내가 채택', 'Argus suggestion adopted by me')}
              </span>
            ) : null}
          </div>

          {editing ? (
            <div className="mt-4 space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-secondary)]">
                  {L('지금 더 정확하다고 생각하는 문장', 'A more accurate sentence now')}
                </label>
                <textarea
                  value={draftStatement}
                  onChange={(event) => setDraftStatement(event.target.value)}
                  rows={3}
                  className="mt-1.5 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-[13px] leading-6 text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/60"
                />
              </div>

              <div>
                <p className="text-[11px] font-semibold text-[var(--text-secondary)]">
                  {L('이 문장은 무엇에 가까운가요?', 'What kind of record is this?')}
                </p>
                <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                  {(Object.keys(KIND_LABELS) as DecisionKind[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDraftKind(value)}
                      aria-pressed={draftKind === value}
                      className={`rounded-lg border px-3 py-2 text-left text-[11.5px] transition-colors ${
                        draftKind === value
                          ? 'border-[var(--accent)]/60 bg-[var(--ai)] text-[var(--accent)]'
                          : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)]/40'
                      }`}
                    >
                      {ko ? KIND_LABELS[value].ko : KIND_LABELS[value].en}
                    </button>
                  ))}
                </div>
              </div>

              {draftKind !== 'witness' && !contract.check_in_at && (
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  {L('다시 볼 날짜', 'Fallback date')}
                  <input
                    type="date"
                    value={returnDate}
                    onChange={(event) => setReturnDate(event.target.value)}
                    className="mt-1.5 block w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-[12.5px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/60"
                  />
                </label>
              )}

              <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                {L('바꾼 이유 · 선택', 'Why it changed · optional')}
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="mt-1.5 block w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-[12.5px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/60"
                />
              </label>

              <p className="text-[11px] leading-5 text-[var(--text-tertiary)]">
                {L(
                  '처음 문장은 지워지지 않고, 이번 수정이 새 시점으로 이어집니다.',
                  'The original is preserved; this revision is appended at a new point in time.',
                )}
              </p>
              {needsReturnDate && (
                <p className="text-[11px] text-[var(--danger)]">
                  {L('다시 볼 기록이라면 날짜가 하나 필요해요.', 'A record to revisit needs a fallback date.')}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveRevision}
                  disabled={!draftStatement.trim() || needsReturnDate}
                  className="rounded-xl bg-[var(--text-primary)] px-4 py-2.5 text-[12px] font-semibold text-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {L('수정 기록 남기기', 'Append revision')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraftStatement(statement);
                    setDraftKind(kind);
                    setReason('');
                    setEditing(false);
                  }}
                  className="rounded-xl px-3 py-2.5 text-[12px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                >
                  {L('취소', 'Cancel')}
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="mt-3 text-[14px] leading-6 text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-voice, serif)' }}>
                &ldquo;{statement}&rdquo;
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--text-tertiary)]">
                <span>{formatDate(contract.created_at, locale)}</span>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1 font-medium hover:text-[var(--accent)]"
                >
                  <Pencil size={11} />
                  {L('문장·종류 수정', 'Revise')}
                </button>
              </div>
            </>
          )}

          {!editing && contract.review_condition && !latest && (
            <p className="mt-3 rounded-xl bg-[var(--bg)] px-3 py-2.5 text-[12.5px] leading-5 text-[var(--text-secondary)]">
              {L('다시 볼 조건', 'Reason to return')}: {contract.review_condition}
            </p>
          )}
          {!editing && !latest && contract.return_event && kind !== 'witness' && (
            <p className="mt-2 text-[12px] leading-5 text-[var(--text-secondary)]">
              {L('이 일이 생기면 먼저 돌아와요', 'Return sooner if this happens')}: {contract.return_event}
            </p>
          )}
          {!editing && !latest && contract.check_in_at && kind !== 'witness' && (
            <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
              {L('늦어도', 'Fallback date')}: {formatDate(contract.check_in_at, locale)}
            </p>
          )}

          {!editing && latest && (
            <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
              <p className="text-[10.5px] font-semibold tracking-[0.08em] text-[var(--text-tertiary)]">
                {formatDate(latest.recorded_at, locale)} · {L('나의 답', 'My answer')}
              </p>
              <p className="mt-1.5 text-[13px] leading-6 text-[var(--text-primary)]">{latest.response_text}</p>
              {latest.present_standard && (
                <p className="mt-1 text-[11.5px] leading-5 text-[var(--text-secondary)]">
                  {latest.present_standard.status === 'same'
                    ? L('그때의 기준은 지금도 같아요.', 'The standard is unchanged.')
                    : latest.present_standard.status === 'changed'
                      ? L('지금의 기준은 달라졌어요.', 'The standard has changed.')
                      : latest.present_standard.status === 'withdrawn'
                        ? L('그때의 기준은 거뒀어요.', 'The earlier standard was withdrawn.')
                        : L('현재 기준은 답하지 않았어요.', 'The present standard was left unanswered.')}
                </p>
              )}
            </div>
          )}

          {!editing && returns.length > 1 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-[11.5px] font-medium text-[var(--text-tertiary)]">
                {L(`이전 답 ${returns.length - 1}개`, `${returns.length - 1} earlier return${returns.length === 2 ? '' : 's'}`)}
              </summary>
              <div className="mt-2 space-y-2">
                {returns.slice(0, -1).reverse().map((item) => (
                  <div key={`${item.recorded_at}:${item.option_id}`} className="rounded-lg bg-[var(--bg)] px-3 py-2">
                    <p className="text-[10.5px] text-[var(--text-tertiary)]">{formatDate(item.recorded_at, locale)}</p>
                    <p className="mt-0.5 text-[12px] leading-5 text-[var(--text-secondary)]">{item.response_text}</p>
                  </div>
                ))}
              </div>
            </details>
          )}

          {!editing && (
            <details className="mt-3">
              <summary className="cursor-pointer text-[11.5px] font-medium text-[var(--text-tertiary)]">
                {L('처음 문장과 수정 이력', 'Original and revision history')}
              </summary>
              <div className="mt-2 space-y-2 rounded-xl bg-[var(--bg)] px-3 py-3 text-[11.5px] leading-5 text-[var(--text-secondary)]">
                <p>
                  <span className="font-semibold">{L('처음 확정한 문장', 'First confirmed wording')}:</span>{' '}
                  {sourceStatement}
                </p>
                {contract.origin_utterance?.trim() && contract.origin_utterance.trim() !== sourceStatement && (
                  <p>
                    <span className="font-semibold">{L('구조화 전 첫 발화', 'First utterance before structuring')}:</span>{' '}
                    {contract.origin_utterance.trim()}
                  </p>
                )}
                {(contract.statement_revisions ?? []).map((revision) => (
                  <p key={revision.recorded_at}>
                    <span className="font-semibold">{formatDate(revision.recorded_at, locale)}:</span>{' '}
                    {revision.to_statement}
                    {revision.reason ? ` · ${revision.reason}` : ''}
                  </p>
                ))}
                {(contract.kind_corrections ?? []).map((correction) => (
                  <p key={correction.corrected_at}>
                    <span className="font-semibold">{formatDate(correction.corrected_at, locale)}:</span>{' '}
                    {ko ? KIND_LABELS[correction.from_kind].ko : KIND_LABELS[correction.from_kind].en}
                    {' → '}
                    {ko ? KIND_LABELS[correction.to_kind].ko : KIND_LABELS[correction.to_kind].en}
                  </p>
                ))}
              </div>
            </details>
          )}

          {!editing && kind !== 'witness' && onReturn && (
            <button type="button" onClick={onReturn} className="mt-3 text-[12.5px] font-semibold text-[var(--accent)] hover:underline">
              {latest ? L('지금의 답 덧붙이기', 'Append another answer') : L('지금 다시 보기', 'Return now')}
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
