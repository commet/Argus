'use client';

import { useState } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { useProjectStore } from '@/stores/useProjectStore';
import type { ContractSettlement, DecisionContract, DecisionKind, PredicateVerdict, Project } from '@/stores/types';
import { appendContractSettlement, decisionKind, gradePredicate } from '@/lib/decision-contract';
import { premisesToRevisit } from '@/lib/decisive-premises';
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
  /** Non-binding reading aid used only by the past-decision rehearsal. */
  draftVerdicts?: Record<string, 'happened' | 'avoided' | 'partial'>;
  /** Leaves a completed rehearsal at the real, still-unknown decision input. */
  onRealSeal?: () => void;
  /**
   * Lands the user on **this decision's record**. Only a caller knows where
   * that is — behind the modal on the record page, or a route away from the
   * rehearsal — so the destination is declared, never assumed. Absent means
   * the closing button says `닫기` instead of promising a record it cannot
   * reach: a return that ends on a blank screen reads as lost work.
   */
  onViewRecord?: () => void;
}

/**
 * On the first return, collect reality before revealing the sealed sentence.
 * Later returns may reopen the record first because the baseline is no longer
 * blind. Saving appends a return instead of rewriting the past.
 */
export function FoundationSettlementModal({
  project,
  onClose,
  draftVerdicts,
  onRealSeal,
  onViewRecord,
}: FoundationSettlementModalProps) {
  const locale = useLocale();
  const ko = locale === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);
  const updateDecisionContract = useProjectStore((state) => state.updateDecisionContract);
  const contract = project.decision_contract!;
  const kind = decisionKind(contract);
  const isRetro = contract.origin === 'retro';
  const draftVerdict = Object.values(draftVerdicts ?? {})[0];
  const draftOptionId = kind === 'prediction'
    ? draftVerdict === 'happened'
      ? 'condition_met'
      : draftVerdict === 'avoided'
        ? 'condition_not_met'
        : draftVerdict === 'partial'
          ? 'mixed'
          : null
    : null;
  const [selected, setSelected] = useState<FoundationSettlementOption | null>(null);
  const [saved, setSaved] = useState<ContractSettlement | null>(null);
  const [returnStage, setReturnStage] = useState<'observation' | 'gate' | 'memory' | 'standard' | 'revealed'>(
    (contract.settlements?.length ?? 0) > 0 ? 'gate' : 'observation',
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
    // A first return does not reveal the old wording until both human answers
    // are durably appended. Closing anywhere before this line leaves the old
    // record unseen and the next opening correctly starts blind again.
    setReturnStage('revealed');
  };

  return (
    <Modal open onClose={onClose} title={L('그때의 문장으로 돌아왔어요', 'Return to what you recorded')}>
      <div className="space-y-4">
        {returnStage === 'observation' ? (
          <div className="space-y-3">
            <div>
              <p className="text-[15px] font-semibold leading-6 text-[var(--text-primary)]">
                {kind === 'prediction'
                  ? L('원문을 열기 전에, 실제로는 어떻게 되었나요?', 'Before reopening the record, what actually happened?')
                  : kind === 'commitment'
                    ? L('원문을 열기 전에, 그 약속은 어떻게 되었나요?', 'Before reopening the record, what happened to that commitment?')
                    : L('원문을 열기 전에, 지금은 그 기준을 어떻게 보나요?', 'Before reopening the record, how do you see that standard now?')}
              </p>
              <p className="mt-1 text-[12.5px] leading-5 text-[var(--text-secondary)]">
                {L('그때 적은 문장에 끌려가지 않도록, 지금 기억하는 현실부터 남깁니다.', 'Record reality as you remember it now, before the old wording can pull your answer.')}
              </p>
            </div>
            <div className="grid gap-2">
              {FOUNDATION_SETTLEMENT_OPTIONS[kind].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setSelected(option);
                    setReturnStage('gate');
                  }}
                  className={`rounded-xl border bg-[var(--surface)] px-3.5 py-3 text-left text-[13px] font-medium leading-5 text-[var(--text-primary)] transition-colors hover:border-[var(--accent)]/50 hover:bg-[var(--bg)] ${
                    option.id === draftOptionId
                      ? 'border-dashed border-[var(--accent)]/70'
                      : 'border-[var(--border)]'
                  }`}
                >
                  <span>{ko ? option.ko : option.en}</span>
                  {option.id === draftOptionId && (
                    <span className="mt-0.5 block text-[11px] font-medium text-[var(--accent)]">
                      {L('AI가 미리 짚은 초안 · 직접 선택해 주세요', 'AI draft · choose for yourself')}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : returnStage === 'gate' ? (
          <div className="space-y-3">
            <div>
              <p className="text-[15px] font-semibold leading-6 text-[var(--text-primary)]">
                {selected
                  ? L('현실의 답은 정했어요. 원문을 열기 전에 한 가지만 더 확인할게요.', 'Reality comes first. One last answer before the old wording is revealed.')
                  : L('그때의 문장을 바로 볼까요?', 'Ready to see what you wrote?')}
              </p>
              <p className="mt-1 text-[12.5px] leading-5 text-[var(--text-secondary)]">
                {L(
                  '원하면 먼저, 그때 무엇을 중요하게 봤는지 기억나는 대로 적어볼 수 있어요.',
                  'If you want, first write what you remember mattered to you then.',
                )}
              </p>
            </div>
            <PrimaryButton onClick={() => setReturnStage(selected ? 'standard' : 'revealed')}>
              {selected ? L('한 가지만 더 확인하기', 'Answer one last question') : L('그때 문장 보기', 'Show the original')}
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
                {L('아래에서 직접 선택할 때만 이번 귀환에 저장합니다.', 'It is saved with this return only if you opt in below.')}
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
            {memoryDraft.trim() && (
              <label className="flex cursor-pointer items-start gap-2 text-[13px] leading-5 text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={saveMemory}
                  onChange={(event) => setSaveMemory(event.target.checked)}
                  className="mt-0.5 size-3.5 accent-[var(--accent)]"
                />
                <span>{L('이 메모도 이번 귀환 기록에 남기기', 'Save this note with this return')}</span>
              </label>
            )}
            <PrimaryButton onClick={() => setReturnStage(selected ? 'standard' : 'revealed')}>
              {selected ? L('다음 질문으로', 'Continue') : L('원문과 비교하기', 'Compare with the original')}
            </PrimaryButton>
            <button
              type="button"
              onClick={() => {
                setMemoryDraft('');
                setSaveMemory(false);
                setReturnStage(selected ? 'standard' : 'revealed');
              }}
              className="w-full text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              {selected ? L('건너뛰고 계속하기', 'Skip and continue') : L('건너뛰고 원문 보기', 'Skip and show the original')}
            </button>
          </div>
        ) : returnStage === 'standard' && selected ? (
          <PresentStandardStep
            kind={kind}
            ko={ko}
            onSave={save}
            onBack={() => setReturnStage('gate')}
          />
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
                {!saved ? (
                  <label className="mt-2.5 flex cursor-pointer items-start gap-2 border-t border-[var(--border)] pt-2.5 text-[13px] leading-5 text-[var(--text-secondary)]">
                    <input
                      type="checkbox"
                      checked={saveMemory}
                      onChange={(event) => setSaveMemory(event.target.checked)}
                      className="mt-0.5 size-3.5 accent-[var(--accent)]"
                    />
                    <span>{L('이 메모도 이번 귀환 기록에 남기기', 'Save this note with this return')}</span>
                  </label>
                ) : (
                  <p className="mt-2.5 border-t border-[var(--border)] pt-2.5 text-[12px] text-[var(--text-tertiary)]">
                    {saveMemory
                      ? L('이번 귀환 기록에 함께 저장됐어요.', 'Saved with this return.')
                      : L('이 메모는 저장하지 않았어요.', 'This note was not saved.')}
                  </p>
                )}
              </div>
            )}

            <ConfidencePairing contract={contract} ko={ko} />
            <PremiseReturn
              contract={contract}
              ko={ko}
              onGrade={(predicateId, verdict) => {
                updateDecisionContract(project.id, (current) =>
                  (current ? gradePredicate(current, predicateId, verdict, Date.now()) : current));
              }}
            />
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
            {/* 도착지를 아는 호출자만 기록을 약속한다. 없으면 닫기라고 말한다 —
                "기록 보기"가 빈 화면으로 끝나면 사용자는 방금 남긴 것이
                사라졌다고 읽는다. */}
            <PrimaryButton onClick={onViewRecord ?? onClose}>
              {onViewRecord
                ? isRetro
                  ? L('연습 닫고 기록 보기', 'Close practice and view record')
                  : L('기록 보기', 'View record')
                : isRetro
                  ? L('연습 닫기', 'Close practice')
                  : L('닫기', 'Close')}
            </PrimaryButton>
            {isRetro && onRealSeal && (
              <button
                type="button"
                onClick={onRealSeal}
                className="w-full text-[12.5px] font-semibold leading-5 text-[var(--accent)] hover:underline"
              >
                {L(
                  '이제 진짜 — 결과를 아직 모르는 결정 하나 걸어볼까요? →',
                  'Now for real — want to record a decision whose outcome you do not know yet? →',
                )}
              </button>
            )}
              </div>
            ) : selected ? (
              <PresentStandardStep kind={kind} ko={ko} onSave={save} onBack={() => setSelected(null)} />
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
                  className={`rounded-xl border bg-[var(--surface)] px-3.5 py-3 text-left text-[13px] font-medium leading-5 text-[var(--text-primary)] transition-colors hover:border-[var(--accent)]/50 hover:bg-[var(--bg)] ${
                    option.id === draftOptionId
                      ? 'border-dashed border-[var(--accent)]/70'
                      : 'border-[var(--border)]'
                  }`}
                >
                  <span>{ko ? option.ko : option.en}</span>
                  {option.id === draftOptionId && (
                    <span className="mt-0.5 block text-[11px] font-medium text-[var(--accent)]">
                      {L('AI가 미리 짚은 초안 · 직접 선택해 주세요', 'AI draft · choose for yourself')}
                    </span>
                  )}
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

function PresentStandardStep({
  kind,
  ko,
  onSave,
  onBack,
}: {
  kind: Exclude<DecisionKind, 'witness'>;
  ko: boolean;
  onSave: (status: NonNullable<ContractSettlement['present_standard']>['status']) => void;
  onBack: () => void;
}) {
  const L = (k: string, e: string) => (ko ? k : e);
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[14px] font-semibold leading-6 text-[var(--text-primary)]">
          {presentStandardQuestion(kind, ko ? 'ko' : 'en')}
        </p>
        <p className="mt-1 text-[12px] leading-5 text-[var(--text-tertiary)]">
          {L('이 답까지 저장한 뒤, 그때의 문장을 엽니다.', 'After this answer is saved, the old wording is revealed.')}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {PRESENT_STANDARD_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => onSave(status)}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-left text-[13px] font-medium leading-5 text-[var(--text-primary)] transition-colors hover:border-[var(--accent)]/50"
          >
            {presentStandardLabel(kind, status, ko ? 'ko' : 'en')}
          </button>
        ))}
      </div>
      <button type="button" onClick={onBack} className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
        {L('앞으로 돌아가기', 'Back')}
      </button>
    </div>
  );
}

