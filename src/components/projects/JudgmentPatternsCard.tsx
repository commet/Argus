'use client';

/**
 * 판단 패턴 카드 — 세되, 판정하지 않는다 (2026-07-30, 기획 4단계 기본형).
 *
 * 이 카드가 보여주는 것은 전부 **기록에 대한 사실**이다:
 *   · 같은 전제 위에 선 결정들 (연결)
 *   · 오래 열려 있는 미결 질문 (잔량)
 *   · 전제 없이 봉인된 결정 (빈칸 — 지우지 않고 센다)
 *
 * 사람에 대한 평결(성향·점수·습관)은 여기 없고, 앞으로도 이 카드에 못 들어온다
 * — judgment-patterns.test.ts 가 lib 코드의 어휘까지 감시한다 (스파인 2항).
 *
 * 보여줄 사실이 없으면 **아무것도 그리지 않는다.** 빈 패턴 카드는 "아직 패턴이
 * 없다"는 판정처럼 읽힌다 — 침묵이 정직하다.
 */

import { useMemo, useState } from 'react';
import { GitBranch, CircleHelp, FileQuestion } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { judgmentPatternFacts, type PatternDecision } from '@/lib/judgment-patterns';
import { isBaselineOnlyContract } from '@/lib/decision-contract';
import type { DecisionItem } from '@/lib/decision-items';
import type { Project } from '@/stores/types';
import { track } from '@/lib/analytics';

