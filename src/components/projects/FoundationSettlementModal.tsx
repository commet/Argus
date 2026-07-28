'use client';

import { useState } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { useProjectStore } from '@/stores/useProjectStore';
import type { ContractSettlement, Project } from '@/stores/types';
import { appendContractSettlement, decisionKind } from '@/lib/decision-contract';
import {
  axesWithPresentStandard,
  FOUNDATION_SETTLEMENT_OPTIONS,
  PRESENT_STANDARD_STATUSES,
  presentStandardLabel,
  presentStandardQuestion,
  type FoundationSettlementOption,
} from '@/lib/foundation-settlement';
import { track } from '@/lib/analytics';
import { Modal } from '@/components/ui/Modal';
import { generateId } from '@/lib/uuid';

export interface FoundationSettlementModalProps {
  project: Project;
  onClose: () => void;
}

/**
 * Show the sealed sentence before any outcome control, accept one
 * kind-appropriate answer, then ask exactly one present-standard question.
 * Saving appends a return instead of rewriting the past.
 */
export function FoundationSettlementModal({ project, onClose }: FoundationSettlementModalProps) {
  const locale = useLocale();
  const ko = locale === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);
  const updateDecisionContract = useProjectStore((state) => state.updateDecisionContract);
  const contract = project.decision_contract!;
  const kind = decisionKind(contract);
  const [selected, setSelected] = useState<FoundationSettlementOption | null>(null);
  const [saved, setSaved] = useState<ContractSettlement | null>(null);
  const [returnStage, setReturnStage] = useState<'gate' | 'memory' | 'revealed'>(
    (contract.settlements?.length ?? 0) > 0 ? 'gate' : 'revealed',
  );
  const [memoryDraft, setMemoryDraft] = useState('');
  const [saveMemory, setSaveMemory] = useState(false);

  const original = contract.sealed_statement?.trim()
    || contract.statement_revisions?.[0]?.from_statement
    || contract.judgment_receipt?.human_judgment?.trim()
    || contract.predicates.find((predicate) => predicate.source === 'user_lean')?.text
    || contract.predicates[0]?.text
    || contract.origin_utterance?.trim()
    || project.name;
  const current = contract.statement_revisions?.at(-1)?.to_statement || original;
  const sealedOn = contract.created_at
    ? new Intl.DateTimeFormat(ko ? 'ko-KR' : 'en-US', { dateStyle: 'medium' }).format(new Date(contract.created_at))
    : '';

  if (kind === 'witness') {
    return (
      <Modal open onClose={onClose} title={L('남겨 둔 기록', 'Saved record')}>
        <div className="space-y-4">
          <OriginalStatement original={original} sealedOn={sealedOn} ko={ko} />
          <p className="text-[13px] leading-6 text-[var(--text-secondary)]">
            {L('이 기록은 나중의 확인이나 알림을 약속하지 않았어요.', 'This record carries no reminder or future check.')}
          </p>
          <PrimaryButton onClick={onClose}>{L('닫기', 'Close')}</PrimaryButton>
        </div>
      </Modal>
    );
  }

  const save = (status: NonNullable<ContractSettlement['present_standard']>['status']) => {
    if (!selected) return;
    const recordedAt = new Date().toISOString();
    const presentResponse = presentStandardLabel(kind, status, ko ? 'ko' : 'en');
    const settlement: ContractSettlement = {
      option_id: selected.id,
      response_text: ko ? selected.ko : selected.en,
      recorded_at: recordedAt,
      axes: axesWithPresentStandard(selected.axes, status),
      observation_source_kind: 'user_report',
      authorization: {
        authorized_by: 'human',
        authorization_mode: 'explicit_confirmation',
        surface: 'web',
        authorization_ref: `web:return:${project.id}:${generateId()}`,
        authorized_at: recordedAt,
      },
      present_standard: {
        status,
        response_text: presentResponse,
        recorded_at: recordedAt,
      },
      ...(saveMemory && memoryDraft.trim()
        ? { memory_before_reveal: { text: memoryDraft.trim(), saved_at: recordedAt } }
        : {}),
    };
    updateDecisionContract(project.id, (latest) =>
      latest ? appendContractSettlement(latest, settlement) : latest);
    track('foundation_return_saved', {
      kind,
      option_id: selected.id,
      present_standard: status,
    });
    setSaved(settlement);
  };

  return (
    <Modal open onClose={onClose} title={L('그때의 문장으로 돌아왔어요', 'Return to what you recorded')}>
      <div className="space-y-4">
        {returnStage === 'gate' ? (
          <div className="space-y-3">
            <div>
              <p className="text-[15px] font-semibold leading-6 text-[var(--text-primary)]">
                {L('그때의 문장을 바로 볼까요?', 'Ready to see what you wrote?')}
              </p>
              <p className="mt-1 text-[12.5px] leading-5 text-[var(--text-secondary)]">
                {L(
                  '원하면 먼저, 그때 무엇을 중요하게 봤는지 기억나는 대로 적어볼 수 있어요.',
                  'If you want, first write what you remember mattered to you then.',
                )}
              </p>
            </div>
            <PrimaryButton onClick={() => setReturnStage('revealed')}>
              {L('그때 문장 보기', 'Show the original')}
            </PrimaryButton>
            <button
              type="button"
              onClick={() => setReturnStage('memory')}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[13px] font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--text-secondary)]/40"
            >
              {L('먼저 기억나는 것 적기', 'Write what I remember first')}
            </button>
          </div>
        ) : returnStage === 'memory' ? (
          <div className="space-y-3">
            <div>
              <p className="text-[14px] font-semibold leading-6 text-[var(--text-primary)]">
                {L('그때 무엇이 가장 중요했나요?', 'What mattered most to you then?')}
              </p>
              <p className="mt-1 text-[13px] leading-5 text-[var(--text-tertiary)]">
                {L('이 메모는 저장하지 않아요.', 'This note is not saved.')}
              </p>
            </div>
            <textarea
              value={memoryDraft}
              onChange={(event) => setMemoryDraft(event.target.value)}
              rows={4}
              maxLength={4000}
              autoFocus
              placeholder={L('기억나는 만큼만 적어보세요', 'Write only what you remember')}
              className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 text-[13px] leading-6 text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]/60"
            />
            <PrimaryButton onClick={() => setReturnStage('revealed')}>
              {L('원문과 비교하기', 'Compare with the original')}
            </PrimaryButton>
            <button
              type="button"
              onClick={() => {
                setMemoryDraft('');
                setReturnStage('revealed');
              }}
              className="w-full text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              {L('건너뛰고 원문 보기', 'Skip and show the original')}
            </button>
          </div>
        ) : (
          <>
            <OriginalStatement
              original={original}
              current={current}
              sealedOn={sealedOn}
              ko={ko}
              reviewCondition={contract.review_condition}
            />
            {memoryDraft.trim() && (
              <div className="rounded-xl bg-[var(--bg)] px-3.5 py-3">
                <p className="text-[12.5px] font-semibold text-[var(--text-tertiary)]">
                  {L('방금 떠올린 것 · 저장되지 않음', 'What you recalled · not saved')}
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-5 text-[var(--text-secondary)]">
                  {memoryDraft.trim()}
                </p>
                <label className="mt-2.5 flex cursor-pointer items-start gap-2 border-t border-[var(--border)] pt-2.5 text-[13px] leading-5 text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={saveMemory}
                    onChange={(event) => setSaveMemory(event.target.checked)}
                    className="mt-0.5 size-3.5 accent-[var(--accent)]"
                  />
                  <span>
                    {L(
                      '이 메모도 이번 귀환 기록에 남기기',
                      'Save this note with this return',
                    )}
                  </span>
                </label>
              </div>
            )}

            {saved ? (
              <div className="space-y-3">
            <p className="text-[15px] font-semibold leading-6 text-[var(--text-primary)]">
              {L('지금의 답을 덧붙였어요.', 'Your answer was appended.')}
            </p>
            <p className="text-[13px] leading-6 text-[var(--text-secondary)]">{saved.response_text}</p>
            <p className="text-[12px] leading-5 text-[var(--text-tertiary)]">
              {L(
                '그때의 문장은 그대로 남아 있어요. 다시 답하면 새 기록으로 이어집니다.',
                'The original stays intact. A later answer will be appended as another return.',
              )}
            </p>
            <PrimaryButton onClick={onClose}>{L('기록 보기', 'View record')}</PrimaryButton>
              </div>
            ) : selected ? (
              <div className="space-y-3">
            <div>
              <p className="text-[14px] font-semibold leading-6 text-[var(--text-primary)]">
                {presentStandardQuestion(kind, ko ? 'ko' : 'en')}
              </p>
              <p className="mt-1 text-[12px] leading-5 text-[var(--text-tertiary)]">
                {L('한 가지만 더 확인하면 끝나요.', 'One last answer, then you are done.')}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {PRESENT_STANDARD_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => save(status)}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-left text-[13px] font-medium leading-5 text-[var(--text-primary)] transition-colors hover:border-[var(--accent)]/50"
                >
                  {presentStandardLabel(kind, status, ko ? 'ko' : 'en')}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setSelected(null)} className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
              {L('앞으로 돌아가기', 'Back')}
            </button>
              </div>
            ) : (
              <div className="space-y-3">
            <p className="text-[14px] font-semibold leading-6 text-[var(--text-primary)]">
              {kind === 'prediction'
                ? L('실제로는 어떻게 되었나요?', 'What actually happened?')
                : kind === 'commitment'
                  ? L('그 약속은 지금 어떻게 되었나요?', 'What happened to that commitment?')
                  : L('그 기준을 지금은 어떻게 보고 있나요?', 'How do you see that standard now?')}
            </p>
            <div className="grid gap-2">
              {FOUNDATION_SETTLEMENT_OPTIONS[kind].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelected(option)}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 text-left text-[13px] font-medium leading-5 text-[var(--text-primary)] transition-colors hover:border-[var(--accent)]/50 hover:bg-[var(--bg)]"
                >
                  {ko ? option.ko : option.en}
                </button>
              ))}
            </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function OriginalStatement({
  original,
  current,
  sealedOn,
  ko,
  reviewCondition,
}: {
  original: string;
  current?: string;
  sealedOn: string;
  ko: boolean;
  reviewCondition?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-[12.5px] font-semibold tracking-[0.08em] text-[var(--text-tertiary)]">
        {sealedOn ? (ko ? `${sealedOn}에 남긴 문장` : `Recorded ${sealedOn}`) : (ko ? '그때 남긴 문장' : 'What you recorded')}
      </p>
      <p className="mt-2 text-[15px] leading-7 text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-voice, serif)' }}>
        “{original}”
      </p>
      {current && current !== original && (
        <div className="mt-3 border-t border-[var(--border)] pt-3">
          <p className="text-[12.5px] font-semibold tracking-[0.04em] text-[var(--text-tertiary)]">
            {ko ? '이후에 고친 현재 문장' : 'Current wording after your revision'}
          </p>
          <p className="mt-1.5 text-[13px] leading-6 text-[var(--text-secondary)]">“{current}”</p>
        </div>
      )}
      {reviewCondition && (
        <p className="mt-3 border-t border-[var(--border)] pt-3 text-[12.5px] leading-6 text-[var(--text-secondary)]">
          {ko ? '다시 보기로 한 조건' : 'Reason to return'}: {reviewCondition}
        </p>
      )}
    </div>
  );
}

function PrimaryButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="w-full rounded-xl bg-[var(--text-primary)] px-4 py-3 text-[13px] font-semibold text-[var(--bg)]">
      {children}
    </button>
  );
}
