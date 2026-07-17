'use client';

import { useState } from 'react';
import { BookOpen, Check, ChevronDown, ChevronUp, Edit3, EyeOff, Pause, Scale } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { ClaimReviewCardProjection } from '@/lib/epistemic/patterns-projection';
import type { E3BReviewActionInput } from '@/lib/epistemic/server-review';

export function ClaimReviewCard({
  card,
  locale,
  busy,
  onAction,
  onLater,
}: {
  card: ClaimReviewCardProjection;
  locale: 'ko' | 'en';
  busy: boolean;
  onAction: (action: E3BReviewActionInput) => void;
  onLater: () => void;
}) {
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [wording, setWording] = useState(card.statement);

  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
      <div className="grid md:grid-cols-[8px_1fr]">
        <div aria-hidden className="bg-[var(--accent)]" />
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-[var(--text-tertiary)] uppercase">
              <Scale size={14} className="text-[var(--accent)]" />
              {L('검토할 표현', 'Wording to review')}
            </div>
            <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)]">
              {L(`독립된 해결 사례 ${card.sources.length}건`, `${card.sources.length} independent resolved cases`)}
            </span>
          </div>

          <p className="mt-4 text-[18px] font-semibold leading-8 text-[var(--text-primary)]">
            “{card.statement}”
          </p>
          <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">
            {L(
              `기록은 ${card.scope.domains.join(', ')} 범위에서 이 표현을 뒷받침합니다. 성격 진단이나 모든 상황의 규칙은 아닙니다.`,
              `The record supports this wording within ${card.scope.domains.join(', ')}. It is not a personality diagnosis or a rule for every situation.`,
            )}
          </p>

          <button
            type="button"
            className="mt-4 flex w-full items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg)] px-4 py-3 text-left text-[13px] font-semibold text-[var(--text-primary)] hover:border-[var(--border)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            aria-expanded={evidenceOpen}
            onClick={() => setEvidenceOpen((open) => !open)}
          >
            <span className="flex items-center gap-2"><BookOpen size={15} />{L('근거·반례·적용 범위 보기', 'Inspect sources, counterexamples, and scope')}</span>
            {evidenceOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {evidenceOpen && (
            <div className="mt-3 grid gap-4 rounded-xl border border-[var(--border-subtle)] p-4 lg:grid-cols-2">
              <section aria-labelledby={`${card.claim_id}-sources`}>
                <h3 id={`${card.claim_id}-sources`} className="text-[12px] font-bold text-[var(--text-primary)]">
                  {L('관찰과 출처', 'Observations and sources')}
                </h3>
                <ol className="mt-2 grid gap-2">
                  {card.sources.map((source, index) => (
                    <li key={source.support_unit_id} className="rounded-lg bg-[var(--bg)] p-3 text-[12px] leading-5 text-[var(--text-secondary)]">
                      <p className="font-semibold text-[var(--text-primary)]">{L(`해결 사례 ${index + 1}`, `Resolved case ${index + 1}`)}</p>
                      {source.drilldown ? <>
                        <div className="mt-2 border-l-2 border-[var(--accent)]/40 pl-2">
                          <p className="font-semibold text-[var(--text-primary)]">{L('당시 관찰', 'Observation then')}</p>
                          <p>{source.drilldown.observation.excerpt}</p>
                          <p className="mt-1 break-all text-[10px] text-[var(--text-tertiary)]">{source.drilldown.observation.event_id} · {source.drilldown.observation.occurred_at}</p>
                        </div>
                        <div className="mt-2 border-l-2 border-[var(--primary)]/40 pl-2">
                          <p className="font-semibold text-[var(--text-primary)]">{L('나중의 정산', 'Resolution later')}</p>
                          <p>{source.drilldown.resolution.excerpt}</p>
                          <p className="mt-1 break-all text-[10px] text-[var(--text-tertiary)]">{source.drilldown.resolution.event_id} · {source.drilldown.resolution.occurred_at}</p>
                        </div>
                      </> : <>
                        <p className="mt-1 break-all">{L('관찰', 'Observation')}: {source.observation_ref}</p>
                        <p className="break-all">{L('정산', 'Resolution')}: {source.resolution_event_ref}</p>
                      </>}
                      <p className="break-all">{L('출처 묶음', 'Source cluster')}: {source.source_cluster_id}</p>
                    </li>
                  ))}
                </ol>
              </section>
              <section aria-labelledby={`${card.claim_id}-limits`}>
                <h3 id={`${card.claim_id}-limits`} className="text-[12px] font-bold text-[var(--text-primary)]">
                  {L('반례와 한계', 'Counterexamples and limits')}
                </h3>
                <div className="mt-2 grid gap-2">
                  {card.counterexamples.map((counterexample) => (
                    <div key={counterexample.counterexample_ref} className="rounded-lg border border-[var(--border-subtle)] p-3 text-[12px] leading-5 text-[var(--text-secondary)]">
                      <p className="text-[var(--text-primary)]">{counterexample.observation}</p>
                      <p className="mt-1 break-all text-[var(--text-tertiary)]">{L('출처', 'Source')}: {counterexample.counterexample_ref}</p>
                    </div>
                  ))}
                  {(locale === 'ko' ? card.limitations : card.limitations_en).map((limitation) => (
                    <p key={limitation} className="flex gap-2 text-[12px] leading-5 text-[var(--text-secondary)]">
                      <span aria-hidden>—</span><span>{limitation}</span>
                    </p>
                  ))}
                </div>
              </section>
            </div>
          )}

          <div className="mt-5 border-t border-[var(--border-subtle)] pt-5">
            <p className="text-[15px] font-semibold text-[var(--text-primary)]">{locale === 'ko' ? card.review_question : card.review_question_en}</p>
            {editing && (
              <label className="mt-3 grid gap-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">
                {L('내 말로 고치기', 'Rewrite in my words')}
                <textarea
                  value={wording}
                  onChange={(event) => setWording(event.target.value)}
                  rows={3}
                  maxLength={2_000}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-[14px] font-normal leading-6 text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                />
              </label>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="accent" disabled={busy} onClick={() => onAction({ kind: 'endorse', claim_id: card.claim_id })}>
                <Check size={14} />{L('맞음', 'Fits')}
              </Button>
              {!editing ? (
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => setEditing(true)}>
                  <Edit3 size={14} />{L('표현 고치기', 'Edit wording')}
                </Button>
              ) : (
                <Button size="sm" variant="secondary" disabled={busy || !wording.trim() || wording.trim() === card.statement} onClick={() => {
                  onAction({ kind: 'reword', claim_id: card.claim_id, wording: wording.trim() });
                  setEditing(false);
                }}>
                  <Check size={14} />{L('고친 표현 저장', 'Save revised wording')}
                </Button>
              )}
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => onAction({
                kind: 'contest',
                claim_id: card.claim_id,
                reason: L('이 표현은 현재의 나와 맞지 않는다.', 'This wording does not fit who I am now.'),
              })}>
                <EyeOff size={14} />{L('아님', 'Does not fit')}
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={onLater}>
                <Pause size={14} />{L('나중에', 'Later')}
              </Button>
            </div>
            <p className="mt-3 text-[11px] leading-5 text-[var(--text-tertiary)]">
              {L('여기서 ‘맞음’을 눌러도 미래 AI에 반영되지 않습니다. 영향 허용은 검토가 끝난 뒤 별도 단계입니다.', 'Choosing “Fits” does not affect future AI. Influence is a separate step after review.')}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