export function JudgmentPatternsCard({ projects, items, locale, onSelectDecision }: {
  projects: Project[];
  items: DecisionItem[];
  locale: string;
  onSelectDecision?: (decisionId: string) => void;
}) {
  const ko = locale === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);
  const [expanded, setExpanded] = useState(false);

  const facts = useMemo(() => {
    const decisions: PatternDecision[] = (projects ?? [])
      .filter((p) => p.decision_contract)
      .map((p) => ({
        id: p.id,
        name: typeof p.name === 'string' ? p.name : '',
        sealed: !isBaselineOnlyContract(p.decision_contract),
      }));
    return judgmentPatternFacts(decisions, items, Date.now());
  }, [projects, items]);

  const nameOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects ?? []) m.set(p.id, typeof p.name === 'string' ? p.name : '');
    return m;
  }, [projects]);

  const hasAnything = facts.shared.length > 0 || facts.questions.length > 0 || facts.bare.length > 0;
  if (!hasAnything) return null;
  const sharedVisible = expanded ? facts.shared : facts.shared.slice(0, 3);
  const questionsVisible = expanded ? facts.questions : facts.questions.slice(0, 3);
  const bareVisible = expanded ? facts.bare : facts.bare.slice(0, 2);
  const hiddenCount = (facts.shared.length - sharedVisible.length)
    + (facts.questions.length - questionsVisible.length)
    + (facts.bare.length - bareVisible.length);
  const openDecision = (decisionId: string, kind: 'shared_premise' | 'open_question' | 'missing_premise', linkedDecisions = 1) => {
    if (!onSelectDecision) return;
    // The compounding-value signal contains shape only. Decision names,
    // questions, and premises remain in the user's record, never analytics.
    track('record_connection_opened', { kind, linked_decisions: linkedDecisions });
    onSelectDecision(decisionId);
  };

  return (
    <Card>
      <h3 className="text-[14px] font-bold text-[var(--text-primary)]">
        {L('기록이 보여주는 것', 'What the record shows')}
      </h3>
      <p className="mt-0.5 text-[12px] text-[var(--text-tertiary)]">
        {L('기록에서 확인된 연결만 모았어요. 해석이나 평가는 덧붙이지 않았어요.', 'Only connections present in the record are shown. No interpretation or rating was added.')}
      </p>

      {facts.shared.length > 0 && (
        <div className="mt-4">
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--text-secondary)]">
            <GitBranch size={13} className="text-[var(--accent)]" />
            {L('같은 전제 위에 선 결정들', 'Decisions standing on the same premise')}
          </p>
          <ul className="mt-2 space-y-2">
            {sharedVisible.map((g) => (
              <li key={g.text} className="rounded-lg bg-[var(--accent)]/[0.04] px-3.5 py-2.5">
                <p className="text-[13px] leading-[1.5] text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-voice, serif)' }}>
                  &ldquo;{g.text}&rdquo;
                </p>
                <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                  {L(`결정 ${g.decisionIds.length}건이 이 전제 위에 있어요`, `${g.decisionIds.length} decisions rest on this`)}
                  {' · '}
                  {g.decisionIds.slice(0, 2).map((id, index) => {
                    const name = nameOf.get(id);
                    if (!name) return null;
                    return (
                      <span key={id}>
                        {index > 0 && <span aria-hidden> · </span>}
                        <button
                          type="button"
                          onClick={() => openDecision(id, 'shared_premise', g.decisionIds.length)}
                          disabled={!onSelectDecision}
                          className="underline decoration-[var(--border)] underline-offset-2 hover:text-[var(--accent)] hover:decoration-[var(--accent)] disabled:no-underline disabled:cursor-default"
                        >{name.slice(0, 18)}</button>
                      </span>
                    );
                  })}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11.5px] text-[var(--text-tertiary)]">
            {L('이 전제가 움직이면 위 결정들이 같이 흔들려요 — 그래서 나란히 보여드려요.', 'If this premise moves, these decisions move together — that is why they are shown side by side.')}
          </p>
        </div>
      )}

      {facts.questions.length > 0 && (
        <div className="mt-4">
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--text-secondary)]">
            <CircleHelp size={13} className="text-[var(--accent)]" />
            {L('아직 답하지 않은 질문', 'Questions still open')}
          </p>
          <ul className="mt-2 space-y-1.5">
            {questionsVisible.map((q) => (
              <li key={`${q.decisionId}:${q.text}`} className="flex items-start justify-between gap-3 text-[12.5px] leading-[1.5] text-[var(--text-secondary)]">
                <span>{q.text}
                <span className="text-[var(--text-tertiary)]">
                  {' · '}{L(`${q.openForDays}일째 열려 있어요`, `open for ${q.openForDays} days`)}
                </span></span>
                {onSelectDecision && (
                  <button type="button" onClick={() => openDecision(q.decisionId, 'open_question')} className="shrink-0 font-semibold text-[var(--accent)] hover:underline underline-offset-2">
                    {L('결정 열기', 'Open')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {facts.bare.length > 0 && (
        <div className="mt-4">
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--text-secondary)]">
            <FileQuestion size={13} className="text-[var(--accent)]" />
            {L('전제 없이 봉인된 결정', 'Sealed without recorded premises')}
          </p>
          <p className="mt-1.5 text-[12.5px] leading-[1.5] text-[var(--text-secondary)]">
            {bareVisible.map((d, index) => d.name && (
              <span key={d.id}>
                {index > 0 && <span aria-hidden> · </span>}
                <button
                  type="button"
                  onClick={() => openDecision(d.id, 'missing_premise')}
                  disabled={!onSelectDecision}
                  className="underline decoration-[var(--border)] underline-offset-2 hover:text-[var(--accent)] hover:decoration-[var(--accent)] disabled:no-underline disabled:cursor-default"
                >{d.name.slice(0, 22)}</button>
              </span>
            ))}
          </p>
          <p className="mt-1 text-[11.5px] text-[var(--text-tertiary)]">
            {L('무엇 위에 서 있는지가 적히지 않았어요 — 확인일에 물어볼 거리가 그만큼 적어요.', 'What these rest on was not recorded — there is that much less to check on the return date.')}
          </p>
        </div>
      )}

      {(hiddenCount > 0 || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className="mt-4 min-h-11 w-full border-t border-[var(--border-subtle)] pt-3 text-left text-[12.5px] font-semibold text-[var(--accent)] hover:underline underline-offset-2 sm:min-h-0"
        >
          {expanded
            ? L('기록 접기', 'Show less')
            : L(`나머지 ${hiddenCount}건 보기`, `Show ${hiddenCount} more`)}
        </button>
      )}
    </Card>
  );
}
