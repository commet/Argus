'use client';

/**
 * Judgment Receipt — first screen (design doc §"UI는 많이 보여주기보다 증거로
 * 데려가기"). Shows only: Core Question, Reviewability, Top Judgment
 * Obligations, Top Findings, Applied lenses. Everything else is behind "펼쳐보기".
 *
 * The central click is "이 판단을 내가 소유하기" on an obligation — more
 * important than save/share/export. It never fills a verdict; the user owns it.
 */

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  type JudgmentReceipt,
  type Finding,
  type SourceAnchor,
  type JudgmentObligation,
  reviewabilityBand,
  receiptToMarkdown,
} from '@/lib/review';

const SEVERITY_STYLE: Record<Finding['severity'], { label: string; cls: string }> = {
  critical: { label: '치명', cls: 'text-red-700 bg-red-50 border-red-200' },
  caution: { label: '주의', cls: 'text-amber-700 bg-amber-50 border-amber-200' },
  minor: { label: '사소', cls: 'text-[var(--text-tertiary)] bg-[var(--bg)] border-[var(--border-subtle)]' },
};

const BAND_COPY: Record<ReturnType<typeof reviewabilityBand>, string> = {
  normal: '정상 검수',
  caveated: '주의사항과 함께 검수',
  limited: '제한적 검수',
  insufficient: '검수 가능성 낮음 — 부족한 맥락 우선',
};

function settlementLabel(outcome?: string): string {
  const map: Record<string, string> = {
    happened: '그렇게 됐다',
    avoided: '피했다 / 안 그랬다',
    partial: '부분적으로',
    unclear: '아직 불분명',
  };
  return outcome ? map[outcome] ?? outcome : '기록됨';
}

function anchorLabel(a?: SourceAnchor): string {
  if (!a) return '';
  if (a.slide !== undefined) return `슬라이드 ${a.slide}`;
  if (a.section_path?.length) return a.section_path.join(' › ');
  if (a.line_start !== undefined) return `L${a.line_start}`;
  return '';
}

const CLAIM_STATUS_LABEL: Record<string, string> = {
  supported: '근거 있음',
  weak: '근거 약함',
  unsupported: '근거 없음',
  human_check: '사람 확인',
  contradicted: '모순',
};

