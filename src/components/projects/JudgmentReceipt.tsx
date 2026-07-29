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

import type { JudgmentReceipt as JudgmentReceiptType } from '@/stores/types';
import { JudgmentAttributionLine } from './JudgmentAttributionLine';

/**
 * 한 문장이 그 칸에 들어가도 되는 모양인가 (2026-07-29).
 *
 * 실제 봉인 기록에서 나온 것들:
 *   · "일단"                        → 기준점 칸에 두 글자
 *   · "뭔가 인프라로 만들기?"         → 판단 칸에 의문문
 *   · "'다음 단계' 섹션에서 Day 3에 …가능한 타임라인이에요? …답하기 어려워져요."
 *                                   → **"아직 확인되지 않은 가정"** 칸에 리뷰 문단 통째로
 *
 * 마지막 것이 제일 나쁘다. 그건 가정이 아니라 검토자가 남긴 지적이고, 확인일에
 * "이 가정이 맞았나요?"라고 물으면 답할 수가 없다. 이름표와 내용이 다르면
 * 사용자는 화면 전체를 못 믿게 된다.
 *
 * 그래서 못 미더운 것은 **조용히 빼지 않고** 안 넣는다 — 빈 칸은 렌더되지 않으므로
 * 결과적으로 그 줄이 사라진다. 지어내서 채우는 것보다 없는 게 정직하다.
 */
function fitsAsClaim(text: string | undefined, maxLen: number): boolean {
  const t = (text ?? '').trim();
  if (t.length < 8) return false;          // "일단" 류 — 문장이 아니다
  if (t.length > maxLen) return false;     // 문단은 주장 한 줄이 아니다
  if (/\?|인가요|이에요\?|일까요/.test(t)) return false; // 물음은 가정이 아니다
  return true;
}

export function deriveReceiptFields(predicates: { source: string; text: string; authored?: string }[], projectName: string) {
  const governing = predicates.find((p) => p.source === 'governing_idea' || p.source === 'user_lean');
  const risk = predicates.find((p) => fitsAsClaim(p.text, 220) && p.source === 'risk');
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
  baselineJudgment?: string;
  /** 지금 칸에 든 문장이 **손대지 않은 AI 초안**인가. 연하게 그리고, 그대로 두면
   *  「AI가 쓴 문장」으로 기록된다고 말하기 위해서만 쓴다. */
  isAiDraft?: boolean;
  locale: 'ko' | 'en';
}

interface SettleProps {
  mode: 'settle';
  receipt: JudgmentReceiptType;
  sealedOn: string;
  onWhatHappenedChange: (value: string) => void;
  whatHappened: string;
  onSave?: (whatHappened: string) => void;
  onClear?: () => void;
  locale: 'ko' | 'en';
  /** Split the return receipt around the single outcome tap. */
  section?: 'all' | 'anchor' | 'outcome';
  /** A structured outcome tap has already been persisted. */
  outcomeRecorded?: boolean;
}

type Props = SealProps | SettleProps;

