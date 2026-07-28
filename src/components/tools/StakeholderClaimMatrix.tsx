'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Clock3,
  FileText,
  ListFilter,
  Plus,
  XCircle,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useLocale } from '@/hooks/useLocale';
import {
  buildStakeholderValidationMatrix,
  type DocumentClaimUnit,
  type StakeholderStatement,
} from '@/lib/stakeholder-validation';
import type {
  FeedbackRecord,
  Persona,
  StakeholderRealityCheck,
  StakeholderRealityCheckStatus,
} from '@/stores/types';

interface StakeholderClaimMatrixProps {
  record: FeedbackRecord;
  personas: Persona[];
  onOpenPersona: (personaId: string) => void;
  onUpdateRealityChecks?: (personaId: string, checks: StakeholderRealityCheck[]) => void;
  focusRealityCheckId?: string;
}

type Selection =
  | { type: 'cell'; rowIndex: number; claimIndex: number }
  | { type: 'unmapped'; rowIndex: number };

const toneStyles = {
  challenge: 'border-[var(--danger)]/35 bg-[var(--danger)]/8 text-[var(--danger)]',
  condition: 'border-[var(--warning)]/40 bg-[var(--warning)]/9 text-[var(--warning)]',
  support: 'border-[var(--success)]/35 bg-[var(--success)]/8 text-[var(--success)]',
  mixed: 'border-[var(--accent)]/35 bg-[var(--accent)]/8 text-[var(--accent)]',
  none: 'border-[var(--border-subtle)] bg-transparent text-[var(--text-tertiary)]',
} as const;

function ToneIcon({ tone }: { tone: keyof typeof toneStyles }) {
  if (tone === 'challenge') return <CircleAlert size={15} />;
  if (tone === 'support') return <CircleCheck size={15} />;
  if (tone === 'condition' || tone === 'mixed') return <ListFilter size={15} />;
  return <CircleDashed size={14} />;
}