export function ReceiptView({
  receipt,
  onOwn,
  onSeal,
  onSettle,
  onReReview,
}: {
  receipt: JudgmentReceipt;
  onOwn?: (obligation: JudgmentObligation, owned: boolean) => void;
  onSeal?: (receipt: JudgmentReceipt) => void;
  onSettle?: (followupId: string) => void;
  /** "더 검증하기" — re-run the review (design doc §Receipt Summary 3 actions). */
  onReReview?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [showFixes, setShowFixes] = useState(false);
  const [claimFilter, setClaimFilter] = useState<string>('all');
  const band = reviewabilityBand(receipt.reviewability.score);
  const topFindings = receipt.findings.slice(0, 3);
  const topObligations = receipt.judgment_obligations.slice(0, 3);

  // "문서 수정안" — collected concrete fixes, never a full rewrite (§MVP 금지 10).
  const fixes = [
    ...receipt.claim_ledger.filter((c) => c.fix_suggestion).map((c) => ({ where: anchorLabel(c.anchors[0]) || c.text.slice(0, 24), text: c.fix_suggestion! })),
    ...receipt.findings.filter((f) => f.suggested_action).map((f) => ({ where: anchorLabel(f.anchors[0]) || f.title.slice(0, 24), text: f.suggested_action! })),
  ];
  const filteredClaims = claimFilter === 'all' ? receipt.claim_ledger : receipt.claim_ledger.filter((c) => c.status === claimFilter);
  const claimStatuses = Array.from(new Set(receipt.claim_ledger.map((c) => c.status)));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(receiptToMarkdown(receipt));
      setCopyState('ok');
    } catch {
      setCopyState('fail'); // clipboard blocked (sandboxed iframe / denied) — tell the user
    }
    setTimeout(() => setCopyState('idle'), 1800);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
            Judgment Receipt
          </div>
          <h2 className="text-[16px] font-bold text-[var(--text-primary)] truncate">{receipt.source_title}</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={copy}>
          {copyState === 'ok' ? '복사됨' : copyState === 'fail' ? '복사 실패' : '복사'}
        </Button>
      </div>

      {/* reviewability */}
      <Card variant={band === 'insufficient' ? 'danger' : band === 'limited' ? 'muted' : 'default'}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
            검수 가능성
          </span>
          <span className="text-[15px] font-bold text-[var(--text-primary)]">{receipt.reviewability.score}/100</span>
        </div>
        <div className="mt-1 text-[13px] text-[var(--text-secondary)]">{BAND_COPY[band]}</div>
        {receipt.reviewability.reasons.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {receipt.reviewability.reasons.slice(0, 3).map((r, i) => (
              <li key={i} className="text-[12px] text-[var(--text-tertiary)]">· {r}</li>
            ))}
          </ul>
        )}
        {receipt.profile.source_confidence < 0.5 && (
          <div className="mt-2 text-[11px] text-[var(--text-tertiary)]">
            문서 유형은 추론값입니다 (inferred).
          </div>
        )}
      </Card>

      {/* core question */}
      <Card variant="premium">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)] mb-1">핵심 판단</div>
        <p className="text-[15px] leading-[1.6] text-[var(--text-primary)]">{receipt.core_question}</p>
        {receipt.current_heading && (
          <p className="mt-2 text-[13px] leading-[1.6] text-[var(--text-secondary)]">{receipt.current_heading}</p>
        )}
      </Card>

      {/* judgment obligations */}
      {topObligations.length > 0 && (
        <Card variant="human">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b6914] mb-2">
            사람이 직접 판단해야 할 것
          </div>
          <div className="space-y-3">
            {topObligations.map((o) => (
              <div key={o.obligation_id} className="border-b border-[#8b6914]/10 last:border-0 pb-3 last:pb-0">
                <p className="text-[14px] font-medium text-[var(--text-primary)]">{o.statement}</p>
                {o.why_human && <p className="mt-1 text-[12px] text-[var(--text-secondary)]">왜 사람인가: {o.why_human}</p>}
                {o.evidence_needed && (
                  <p className="mt-0.5 text-[12px] text-[var(--text-tertiary)]">확인할 근거: {o.evidence_needed}</p>
                )}
                <div className="mt-2">
                  <Button
                    variant={o.owned_by_user ? 'secondary' : 'accent'}
                    size="sm"
                    onClick={() => onOwn?.(o, !o.owned_by_user)}
                  >
                    {o.owned_by_user ? '✓ 내가 소유한 판단' : '이 판단을 내가 소유하기'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* top findings */}
      {topFindings.length > 0 && (
        <Card>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)] mb-2">주요 발견</div>
          <div className="space-y-2.5">
            {topFindings.map((f) => (
              <FindingRow key={f.finding_id} f={f} />
            ))}
          </div>
        </Card>
      )}

      {/* applied lenses disclosure */}
      <div className="text-[12px] text-[var(--text-tertiary)] leading-[1.6]">{receipt.routing.disclosure}</div>

      {/* actions — up to 3 primary (design doc §Receipt Summary): own is on the
          obligation above; here: seal / 문서 수정안 / 더 검증하기 */}
      <div className="flex flex-wrap gap-2">
        {receipt.falsifiable_followups.length > 0 && onSeal && (
          <Button variant="primary" size="sm" onClick={() => onSeal(receipt)}>
            후속 예측 봉인하기
          </Button>
        )}
        {fixes.length > 0 && (
          <Button variant="secondary" size="sm" onClick={() => setShowFixes((v) => !v)}>
            {showFixes ? '수정안 접기' : `문서 수정안 보기 (${fixes.length})`}
          </Button>
        )}
        {onReReview && (
          <Button variant="ghost" size="sm" onClick={onReReview}>
            더 검증하기
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
          {expanded ? '접기' : '더 보기 (주장 원장 · 가정 · 후속)'}
        </Button>
      </div>

      {/* 문서 수정안 — concrete per-claim fixes, secondary to judgment review */}
      {showFixes && fixes.length > 0 && (
        <Card variant="muted">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)] mb-2">
            문서 수정안 (제안 — 판단은 당신의 몫)
          </div>
          <ul className="space-y-1.5">
            {fixes.map((f, i) => (
              <li key={i} className="text-[12px] text-[var(--text-primary)]">
                <span className="text-[var(--text-tertiary)]">{f.where}:</span> {f.text}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* expanded detail */}
      {expanded && (
        <div className="flex flex-col gap-4 pt-1">
          {receipt.claim_ledger.length > 0 && (
            <Card>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)] mb-2">주장 원장</div>
              {/* status filter (design doc §Claim Ledger) */}
              {claimStatuses.length > 1 && (
                <div className="flex flex-wrap gap-1 mb-2.5">
                  {['all', ...claimStatuses].map((st) => (
                    <button
                      key={st}
                      onClick={() => setClaimFilter(st)}
                      className={`px-2 py-0.5 text-[10px] rounded-full border ${
                        claimFilter === st
                          ? 'border-[var(--accent)] text-[var(--accent)]'
                          : 'border-[var(--border-subtle)] text-[var(--text-tertiary)]'
                      }`}
                    >
                      {st === 'all' ? '전체' : CLAIM_STATUS_LABEL[st] ?? st}
                    </button>
                  ))}
                </div>
              )}
              <div className="space-y-2.5">
                {filteredClaims.map((c) => (
                  <div key={c.claim_id} className="text-[13px] border-b border-[var(--border-subtle)] last:border-0 pb-2 last:pb-0">
                    <div>
                      <span className="inline-block px-1.5 py-0.5 mr-2 text-[10px] rounded border border-[var(--border-subtle)] text-[var(--text-tertiary)]">
                        {CLAIM_STATUS_LABEL[c.status] ?? c.status}
                      </span>
                      <span className="text-[var(--text-primary)]">{c.text}</span>
                      {anchorLabel(c.anchors[0]) && (
                        <span className="ml-1 text-[11px] text-[var(--text-tertiary)]">({anchorLabel(c.anchors[0])})</span>
                      )}
                    </div>
                    {c.evidence_needed && (
                      <p className="mt-1 text-[11px] text-[var(--text-secondary)]">확인할 근거: {c.evidence_needed}</p>
                    )}
                    {c.fix_suggestion && (
                      <p className="mt-0.5 text-[11px] text-[var(--accent)]">수정 제안: {c.fix_suggestion}</p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {receipt.hidden_assumptions.length > 0 && (
            <Card variant="muted">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)] mb-2">
                그대로 진행하면 위험한 가정
              </div>
              <ul className="space-y-1.5">
                {receipt.hidden_assumptions.map((a) => (
                  <li key={a.assumption_id} className="text-[13px] text-[var(--text-primary)]">
                    · {a.text}
                    {a.if_false && <span className="text-[var(--text-tertiary)]"> → 틀리면: {a.if_false}</span>}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {receipt.falsifiable_followups.length > 0 && (
            <Card>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)] mb-2">
                현실이 답할 후속 예측
              </div>
              <div className="space-y-3">
                {receipt.falsifiable_followups.map((f) => (
                  <div key={f.followup_id} className="text-[13px] border-b border-[var(--border-subtle)] last:border-0 pb-2.5 last:pb-0">
                    <p className="text-[var(--text-primary)]">{f.predicate}</p>
                    <p className="text-[11px] text-[var(--text-tertiary)]">
                      확인일 {f.check_by} · 맞음: {f.pass_condition || '—'} · 틀림: {f.fail_condition || '—'}
                      {f.predicate_owner === 'user' && ' · 내가 봉인함'}
                      {f.revise_count ? ` · ${f.revise_count}회 미룸` : ''}
                    </p>
                    {f.lean && <p className="mt-0.5 text-[11px] text-[#8b6914]">내 lean: {f.lean}</p>}
                    {f.key_assumption && <p className="text-[11px] text-[var(--text-tertiary)]">핵심 가정: {f.key_assumption}</p>}
                    {f.settled_at ? (
                      <p className="mt-1 text-[12px] text-green-700">
                        정산됨: {settlementLabel(f.outcome)}{f.what_happened ? ` — ${f.what_happened}` : ''}
                        {f.learned ? <span className="block text-[var(--text-secondary)]">배운 점: {f.learned}</span> : null}
                      </p>
                    ) : f.sealed_at && onSettle ? (
                      <div className="mt-1.5">
                        <Button variant="secondary" size="sm" onClick={() => onSettle(f.followup_id)}>
                          정산하기 (현실 기록)
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {receipt.findings.length > topFindings.length && (
            <Card>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)] mb-2">
                나머지 발견 ({receipt.findings.length - topFindings.length})
              </div>
              <div className="space-y-2.5">
                {receipt.findings.slice(3).map((f) => (
                  <FindingRow key={f.finding_id} f={f} />
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function FindingRow({ f }: { f: Finding }) {
  const sev = SEVERITY_STYLE[f.severity];
  return (
    <div className="border-b border-[var(--border-subtle)] last:border-0 pb-2.5 last:pb-0">
      <div className="flex items-start gap-2">
        <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded border ${sev.cls}`}>{sev.label}</span>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[var(--text-primary)]">
            {f.title}
            {anchorLabel(f.anchors[0]) && (
              <span className="ml-1 text-[11px] font-normal text-[var(--text-tertiary)]">({anchorLabel(f.anchors[0])})</span>
            )}
          </p>
          {f.detail && <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">{f.detail}</p>}
          {f.suggested_action && (
            <p className="mt-0.5 text-[12px] text-[var(--accent)]">확인: {f.suggested_action}</p>
          )}
        </div>
      </div>
    </div>
  );
}