export function JudgmentReceipt(props: Props) {
  const ko = props.locale === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);

  if (props.mode === 'seal') {
    const { real_question, unverified_assumption, human_only, check_by, humanJudgment, baselineJudgment, isAiDraft, onJudgmentChange } = props;
    return (
      <div className="rounded-xl border border-[var(--border)] overflow-hidden text-[13px] leading-[1.6]">
        {baselineJudgment && (
          <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--bg)]/55">
            <p className="text-[12.5px] text-[var(--text-tertiary)] mb-1">
              {L('검토 전에 남긴 기준점 · 평가하지 않음', 'Your pre-review baseline · not scored')}
            </p>
            <p className="text-[var(--text-secondary)]" style={{ fontFamily: 'var(--font-voice, serif)' }}>
              &ldquo;{baselineJudgment}&rdquo;
            </p>
          </div>
        )}
        {real_question && (
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <p className="text-[12.5px] text-[var(--text-tertiary)] mb-1">
              {L('검토가 짚은 핵심', 'The crux this review surfaced')}
            </p>
            <p className="text-[var(--text-primary)] font-medium" style={{ fontFamily: 'var(--font-voice, serif)' }}>
              &ldquo;{real_question}&rdquo;
            </p>
          </div>
        )}

        {unverified_assumption && (
          <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)]">
            <p className="text-[12.5px] text-[var(--text-tertiary)] mb-1">
              {L('아직 확인하지 않은 것', 'Not verified yet')}
            </p>
            <div className="rounded-lg bg-[var(--accent)]/[0.04] px-3 py-2">
              <p className="text-[var(--text-primary)]">
                {unverified_assumption}
              </p>
            </div>
          </div>
        )}

        {human_only && (
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <p className="text-[12.5px] text-[var(--text-tertiary)] mb-1">
              {L('사용자가 직접 판단할 것', 'What you need to judge')}
            </p>
            <p className="text-[var(--text-secondary)]">{human_only}</p>
          </div>
        )}

        <div className="px-4 py-3">
          <p className="text-[12px] text-[var(--text-secondary)] mb-1.5">
            {L(`검토 뒤 내가 확정하는 판단 · ${check_by}에 다시 확인`, `The judgment I am choosing after review · checked again on ${check_by}`)}
          </p>
          <input
            type="text"
            aria-label={L('지금의 판단', 'Your judgment now')}
            value={humanJudgment}
            onChange={(e) => onJudgmentChange(e.target.value)}
            placeholder={L(
              '한 줄로: 나는 ___라고 판단한다',
              'One line: I judge that ___',
            )}
            maxLength={280}
            // 손대지 않은 AI 초안은 **연하게** 보인다 — 확정된 내 문장처럼 보이면
            // 그대로 지나칠 확률이 높아진다. 흐린 글씨가 "이건 아직 네 말이 아니다"를
            // 말한다. 손대는 순간 진해진다.
            className={`w-full text-[13px] px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] ${
              isAiDraft ? 'text-[var(--text-tertiary)] italic' : 'text-[var(--text-primary)]'
            }`}
          />
          {isAiDraft && (
            <p className="mt-1.5 text-[12.5px] leading-[1.45] text-[var(--text-tertiary)]">
              {L(
                'Argus가 초안으로 적어둔 문장이에요. 그대로 두셔도 되고 — 그러면 「AI가 쓴 문장」으로 기록돼요. 고쳐 쓰시면 사장님 문장이 됩니다.',
                "Argus drafted this line. Keep it — it will be recorded as the AI's wording. Rewrite it and it becomes yours.",
              )}
            </p>
          )}
          {/* 정말 비어 있을 때: 무슨 문장이 봉인되는지 **그 문장 그대로** 보여준다.
              2026-07-29 이전에는 "비워두면 기준점이 남아요"라는 회색 한 줄뿐이었고,
              그래서 아무도 자기가 무엇을 봉인하는지 모른 채 확정했다. 결과를 미리
              보여주는 것은 지어내는 것이 아니다 — 이미 있는 문장을 읽어줄 뿐이다. */}
          {baselineJudgment && !humanJudgment.trim() && (
            <div className="mt-2 rounded-lg bg-[var(--accent)]/[0.05] px-3 py-2.5">
              <p className="text-[12.5px] leading-[1.45] text-[var(--text-secondary)]">
                {L(`이대로 확정하면 ${check_by}에 이 문장을 다시 봅니다`, `Confirm as-is and on ${check_by} you will revisit this line`)}
              </p>
              <p className="mt-1 text-[13px] leading-[1.5] text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-voice, serif)' }}>
                &ldquo;{baselineJudgment}&rdquo;
              </p>
              <p className="mt-1 text-[12.5px] text-[var(--text-tertiary)]">
                {L('검토를 시작하기 전에 적으신 문장이에요.', 'You wrote this before the review began.')}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // mode === 'settle'
  const {
    receipt,
    sealedOn,
    whatHappened,
    onWhatHappenedChange,
    onSave,
    onClear,
    section = 'all',
    outcomeRecorded = false,
  } = props;
  // The parent initializes this draft from the saved receipt. Using `||` here
  // made an intentionally-cleared input snap back to the stored value.
  const visibleWhatHappened = whatHappened;
  const showAnchor = section !== 'outcome';
  const showOutcome = section !== 'anchor';
  const hasSavedContext = !!(
    receipt.real_question?.trim()
    || receipt.unverified_assumption?.trim()
    || receipt.human_only?.trim()
  );

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden text-[13px] leading-[1.6]">
      {showAnchor && (
        <>
          <div className="px-4 py-2.5 bg-[var(--surface)] border-b border-[var(--border)]">
            <p className="text-[12.5px] text-[var(--text-muted)]">
              {L(`${sealedOn}에 기록한 판단`, `Decision saved on ${sealedOn}`)}
            </p>
          </div>

          {receipt.human_judgment && (
            <div className="px-4 py-3 bg-[var(--surface)]">
              <p className="text-[12.5px] text-[var(--text-tertiary)] mb-1">
                {L('그때 당신이 내린 판단', 'Your judgment then')}
              </p>
              <p className="text-[14px] leading-[1.55] text-[var(--text-primary)] font-medium" style={{ fontFamily: 'var(--font-voice, serif)' }}>
                &ldquo;{receipt.human_judgment}&rdquo;
              </p>
              <JudgmentAttributionLine
                attribution={receipt.judgment_attribution}
                locale={props.locale}
                className="mt-2"
              />
            </div>
          )}

          {hasSavedContext && (
            <details className="group border-t border-[var(--border)]">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <span>{L('그날의 질문과 가정도 보기', 'See the question and assumptions saved that day')}</span>
                <span aria-hidden className="text-[var(--text-tertiary)] transition-transform group-open:rotate-45">+</span>
              </summary>
              <div className="border-t border-[var(--border)] bg-[var(--bg)]/45 px-4 py-3 space-y-3">
                {receipt.real_question && (
                  <div>
                    <p className="text-[12.5px] text-[var(--text-tertiary)] mb-1">
                      {L('그때의 진짜 질문', 'The real question then')}
                    </p>
                    <p className="text-[var(--text-primary)] font-medium" style={{ fontFamily: 'var(--font-voice, serif)' }}>
                      &ldquo;{receipt.real_question}&rdquo;
                    </p>
                  </div>
                )}
                {receipt.unverified_assumption && (
                  <div>
                    <p className="text-[12.5px] text-[var(--text-tertiary)] mb-1">
                      {L('그때 검증되지 않았던 가정', 'The unverified assumption then')}
                    </p>
                    <p className="text-[var(--text-secondary)]">{receipt.unverified_assumption}</p>
                  </div>
                )}
                {receipt.human_only && (
                  <div>
                    <p className="text-[12.5px] text-[var(--text-tertiary)] mb-1">
                      {L('사람이 직접 판단하기로 한 것', 'What remained yours to judge')}
                    </p>
                    <p className="text-[var(--text-secondary)]">{receipt.human_only}</p>
                  </div>
                )}
              </div>
            </details>
          )}
        </>
      )}

      {showOutcome && (
        <div className={`px-4 py-3 ${showAnchor ? 'border-t border-[var(--border)]' : ''}`}>
          <p className="text-[12.5px] text-[var(--text-tertiary)] mb-1">
            {outcomeRecorded
              ? L('선택 사항 · 실제로 일어난 일', 'Optional · what actually happened')
              : L('선택 사항 · 결과와 함께 남길 한 줄', 'Optional · one line to keep with your outcome')}
          </p>
          <p className="mb-2 text-[12.5px] leading-[1.45] text-[var(--text-muted)]">
            {outcomeRecorded
              ? L('결과 선택은 이미 저장됐어요. 나중에 기억할 구체적인 사실이 있다면 덧붙이세요.', 'Your outcome choice is already saved. Add a concrete fact only if it will help later.')
              : L('이 메모는 필수가 아니에요. 결과 선택만으로도 기록은 남습니다.', 'This note is not required. The outcome tap is enough to keep the record.')}
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              aria-label={L('실제로 일어난 일', 'What actually happened')}
              value={visibleWhatHappened}
              onChange={(e) => onWhatHappenedChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing && visibleWhatHappened.trim() && onSave) {
                  onSave(visibleWhatHappened.trim());
                }
              }}
              placeholder={L('예: 2주차 재방문율은 24%였다', 'For example: week-two retention was 24%')}
              maxLength={280}
              className="min-w-0 flex-1 text-[13px] px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
            {onSave && visibleWhatHappened.trim() && visibleWhatHappened.trim() !== (receipt.what_happened || '').trim() && (
              <button
                type="button"
                onClick={() => onSave(visibleWhatHappened.trim())}
                className="min-h-11 px-3 py-2 rounded-lg text-[12px] font-medium border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-colors shrink-0"
              >
                {L('저장', 'Save')}
              </button>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] font-semibold tracking-[0.12em] text-[var(--text-tertiary)]">
            <span>WHAT HAPPENED -- {visibleWhatHappened.trim() || (ko ? '비어 있음' : 'EMPTY')}</span>
            <span>AI VERDICT -- NONE</span>
          </div>
          {onClear && receipt.what_happened?.trim() && (
            <button
              type="button"
              onClick={onClear}
              className="mt-2 text-[12.5px] text-[var(--text-tertiary)] underline underline-offset-2 hover:text-[var(--danger)] cursor-pointer transition-colors"
            >
              {L('이 메모 지우기', 'Remove this note')}
            </button>
          )}
          <p className="mt-2 text-[12.5px] leading-[1.5] text-[var(--text-tertiary)]">
            {L('처음 기록한 판단과 확인일에 실제로 일어난 일이 같은 기록에 함께 남습니다.', 'Your initial decision and what actually happened on the review date stay together in this record.')}
          </p>
        </div>
      )}
    </div>
  );
}
