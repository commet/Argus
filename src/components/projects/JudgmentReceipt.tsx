'use client';

/**
 * JudgmentReceipt — seal과 settle을 하나의 오브젝트로 묶는 컴포넌트.
 *
 * mode="seal"   : 판단을 봉인할 때. human_judgment 입력란 노출.
 * mode="settle" : 귀환 시. 그때의 판단 + what_happened 입력란 노출.
 *
 * B형 narrative 포맷 — 레이블 없이 문장으로 읽힌다.
 * "AI는 이렇게 가정했다 → 이 가정이 틀리면 → 당신이 판단해야 했던 것"
 */

import { useState } from 'react';
import type { JudgmentReceipt as JudgmentReceiptType } from '@/stores/types';

export function deriveReceiptFields(predicates: { source: string; text: string; authored?: string }[], projectName: string) {
  const governing = predicates.find((p) => p.source === 'governing_idea' || p.source === 'user_lean');
  const risk = predicates.find((p) => p.source === 'risk');
  const actor = predicates.find((p) => p.source === 'actor');
  return {
    real_question: governing?.text || projectName || '',
    unverified_assumption: risk?.text || '',
    human_only: actor?.text || '',
  };
}

interface SealProps {
  mode: 'seal';
  real_question: string;
  unverified_assumption: string;
  human_only: string;
  check_by: string;
  onJudgmentChange: (value: string) => void;
  humanJudgment: string;
  locale: 'ko' | 'en';
}

interface SettleProps {
  mode: 'settle';
  receipt: JudgmentReceiptType;
  sealedOn: string;
  onWhatHappenedChange: (value: string) => void;
  whatHappened: string;
  onSave?: (whatHappened: string) => void;
  locale: 'ko' | 'en';
}

type Props = SealProps | SettleProps;

export function JudgmentReceipt(props: Props) {
  const ko = props.locale === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);

  if (props.mode === 'seal') {
    const { real_question, unverified_assumption, human_only, check_by, humanJudgment, onJudgmentChange } = props;
    return (
      <div className="rounded-xl border border-[var(--border)] overflow-hidden text-[13px] leading-[1.6]">
        {real_question && (
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <p className="text-[11px] text-[var(--text-tertiary)] mb-1">
              {L('AI가 읽은 진짜 질문', 'The real question AI read')}
            </p>
            <p className="text-[var(--text-primary)] font-medium" style={{ fontFamily: 'var(--font-voice, serif)' }}>
              &ldquo;{real_question}&rdquo;
            </p>
          </div>
        )}

        {unverified_assumption && (
          <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)]">
            <p className="text-[11px] text-[var(--text-tertiary)] mb-1">
              {L('AI는 이렇게 가정했다', 'AI assumed')}
            </p>
            <div className="flex gap-2 items-start">
              <div className="w-0.5 self-stretch bg-[var(--border-strong)] rounded shrink-0 mt-0.5" />
              <p className="text-[var(--text-primary)]">
                {unverified_assumption}
                {' '}
                <span className="text-[var(--text-warning)] font-medium text-[11px]">
                  {L('아직 확인되지 않음', 'unverified')}
                </span>
              </p>
            </div>
          </div>
        )}

        {human_only && (
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <p className="text-[11px] text-[var(--text-tertiary)] mb-1">
              {L('AI가 대신할 수 없는 것', 'What only you can judge')}
            </p>
            <p className="text-[var(--text-secondary)]">{human_only}</p>
          </div>
        )}

        <div className="px-4 py-3">
          <p className="text-[12px] text-[var(--text-secondary)] mb-1.5">
            {L(`지금의 판단 — ${check_by}에 꺼냅니다`, `Your judgment — opened again on ${check_by}`)}
          </p>
          <input
            type="text"
            value={humanJudgment}
            onChange={(e) => onJudgmentChange(e.target.value)}
            placeholder={L(
              '한 줄로: 나는 ___라고 판단했다',
              'One line: I judged that ___',
            )}
            maxLength={280}
            className="w-full text-[13px] px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        </div>
      </div>
    );
  }

  // mode === 'settle'
  const { receipt, sealedOn, whatHappened, onWhatHappenedChange, onSave } = props;
  const visibleWhatHappened = whatHappened || receipt.what_happened || '';
  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden text-[13px] leading-[1.6]">
      <div className="px-4 py-2.5 bg-[var(--surface)] border-b border-[var(--border)]">
        <p className="text-[11px] text-[var(--text-muted)]">
          {L(`${sealedOn}에 봉인한 판단`, `Judgment sealed on ${sealedOn}`)}
        </p>
      </div>

      {receipt.real_question && (
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <p className="text-[11px] text-[var(--text-tertiary)] mb-1">
            {L('그때의 진짜 질문', 'The real question then')}
          </p>
          <p className="text-[var(--text-primary)] font-medium" style={{ fontFamily: 'var(--font-voice, serif)' }}>
            &ldquo;{receipt.real_question}&rdquo;
          </p>
        </div>
      )}

      {receipt.unverified_assumption && (
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <p className="text-[11px] text-[var(--text-tertiary)] mb-1">
            {L('그때 검증되지 않았던 가정', 'The unverified assumption then')}
          </p>
          <div className="flex gap-2 items-start">
            <div className="w-0.5 self-stretch bg-[var(--border-strong)] rounded shrink-0 mt-0.5" />
            <p className="text-[var(--text-secondary)]">{receipt.unverified_assumption}</p>
          </div>
        </div>
      )}

      {receipt.human_judgment && (
        <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)]">
          <p className="text-[11px] text-[var(--text-tertiary)] mb-1">
            {L('그때 당신의 판단', 'Your judgment then')}
          </p>
          <p className="text-[var(--text-primary)] font-medium">&ldquo;{receipt.human_judgment}&rdquo;</p>
        </div>
      )}

      <div className="px-4 py-3">
        <p className="text-[11px] text-[var(--text-tertiary)] mb-1.5">
          {L('실제로 어떻게 됐나요?', 'What actually happened?')}
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={visibleWhatHappened}
            onChange={(e) => onWhatHappenedChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && visibleWhatHappened.trim() && onSave) onSave(visibleWhatHappened.trim()); }}
            placeholder={L('한 줄로 적어주세요', 'One line summary')}
            maxLength={280}
            className="flex-1 text-[13px] px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
          {onSave && visibleWhatHappened.trim() && visibleWhatHappened.trim() !== (receipt.what_happened || '').trim() && (
            <button
              onClick={() => onSave(visibleWhatHappened.trim())}
              className="px-3 py-2 rounded-lg text-[12px] font-medium border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-colors shrink-0"
            >
              {L('저장', 'Save')}
            </button>
          )}
        </div>
        <p className="mt-2 text-[10px] font-semibold tracking-[0.14em] text-[var(--text-tertiary)]">
          WHAT HAPPENED -- {visibleWhatHappened.trim() || (ko ? '아직 비어 있음' : 'EMPTY')}
        </p>
        <p className="mt-1 text-[10px] font-semibold tracking-[0.14em] text-[var(--text-tertiary)]">
          AI VERDICT -- NONE
        </p>
      </div>
    </div>
  );
}
