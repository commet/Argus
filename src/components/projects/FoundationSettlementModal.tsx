'use client';

import { useState } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { useProjectStore } from '@/stores/useProjectStore';
import type { ContractSettlement, DecisionKind, Project } from '@/stores/types';
import { appendContractSettlement, decisionKind } from '@/lib/decision-contract';
import { track } from '@/lib/analytics';
import { Modal } from '@/components/ui/Modal';

export interface FoundationSettlementModalProps {
  project: Project;
  onClose: () => void;
}

interface FoundationOption {
  id: string;
  ko: string;
  en: string;
  axes: ContractSettlement['axes'];
}

const OPTIONS: Record<Exclude<DecisionKind, 'witness'>, FoundationOption[]> = {
  prediction: [
    { id: 'condition_met', ko: '확인하려던 일이 일어났어요', en: 'The condition was met', axes: { reality: 'met', question: 'valid' } },
    { id: 'condition_not_met', ko: '일어나지 않았어요', en: 'It did not happen', axes: { reality: 'not_met', question: 'valid' } },
    { id: 'mixed', ko: '일부만 맞았어요', en: 'Only part of it happened', axes: { reality: 'partial', question: 'valid' } },
    { id: 'not_observable', ko: '지금 자료로는 확인할 수 없어요', en: 'I cannot tell from the evidence', axes: { reality: 'not_observable', question: 'indeterminate' } },
    { id: 'moot', ko: '이 질문 자체가 더는 중요하지 않아요', en: 'The question no longer matters', axes: { reality: 'unknown', question: 'moot' } },
  ],
  commitment: [
    { id: 'enacted', ko: '약속한 대로 실행했어요', en: 'I acted on the commitment', axes: { commitment: 'enacted', question: 'valid' } },
    { id: 'maintained', ko: '아직 실행 전이지만 약속은 유지해요', en: 'The commitment still stands', axes: { commitment: 'maintained', question: 'valid' } },
    { id: 'revised', ko: '상황을 보고 약속을 고쳤어요', en: 'I revised the commitment', axes: { commitment: 'revised', question: 'reframed' } },
    { id: 'withdrawn', ko: '이 약속은 철회했어요', en: 'I withdrew the commitment', axes: { commitment: 'withdrawn', question: 'valid' } },
    { id: 'moot', ko: '약속할 이유 자체가 사라졌어요', en: 'The commitment became moot', axes: { commitment: 'superseded', question: 'moot' } },
  ],
  declaration: [
    { id: 'maintained', ko: '지금도 이 기준을 유지해요', en: 'I still hold this standard', axes: { commitment: 'maintained', question: 'valid' } },
    { id: 'revised', ko: '기준을 조금 바꿨어요', en: 'I revised the standard', axes: { commitment: 'revised', question: 'reframed' } },
    { id: 'withdrawn', ko: '이 기준은 더는 따르지 않아요', en: 'I no longer hold it', axes: { commitment: 'withdrawn', question: 'valid' } },
    { id: 'superseded', ko: '더 나은 기준으로 바뀌었어요', en: 'A better standard replaced it', axes: { commitment: 'superseded', question: 'narrowed' } },
    { id: 'moot', ko: '이 기준이 필요한 상황이 끝났어요', en: 'The situation no longer calls for it', axes: { commitment: 'superseded', question: 'moot' } },
  ],
};

/**
 * Show the sealed sentence before any outcome control, accept one
 * kind-appropriate answer, then ask exactly one present-standard question.
 * Saving appends a return instead of rewriting the past.
 */
export function FoundationSettlementModal({ project, onClose }: FoundationSettlementModalProps) {
  const locale = useLocale();
  const ko = locale === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);
  const updateProject = useProjectStore((state) => state.updateProject);
  const contract = project.decision_contract!;
  const kind = decisionKind(contract);
  const [selected, setSelected] = useState<FoundationOption | null>(null);
  const [saved, setSaved] = useState<ContractSettlement | null>(null);
  const [returnStage, setReturnStage] = useState<'gate' | 'memory' | 'revealed'>('gate');
  const [memoryDraft, setMemoryDraft] = useState('');
  const [saveMemory, setSaveMemory] = useState(false);

  const original = contract.statement_revisions?.[0]?.from_statement
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
    const settlement: ContractSettlement = {
      option_id: selected.id,
      response_text: ko ? selected.ko : selected.en,
      recorded_at: recordedAt,
      axes: selected.axes,
      observation_source_kind: 'user_report',
      present_standard: { status, recorded_at: recordedAt },
      ...(saveMemory && memoryDraft.trim()
        ? { memory_before_reveal: { text: memoryDraft.trim(), saved_at: recordedAt } }
        : {}),
    };
    updateProject(project.id, {
      decision_contract: appendContractSettlement(contract, settlement),
    });
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
              <p className="mt-1 text-[11.5px] leading-5 text-[var(--text-tertiary)]">
                {L('이 메모는 저장하지 않아요.', 'This note is not saved.')}
              </p>
            </div>
            <textarea
              value={memoryDraft}
              onChange={(event) => setMemoryDraft(event.target.value)}
              rows={4}
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
                <p className="text-[10.5px] font-semibold text-[var(--text-tertiary)]">
                  {L('방금 떠올린 것 · 저장되지 않음', 'What you recalled · not saved')}
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-5 text-[var(--text-secondary)]">
                  {memoryDraft.trim()}
                </p>
                <label className="mt-2.5 flex cursor-pointer items-start gap-2 border-t border-[var(--border)] pt-2.5 text-[11.5px] leading-5 text-[var(--text-secondary)]">
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
                {L('그때 세운 기준을 지금도 유지하나요?', 'Do you still hold the standard you used then?')}
              </p>
              <p className="mt-1 text-[12px] leading-5 text-[var(--text-tertiary)]">
                {L('한 가지만 더 확인하면 끝나요.', 'One last answer, then you are done.')}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                ['same', L('그대로예요', 'It is the same')],
                ['changed', L('달라졌어요', 'It has changed')],
                ['withdrawn', L('그 기준은 거뒀어요', 'I withdrew it')],
                ['skipped', L('지금은 답하지 않을래요', 'Skip for now')],
              ] as const).map(([status, label]) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => save(status)}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-left text-[13px] font-medium leading-5 text-[var(--text-primary)] transition-colors hover:border-[var(--accent)]/50"
                >
                  {label}
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
              {OPTIONS[kind].map((option) => (
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
      <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--text-tertiary)]">
        {sealedOn ? (ko ? `${sealedOn}에 남긴 문장` : `Recorded ${sealedOn}`) : (ko ? '그때 남긴 문장' : 'What you recorded')}
      </p>
      <p className="mt-2 text-[15px] leading-7 text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-voice, serif)' }}>
        “{original}”
      </p>
      {current && current !== original && (
        <div className="mt-3 border-t border-[var(--border)] pt-3">
          <p className="text-[10.5px] font-semibold tracking-[0.04em] text-[var(--text-tertiary)]">
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