export function StakeholderClaimMatrix({ record, personas, onOpenPersona, onUpdateRealityChecks, focusRealityCheckId }: StakeholderClaimMatrixProps) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const matrix = useMemo(() => buildStakeholderValidationMatrix(record, personas), [record, personas]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [sourceClaim, setSourceClaim] = useState<DocumentClaimUnit | null>(null);
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const lastFocusedCheckRef = useRef<string | null>(null);
  const checkRows = useMemo(() => record.results.flatMap((result) => {
    const persona = personas.find((item) => item.id === result.persona_id);
    return (result.reality_checks ?? []).map((check) => ({
      ...check,
      personaId: result.persona_id,
      personaName: persona?.name || result.persona_id,
    }));
  }), [personas, record.results]);

  useEffect(() => {
    if (!focusRealityCheckId || lastFocusedCheckRef.current === focusRealityCheckId) return;
    if (!checkRows.some((check) => check.id === focusRealityCheckId)) return;
    const timer = window.setTimeout(() => {
      const target = document.getElementById(`stakeholder-reality-check-${focusRealityCheckId}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target?.focus({ preventScroll: true });
      if (target) lastFocusedCheckRef.current = focusRealityCheckId;
    }, 60);
    return () => window.clearTimeout(timer);
  }, [checkRows, focusRealityCheckId]);

  if (matrix.claims.length === 0) {
    return (
      <section className="border-y border-[var(--border-subtle)] py-4">
        <p className="text-[13px] font-bold text-[var(--text-primary)]">{L('주장 × 이해관계자', 'Claims × stakeholders')}</p>
        <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
          {L('원문이 없어 주장별 연결을 만들 수 없습니다. 개별 반응에서 확인하세요.', 'The source text is unavailable, so claim-level links cannot be created. Review the individual responses instead.')}
        </p>
      </section>
    );
  }

  const selectedRow = selection ? matrix.rows[selection.rowIndex] : null;
  const selectedClaim = selection?.type === 'cell' ? matrix.claims[selection.claimIndex] : null;
  const selectedStatements: StakeholderStatement[] = !selection || !selectedRow
    ? []
    : selection.type === 'cell'
      ? selectedRow.cells[selection.claimIndex].statements
      : selectedRow.unmapped;
  const completedChecks = checkRows.filter((check) => check.status !== 'pending').length;

  const checksFor = (personaId: string) => record.results.find((result) => result.persona_id === personaId)?.reality_checks ?? [];
  const saveChecks = (personaId: string, checks: StakeholderRealityCheck[]) => onUpdateRealityChecks?.(personaId, checks);
  const checkIdFor = (statement: StakeholderStatement, claim?: DocumentClaimUnit | null) =>
    `reality:${record.id}:${statement.id}:${claim?.id ?? 'unmapped'}`;
  const addRealityCheck = (statement: StakeholderStatement) => {
    if (!selectedRow || !onUpdateRealityChecks) return;
    const existing = checksFor(selectedRow.personaId);
    const id = checkIdFor(statement, selectedClaim);
    if (existing.some((check) => check.id === id)) return;
    saveChecks(selectedRow.personaId, [...existing, {
      id,
      statement_id: statement.id,
      ...(selectedClaim ? { claim_id: selectedClaim.id } : {}),
      statement: statement.text,
      question: `${selectedRow.name}: ${statement.text}`,
      status: 'pending',
      created_at: new Date().toISOString(),
    }]);
  };
  const updateRealityCheck = (personaId: string, checkId: string, patch: Partial<StakeholderRealityCheck>) => {
    const now = new Date().toISOString();
    saveChecks(personaId, checksFor(personaId).map((check) => check.id === checkId
      ? {
          ...check,
          ...patch,
          ...(patch.status ? { checked_at: patch.status === 'pending' ? undefined : now } : {}),
        }
      : check));
  };

  const kindLabel = (kind: StakeholderStatement['kind']) => ({
    concern: L('우려', 'Concern'),
    condition: L('조건', 'Condition'),
    support: L('지지', 'Support'),
    question: L('질문', 'Question'),
    risk: L('위험', 'Risk'),
  }[kind]);

  const toneLabel = (tone: keyof typeof toneStyles, count: number) => {
    if (tone === 'none') return L('직접 연결된 반응 없음', 'No directly linked response');
    const label = tone === 'challenge'
      ? L('반론·위험', 'Challenge or risk')
      : tone === 'condition'
        ? L('확인 조건', 'Validation condition')
        : tone === 'support'
          ? L('지지 근거', 'Supporting response')
          : L('상반된 반응', 'Mixed response');
    return `${label} ${count}`;
  };

  return (
    <section className="border-y border-[var(--border-subtle)] py-4" aria-labelledby="stakeholder-matrix-title">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h4 id="stakeholder-matrix-title" className="text-[14px] font-bold text-[var(--text-primary)]">
            {L('주장 × 이해관계자', 'Claims × stakeholders')}
          </h4>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
            {L('가상 반응입니다. 원문과 직접 연결된 반응만 표시하며, 실제 확인 전에는 확정하지 않습니다.', 'These are simulated responses. Only direct source links are shown; nothing is confirmed until checked with real stakeholders.')}
          </p>
        </div>
        <div className="text-right text-[12px] text-[var(--text-tertiary)]">
          <p>{L('셀을 눌러 발언과 원문을 함께 확인', 'Select a cell to compare response and source')}</p>
          {checkRows.length > 0 && <p className="mt-0.5 font-semibold tabular-nums text-[var(--accent)]">{L(`실제 확인 ${completedChecks}/${checkRows.length}`, `Reality checks ${completedChecks}/${checkRows.length}`)}</p>}
        </div>
      </div>

      <div className="overflow-x-auto border border-[var(--border-subtle)]">
        <table className="min-w-max border-collapse text-left">
          <thead>
            <tr className="bg-[var(--bg)]">
              <th className="sticky left-0 z-10 w-[190px] border-b border-r border-[var(--border-subtle)] bg-[var(--bg)] px-3 py-2 align-bottom text-[12px] font-bold text-[var(--text-tertiary)]">
                {L('이해관계자', 'Stakeholder')}
              </th>
              {matrix.claims.map((claim, index) => (
                <th key={claim.id} className="w-[178px] max-w-[178px] border-b border-r border-[var(--border-subtle)] p-0 align-top last:border-r-0">
                  <button
                    type="button"
                    onClick={() => setSourceClaim(claim)}
                    className="group flex h-[112px] w-full flex-col justify-between p-3 text-left transition-colors hover:bg-[var(--bg-hover)] focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[var(--accent)]"
                    aria-label={L(`주장 ${index + 1} 원문 보기`, `Open source for claim ${index + 1}`)}
                  >
                    <span className="line-clamp-4 text-[12.5px] font-semibold leading-[1.45] text-[var(--text-primary)]">{claim.text}</span>
                    <span className="flex w-full items-center justify-between text-[12.5px] font-medium text-[var(--text-tertiary)]">
                      <span>{claim.section || L(`주장 ${index + 1}`, `Claim ${index + 1}`)}</span>
                      <span className="flex items-center gap-1"><FileText size={10} /> L{claim.lineStart}{claim.lineEnd !== claim.lineStart ? `–${claim.lineEnd}` : ''}</span>
                    </span>
                  </button>
                </th>
              ))}
              <th className="w-[112px] border-b border-l border-[var(--border-subtle)] bg-[var(--bg)] px-3 py-2 align-bottom text-[12px] font-bold text-[var(--text-tertiary)]">
                {L('기타 확인', 'Other checks')}
              </th>
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row, rowIndex) => (
              <tr key={row.personaId}>
                <th className="sticky left-0 z-10 h-[76px] border-b border-r border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 last:border-b-0">
                  <button type="button" onClick={() => onOpenPersona(row.personaId)} className="group w-full text-left">
                    <span className="block truncate text-[12px] font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)]">{row.name}</span>
                    <span className="mt-0.5 block truncate text-[12px] font-normal text-[var(--text-secondary)]">{row.role}</span>
                    <span className="mt-1 block text-[12.5px] font-normal text-[var(--text-tertiary)]">
                      {row.influence === 'high' ? L('영향 높음', 'High influence') : row.influence === 'low' ? L('영향 낮음', 'Low influence') : L('영향 중간', 'Medium influence')}
                    </span>
                  </button>
                </th>
                {row.cells.map((cell, claimIndex) => {
                  const active = selection?.type === 'cell' && selection.rowIndex === rowIndex && selection.claimIndex === claimIndex;
                  return (
                    <td key={cell.claimId} className="h-[76px] border-b border-r border-[var(--border-subtle)] p-2 last:border-r-0">
                      <button
                        type="button"
                        onClick={() => cell.statements.length > 0 && setSelection({ type: 'cell', rowIndex, claimIndex })}
                        disabled={cell.statements.length === 0}
                        className={`flex h-[58px] w-full items-center justify-center gap-1.5 border text-[12.5px] font-bold transition-all focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)] ${toneStyles[cell.tone]} ${active ? 'ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--surface)]' : ''} ${cell.statements.length > 0 ? 'hover:-translate-y-px' : 'cursor-default opacity-55'}`}
                        aria-label={`${row.name}: ${toneLabel(cell.tone, cell.statements.length)}`}
                      >
                        <ToneIcon tone={cell.tone} />
                        {cell.statements.length > 0 && <span>{cell.statements.length}</span>}
                      </button>
                    </td>
                  );
                })}
                <td className="h-[76px] border-b border-l border-[var(--border-subtle)] p-2">
                  <button
                    type="button"
                    onClick={() => row.unmapped.length > 0 && setSelection({ type: 'unmapped', rowIndex })}
                    disabled={row.unmapped.length === 0}
                    className={`flex h-[58px] w-full items-center justify-center gap-1 border border-dashed border-[var(--border)] text-[12.5px] font-bold text-[var(--text-secondary)] ${row.unmapped.length > 0 ? 'hover:border-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]' : 'cursor-default opacity-40'}`}
                    aria-label={L(`${row.name}: 원문에 직접 연결되지 않은 반응 ${row.unmapped.length}건`, `${row.name}: ${row.unmapped.length} responses without a direct source link`)}
                  >
                    <ListFilter size={14} /> {row.unmapped.length}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selection && selectedRow && (
        <div className="mt-4 border-t border-[var(--border-subtle)] pt-4" aria-live="polite">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold text-[var(--text-tertiary)]">
                {selectedClaim ? L('문서 주장', 'Document claim') : L('직접 연결되지 않은 반응', 'Responses without a direct source link')}
              </p>
              {selectedClaim ? (
                <>
                  <p className="mt-1 text-[13px] font-semibold leading-relaxed text-[var(--text-primary)]">{selectedClaim.text}</p>
                  <button type="button" onClick={() => setSourceClaim(selectedClaim)} className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-bold text-[var(--accent)] hover:underline">
                    <FileText size={12} /> {L(`원문 L${selectedClaim.lineStart} 보기`, `Open source at L${selectedClaim.lineStart}`)}
                  </button>
                </>
              ) : (
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                  {L('문서의 특정 주장과 연결 근거가 충분하지 않습니다. 버리지 않고 별도 확인 대상으로 남겼습니다.', 'There is not enough evidence to link these to a specific document claim. They remain visible for separate review.')}
                </p>
              )}
            </div>
            <div className="min-w-0 flex-1 border-t border-[var(--border-subtle)] pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px] font-bold text-[var(--text-tertiary)]">{selectedRow.name} · {L('가상 반응', 'Simulated response')}</p>
                <button type="button" onClick={() => onOpenPersona(selectedRow.personaId)} className="inline-flex shrink-0 items-center gap-1 text-[12px] font-bold text-[var(--accent)] hover:underline">
                  {L('전체 피드백', 'Full feedback')} <ArrowRight size={11} />
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {selectedStatements.map((statement) => (
                  <div key={statement.id} className="border-l-2 border-[var(--border)] pl-2.5">
                    <p className="text-[12.5px] font-bold text-[var(--text-tertiary)]">{kindLabel(statement.kind)}</p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-primary)]">{statement.text}</p>
                    {onUpdateRealityChecks && (() => {
                      const id = checkIdFor(statement, selectedClaim);
                      const tracked = checksFor(selectedRow.personaId).find((check) => check.id === id);
                      return tracked ? (
                        <p className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--accent)]"><Clock3 size={11} /> {L('실제 확인 목록에 있음', 'Added to reality checks')}</p>
                      ) : (
                        <button type="button" onClick={() => addRealityCheck(statement)} className="mt-1 inline-flex min-h-7 items-center gap-1 text-[12px] font-semibold text-[var(--accent)] hover:underline">
                          <Plus size={11} /> {L('실제 확인에 추가', 'Add reality check')}
                        </button>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {checkRows.length > 0 && (
        <section className="mt-4 border-t border-[var(--border-subtle)] pt-4" aria-labelledby="stakeholder-reality-checks-title">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h5 id="stakeholder-reality-checks-title" className="text-[13px] font-bold text-[var(--text-primary)]">{L('실제 확인 목록', 'Reality-check list')}</h5>
              <p className="mt-0.5 text-[12.5px] text-[var(--text-secondary)]">{L('가상 반응을 실제 당사자에게 확인한 결과를 남깁니다.', 'Record what the real stakeholder actually confirms or disputes.')}</p>
            </div>
            <span className="shrink-0 text-[12px] tabular-nums text-[var(--text-tertiary)]">{completedChecks}/{checkRows.length}</span>
          </div>
          <div className="mt-3 divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
            {checkRows.map((check) => (
              <article
                id={`stakeholder-reality-check-${check.id}`}
                key={check.id}
                tabIndex={-1}
                className="scroll-mt-24 py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]/45"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-bold text-[var(--text-tertiary)]">{check.personaName} · {L('확인할 발언', 'Statement to verify')}</p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-primary)]">{check.statement}</p>
                  </div>
                  <div role="group" aria-label={L(`${check.personaName} 실제 확인 상태`, `Reality-check status for ${check.personaName}`)} className="inline-flex shrink-0 border border-[var(--border-subtle)] bg-[var(--bg)] p-0.5">
                    {([
                      { value: 'pending' as const, label: L('대기', 'Pending'), Icon: Clock3 },
                      { value: 'confirmed' as const, label: L('확인됨', 'Confirmed'), Icon: CircleCheck },
                      { value: 'contradicted' as const, label: L('달랐음', 'Disputed'), Icon: XCircle },
                    ]).map(({ value, label, Icon }) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={check.status === value}
                        onClick={() => updateRealityCheck(check.personaId, check.id, { status: value as StakeholderRealityCheckStatus })}
                        className={`inline-flex min-h-7 items-center gap-1 px-2 text-[13px] font-semibold ${check.status === value ? 'bg-[var(--surface)] text-[var(--accent)] shadow-sm' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}
                      >
                        <Icon size={11} /> {label}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  value={draftNotes[check.id] ?? check.note ?? ''}
                  onChange={(event) => setDraftNotes((current) => ({ ...current, [check.id]: event.target.value }))}
                  onBlur={(event) => updateRealityCheck(check.personaId, check.id, { note: event.target.value.trim() || undefined })}
                  placeholder={L('실제 답변이나 확인 경로 메모', 'Note the real response or verification path')}
                  className="mt-2 w-full border border-[var(--border-subtle)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none"
                />
              </article>
            ))}
          </div>
        </section>
      )}

      <Modal
        open={Boolean(sourceClaim)}
        onClose={() => setSourceClaim(null)}
        title={L('문서 원문', 'Document source')}
        widthClass="max-w-3xl"
        closeLabel={L('닫기', 'Close')}
      >
        {sourceClaim && (
          <div>
            <div className="mb-3 flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
              <p className="truncate text-[12px] font-bold text-[var(--text-primary)]">{record.document_title}</p>
              <p className="shrink-0 text-[12px] text-[var(--text-tertiary)]">L{sourceClaim.lineStart}{sourceClaim.lineEnd !== sourceClaim.lineStart ? `–${sourceClaim.lineEnd}` : ''}</p>
            </div>
            <div className="overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg)] font-mono text-[12.5px] leading-[1.65]">
              {(record.document_text || '').split(/\r?\n/).map((line, index) => {
                const lineNo = index + 1;
                const highlighted = lineNo >= sourceClaim.lineStart && lineNo <= sourceClaim.lineEnd;
                return (
                  <div key={lineNo} data-highlighted={highlighted ? 'true' : undefined} className={`grid grid-cols-[42px_1fr] ${highlighted ? 'bg-[var(--accent)]/12 text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                    <span className={`select-none border-r px-2 py-0.5 text-right ${highlighted ? 'border-[var(--accent)]/25 text-[var(--accent)]' : 'border-[var(--border-subtle)] text-[var(--text-tertiary)]'}`}>{lineNo}</span>
                    <span className="whitespace-pre-wrap break-words px-3 py-0.5">{line || ' '}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