/**
 * What Argus wrote down, coming back to be answered.
 *
 * The premises were collected with real care — each one had to quote the user
 * and say what changes if it turns out false — and then they were never shown
 * again. The return screen read one sentence and nothing else, so the whole
 * premise pipeline was write-only and the track record (held / broke) could
 * only ever stay empty.
 *
 * This is the other half of collecting: a premise you never check was never a
 * premise, just a note. Grading is optional — a return is complete without it.
 */
function PremiseReturn({
  contract,
  ko,
  onGrade,
}: {
  contract: DecisionContract;
  ko: boolean;
  onGrade: (predicateId: string, verdict: PredicateVerdict) => void;
}) {
  const L = (k: string, e: string) => (ko ? k : e);
  const [graded, setGraded] = useState<Record<string, PredicateVerdict>>({});
  // The sealed sentence is answered by the main question above; these are the
  // things it rested on.
  // One shared rule (decisive-premises.ts): standards are never checked, and
  // once the user has said which premises would have flipped them, only those
  // come back — the return gets one moment of attention and should spend it on
  // what they told us carries the weight.
  const premises = premisesToRevisit(
    (contract.predicates || [])
      .filter((p) => p.source !== 'user_lean' && p.text?.trim())
      .map((p) => ({ ...p, kind: p.premise_kind, decisive: p.decisive })),
  ).slice(0, 3);
  if (premises.length === 0) return null;

  const CHOICES: Array<{ verdict: PredicateVerdict; ko: string; en: string }> = [
    { verdict: 'happened', ko: '맞았어요', en: 'Held up' },
    { verdict: 'missed', ko: '아니었어요', en: 'Turned out wrong' },
    { verdict: 'unknown', ko: '아직 몰라요', en: 'Still cannot tell' },
  ];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-3">
      <p className="text-[12.5px] font-semibold text-[var(--text-tertiary)]">
        {L('그때 이게 맞다고 보고 결정하셨어요', 'The decision rested on these')}
      </p>
      <div className="mt-2.5 space-y-3">
        {premises.map((premise) => {
          const answer = graded[premise.id] ?? premise.verdict;
          return (
            <div key={premise.id}>
              <p className="text-[13px] leading-[1.6] text-[var(--text-primary)]">{premise.text}</p>
              {premise.observable && (
                <p className="mt-0.5 text-[12px] leading-5 text-[var(--text-tertiary)]">
                  {L('보기로 한 것', 'what you said would show it')}
                  <span className="mx-1.5 opacity-50">·</span>
                  {premise.observable}
                </p>
              )}
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {CHOICES.map((choice) => (
                  <button
                    key={choice.verdict}
                    type="button"
                    onClick={() => {
                      setGraded((prev) => ({ ...prev, [premise.id]: choice.verdict }));
                      onGrade(premise.id, choice.verdict);
                    }}
                    className={`rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
                      answer === choice.verdict
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text-primary)]'
                        : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50'
                    }`}
                  >
                    {L(choice.ko, choice.en)}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2.5 text-[12px] leading-5 text-[var(--text-tertiary)]">
        {L('안 고르셔도 돼요. 답한 것만 기록에 남습니다.', 'Optional — only what you answer is recorded.')}
      </p>
    </div>
  );
}

/**
 * What they said, next to what happened.
 *
 * This is the only place the loop can actually teach: an outcome on its own is
 * noise, but "거의 확실해요 → 아니었어요" is a thing a person notices about
 * themselves. It is shown as two of their own facts side by side — never a
 * score, never a rate, never a label about the kind of judge they are. The
 * moment it becomes a number it stops being feedback and becomes a verdict
 * (CLAUDE.md rule 2).
 */
function ConfidencePairing({ contract, ko }: { contract: DecisionContract; ko: boolean }) {
  const L = (k: string, e: string) => (ko ? k : e);
  const said = contract.predicates?.find((p) => p.stated_confidence)?.stated_confidence;
  if (!said) return null;
  const SAID: Record<string, { ko: string; en: string }> = {
    even: { ko: '반반이에요', en: 'could go either way' },
    likely: { ko: '그럴 것 같아요', en: 'probably' },
    near_certain: { ko: '거의 확실해요', en: 'almost certain' },
  };
  const settled = contract.settlements?.at(-1);
  return (
    <div className="rounded-xl bg-[var(--bg)] px-3.5 py-3">
      <p className="text-[12.5px] leading-5 text-[var(--text-secondary)]">
        {L('그때 이렇게 보셨어요', 'Back then you said')}
        <span className="mx-1.5 opacity-50">·</span>
        <span className="font-semibold text-[var(--text-primary)]">
          {L(SAID[said].ko, SAID[said].en)}
        </span>
      </p>
      {settled?.response_text && (
        <p className="mt-1 text-[12.5px] leading-5 text-[var(--text-secondary)]">
          {L('실제로는', 'What happened')}
          <span className="mx-1.5 opacity-50">·</span>
          <span className="font-semibold text-[var(--text-primary)]">{settled.response_text}</span>
        </p>
      )}
    </div>
  );
}
