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
import { Share2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ShareComposer } from '@/components/ui/ShareComposer';
import { useLocale } from '@/hooks/useLocale';
import {
  type JudgmentReceipt,
  type Finding,
  type SourceAnchor,
  type JudgmentObligation,
  reviewabilityBand,
  receiptToMarkdown,
} from '@/lib/review';

type LFn = (ko: string, en: string) => string;

const SEVERITY_CLS: Record<Finding['severity'], string> = {
  critical: 'text-[var(--danger)] bg-[var(--danger)]/10 border-[var(--danger)]/25',
  caution: 'text-[var(--warning)] bg-[var(--warning)]/10 border-[var(--warning)]/30',
  minor: 'text-[var(--text-tertiary)] bg-[var(--bg)] border-[var(--border-subtle)]',
};

function severityLabel(sev: Finding['severity'], L: LFn): string {
  const map: Record<Finding['severity'], string> = {
    critical: L('치명', 'Critical'),
    caution: L('주의', 'Caution'),
    minor: L('사소', 'Minor'),
  };
  return map[sev];
}

function bandCopy(band: ReturnType<typeof reviewabilityBand>, L: LFn): string {
  const map: Record<ReturnType<typeof reviewabilityBand>, string> = {
    normal: L('정상 검수', 'Normal review'),
    caveated: L('주의사항과 함께 검수', 'Reviewed with caveats'),
    limited: L('제한적 검수', 'Limited review'),
    insufficient: L('검수 가능성 낮음 — 부족한 맥락 우선', 'Low reviewability — missing context comes first'),
  };
  return map[band];
}

function settlementLabel(L: LFn, outcome?: string): string {
  const map: Record<string, string> = {
    happened: L('그렇게 됐다', 'It happened'),
    avoided: L('피했다 / 안 그랬다', 'Avoided / did not happen'),
    partial: L('부분적으로', 'Partially'),
    unclear: L('아직 불분명', 'Still unclear'),
    missed: L('빗나갔다', 'Missed'),
  };
  return outcome ? map[outcome] ?? outcome : L('기록됨', 'Recorded');
}

function anchorLabel(L: LFn, a?: SourceAnchor, isImage = false): string {
  if (!a) return '';
  if (a.slide !== undefined) return L(`슬라이드 ${a.slide}`, `Slide ${a.slide}`);
  const sec = a.section_path?.length ? a.section_path.join(' › ') : '';
  // A single uploaded image has no pages — the vision pass anchors its findings
  // to "page 1", so render that as "이미지" instead of the awkward "1쪽". (A
  // future multi-image upload would keep the number: "이미지 2".)
  if (isImage && a.page !== undefined) {
    return a.page > 1 ? L(`이미지 ${a.page}`, `Image ${a.page}`) : L('이미지', 'Image');
  }
  // A PDF anchor carries a page; show it (with the section when we have one) so a
  // finding always points somewhere — a page-only anchor used to render blank.
  if (a.page !== undefined) return sec ? L(`${a.page}쪽 · ${sec}`, `p.${a.page} · ${sec}`) : L(`${a.page}쪽`, `p.${a.page}`);
  if (sec) return sec;
  if (a.line_start !== undefined) return `L${a.line_start}`;
  return '';
}

function claimStatusLabel(status: string, L: LFn): string {
  const map: Record<string, string> = {
    supported: L('근거 있음', 'Supported'),
    weak: L('근거 약함', 'Weak evidence'),
    unsupported: L('근거 없음', 'Unsupported'),
    human_check: L('사람 확인', 'Human check'),
    contradicted: L('모순', 'Contradicted'),
  };
  return map[status] ?? status;
}

export function ReceiptView({
  receipt,
  onSealObligation,
  onSettle,
  onReReview,
}: {
  receipt: JudgmentReceipt;
  /** Own & seal a judgment obligation into the DKK ledger (the single unified
   *  action — the former separate "own" toggle + "seal a follow-up" are merged). */
  onSealObligation?: (obligation: JudgmentObligation) => void;
  onSettle?: (followupId: string) => void;
  /** "더 검증하기" — re-run the review (design doc §Receipt Summary 3 actions). */
  onReReview?: () => void;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const [expanded, setExpanded] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [shareOpen, setShareOpen] = useState(false);
  const [showFixes, setShowFixes] = useState(false);
  const [claimFilter, setClaimFilter] = useState<string>('all');
  const isJudgmentMirror = receipt.kind === 'judgment' || receipt.root_mode === 'judgment';
  // A pure image review anchors to "page 1" — render its anchors as "이미지".
  const isImage = receipt.source_kind === 'image';
  const reviewability = receipt.reviewability;
  const band = reviewability ? reviewabilityBand(reviewability.score) : null;
  const topFindings = receipt.findings.slice(0, 3);
  const topObligations = receipt.judgment_obligations.slice(0, 3);

  // "문서 수정안" — collected concrete fixes, never a full rewrite (§MVP 금지 10).
  const fixes = [
    ...receipt.claim_ledger.filter((c) => c.fix_suggestion).map((c) => ({ where: anchorLabel(L, c.anchors[0], isImage) || c.text.slice(0, 24), text: c.fix_suggestion! })),
    ...receipt.findings.filter((f) => f.suggested_action).map((f) => ({ where: anchorLabel(L, f.anchors[0], isImage) || f.title.slice(0, 24), text: f.suggested_action! })),
  ];
  const filteredClaims = claimFilter === 'all' ? receipt.claim_ledger : receipt.claim_ledger.filter((c) => c.status === claimFilter);
  const claimStatuses = Array.from(new Set(receipt.claim_ledger.map((c) => c.status)));
  // claim_id → its 1-based number + text, so a claim's dependency links can be
  // shown as "C2" chips (the argument's load-bearing structure).
  const claimNumById = new Map(receipt.claim_ledger.map((c, i) => [c.claim_id, i + 1] as const));
  const claimTextById = new Map(receipt.claim_ledger.map((c) => [c.claim_id, c.text] as const));

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
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={copy}>
            {copyState === 'ok' ? L('복사됨', 'Copied') : copyState === 'fail' ? L('복사 실패', 'Copy failed') : L('복사', 'Copy')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShareOpen(true)}>
            <Share2 size={13} />
            {L('공유', 'Share')}
          </Button>
        </div>
      </div>
      <ShareComposer
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        getText={() => receiptToMarkdown(receipt)}
        getTitle={() => receipt.source_title || L('판단 영수증', 'Judgment receipt')}
        shareContext="review_receipt"
      />

      {/* coverage — honest disclosure BEFORE the findings: this receipt only
          covers part of the source, so it must not read as a full review. */}
      {receipt.coverage && receipt.coverage.band !== 'full' && receipt.coverage.notes.length > 0 && (
        <Card variant={receipt.coverage.band === 'low' ? 'danger' : 'muted'}>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--warning)] mb-1">
            {receipt.coverage.band === 'low' ? L('일부만 검수됨', 'Only partly reviewed') : L('부분 검수', 'Partial review')}
          </div>
          <ul className="space-y-0.5">
            {receipt.coverage.notes.map((n, i) => (
              <li key={i} className="text-[13px] text-[var(--text-primary)]">· {n}</li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] text-[var(--text-secondary)]">
            {L(
              '이 영수증은 위 범위에 한정된 판단입니다. 전체를 검수하려면 문서를 나눠 넣거나 핵심 부분을 붙여넣어 주세요.',
              'This receipt covers only the scope above. To review everything, split the document into pieces or paste the key section.',
            )}
          </p>
        </Card>
      )}

      {/* full-coverage confirmation — the flip side of the partial banner. After
          the "부분 검수" trauma, say plainly when the WHOLE document was read, but
          only for a document with real scope (skip tiny pastes). */}
      {receipt.coverage && receipt.coverage.band === 'full'
        && (receipt.coverage.pages_read || receipt.coverage.slides_read || receipt.coverage.units_total > 12) && (
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--success)]">
          <span aria-hidden>✓</span>
          <span>
            {(() => {
              const c = receipt.coverage!;
              const scope = c.pages_read
                ? L(`${c.pages_read}쪽`, `${c.pages_read} pages`)
                : c.slides_read
                  ? L(`${c.slides_read}장`, `${c.slides_read} slides`)
                  : L(`${c.units_total}개 항목`, `${c.units_total} items`);
              return L(`문서 전체를 검수했습니다 (${scope}).`, `Reviewed the entire document (${scope}).`);
            })()}
          </span>
        </div>
      )}

      {/* reviewability */}
      {!isJudgmentMirror && reviewability && band && (
      <Card variant={band === 'insufficient' ? 'danger' : band === 'limited' ? 'muted' : 'default'}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
            {L('검수 가능성', 'Reviewability')}
          </span>
          <span className="text-[15px] font-bold text-[var(--text-primary)]">{reviewability.score}/100</span>
        </div>
        <div className="mt-1 text-[13px] text-[var(--text-secondary)]">{bandCopy(band, L)}</div>
        {reviewability.reasons.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {reviewability.reasons.slice(0, 3).map((r, i) => (
              <li key={i} className="text-[12px] text-[var(--text-tertiary)]">· {r}</li>
            ))}
          </ul>
        )}
        {receipt.profile && receipt.profile.source_confidence < 0.5 && (
          <div className="mt-2 text-[11px] text-[var(--text-tertiary)]">
            {L('문서 유형은 추론값입니다 (inferred).', 'The document type is inferred, not declared.')}
          </div>
        )}
      </Card>
      )}

      {/* core question */}
      <Card variant="premium">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)] mb-1">{L('핵심 판단', 'Core judgment')}</div>
        <p className="text-[15px] leading-[1.6] text-[var(--text-primary)]">{receipt.core_question}</p>
        {receipt.current_heading && (
          <p className="mt-2 text-[13px] leading-[1.6] text-[var(--text-secondary)]">{receipt.current_heading}</p>
        )}
      </Card>

      {/* judgment obligations */}
      {topObligations.length > 0 && (
        <Card variant="human">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--human-fg)] mb-2">
            {L('사람이 직접 판단해야 할 것', 'What a human must judge')}
          </div>
          <div className="space-y-2.5">
            {topObligations.map((o) => (
              <ObligationRow key={o.obligation_id} o={o} onSealObligation={onSealObligation} isImage={isImage} />
            ))}
          </div>
        </Card>
      )}

      {/* top findings */}
      {topFindings.length > 0 && (
        <Card>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)] mb-2">{L('주요 발견', 'Key findings')}</div>
          <div className="space-y-2.5">
            {topFindings.map((f) => (
              <FindingRow key={f.finding_id} f={f} isImage={isImage} />
            ))}
          </div>
        </Card>
      )}

      {/* applied lenses disclosure */}
      {!isJudgmentMirror && receipt.routing && (
        <div className="text-[12px] text-[var(--text-tertiary)] leading-[1.6]">{receipt.routing.disclosure}</div>
      )}

      {/* actions — sealing now happens on an obligation above ("이 판단을 내가
          소유하기"), which owns + seals into the DKK ledger in one act. Here:
          문서 수정안 / 더 검증하기. */}
      <div className="flex flex-wrap gap-2">
        {fixes.length > 0 && (
          <Button variant="secondary" size="sm" onClick={() => setShowFixes((v) => !v)}>
            {showFixes
              ? L('수정안 접기', 'Hide suggested fixes')
              : L(`문서 수정안 보기 (${fixes.length})`, `View suggested fixes (${fixes.length})`)}
          </Button>
        )}
        {onReReview && (
          <Button variant="ghost" size="sm" onClick={onReReview}>
            {L('더 검증하기', 'Verify further')}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
          {expanded ? L('접기', 'Collapse') : L('더 보기 (주장 원장 · 가정 · 후속)', 'More (claim ledger · assumptions · follow-ups)')}
        </Button>
      </div>

      {/* 문서 수정안 — concrete per-claim fixes, secondary to judgment review */}
      {showFixes && fixes.length > 0 && (
        <Card variant="muted">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)] mb-2">
            {L('문서 수정안 (제안 — 판단은 당신의 몫)', 'Suggested fixes (suggestions — the judgment is yours)')}
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
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)] mb-2">{L('주장 원장', 'Claim ledger')}</div>
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
                      {st === 'all' ? L('전체', 'All') : claimStatusLabel(st, L)}
                    </button>
                  ))}
                </div>
              )}
              <div className="space-y-2.5">
                {filteredClaims.map((c) => (
                  <div key={c.claim_id} className="text-[13px] border-b border-[var(--border-subtle)] last:border-0 pb-2 last:pb-0">
                    <div>
                      <span className="inline-block px-1 py-0.5 mr-1 text-[10px] rounded border border-[var(--border-subtle)] text-[var(--text-tertiary)] tabular-nums">
                        C{claimNumById.get(c.claim_id)}
                      </span>
                      <span className="inline-block px-1.5 py-0.5 mr-2 text-[10px] rounded border border-[var(--border-subtle)] text-[var(--text-tertiary)]">
                        {claimStatusLabel(c.status, L)}
                      </span>
                      <span className="text-[var(--text-primary)]">{c.text}</span>
                      {anchorLabel(L, c.anchors[0], isImage) && (
                        <span className="ml-1 text-[11px] text-[var(--text-tertiary)]">({anchorLabel(L, c.anchors[0], isImage)})</span>
                      )}
                    </div>
                    {c.evidence_needed && (
                      <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{L('확인할 근거', 'Evidence to check')}: {c.evidence_needed}</p>
                    )}
                    {c.fix_suggestion && (
                      <p className="mt-0.5 text-[11px] text-[var(--accent)]">{L('수정 제안', 'Suggested fix')}: {c.fix_suggestion}</p>
                    )}
                    {c.depends_on_claim_ids && c.depends_on_claim_ids.length > 0 && (
                      <p className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
                        {L('기대는 논지', 'Rests on')}:{' '}
                        {c.depends_on_claim_ids
                          .map((id) => (claimNumById.has(id) ? { n: claimNumById.get(id)!, t: claimTextById.get(id) || '' } : null))
                          .filter((x): x is { n: number; t: string } => x !== null)
                          .map((x, i) => (
                            <span key={x.n} title={x.t}>
                              {i > 0 ? ', ' : ''}C{x.n}
                            </span>
                          ))}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {receipt.hidden_assumptions.length > 0 && (
            <Card variant="muted">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)] mb-2">
                {L('그대로 진행하면 위험한 가정', 'Assumptions risky to proceed on')}
              </div>
              <ul className="space-y-1.5">
                {receipt.hidden_assumptions.map((a) => (
                  <li key={a.assumption_id} className="text-[13px] text-[var(--text-primary)]">
                    · {a.text}
                    {a.if_false && <span className="text-[var(--text-tertiary)]"> → {L('틀리면', 'If wrong')}: {a.if_false}</span>}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {receipt.falsifiable_followups.length > 0 && (
            <Card>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)] mb-2">
                {L('현실이 답할 후속 예측', 'Follow-up predictions reality will answer')}
              </div>
              <div className="space-y-3">
                {receipt.falsifiable_followups.map((f) => (
                  <div key={f.followup_id} className="text-[13px] border-b border-[var(--border-subtle)] last:border-0 pb-2.5 last:pb-0">
                    <p className="text-[var(--text-primary)]">{f.predicate}</p>
                    <p className="text-[11px] text-[var(--text-tertiary)]">
                      {L(`확인일 ${f.check_by}`, `Check by ${f.check_by}`)} · {L('맞음', 'Pass')}: {f.pass_condition || '—'} · {L('틀림', 'Fail')}: {f.fail_condition || '—'}
                      {f.predicate_owner === 'user' && ` · ${L('내가 봉인함', 'Sealed by me')}`}
                      {f.revise_count ? ` · ${L(`${f.revise_count}회 미룸`, `Postponed ${f.revise_count} time${f.revise_count === 1 ? '' : 's'}`)}` : ''}
                      {f.first_check_by ? ` · ${L(`원래 ${f.first_check_by}`, `originally ${f.first_check_by}`)}` : ''}
                    </p>
                    {f.lean && <p className="mt-0.5 text-[11px] text-[var(--human-fg)]">{L('내 예상', 'My lean')}: {f.lean}</p>}
                    {f.key_assumption && <p className="text-[11px] text-[var(--text-tertiary)]">{L('핵심 가정', 'Key assumption')}: {f.key_assumption}</p>}
                    {/* why reality was still silent — returned so the next check-by
                        reminds the user WHY they pushed it, not just that time passed */}
                    {!f.settled_at && f.defer_reason && (
                      <p className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
                        {L('미룬 이유', 'Why postponed')}: {f.defer_reason}
                      </p>
                    )}
                    {f.settled_at ? (
                      <p className="mt-1 text-[12px] text-[var(--success)]">
                        {L('정산됨', 'Settled')}: {settlementLabel(L, f.outcome)}{f.what_happened ? ` — ${f.what_happened}` : ''}
                        {f.learned ? <span className="block text-[var(--text-secondary)]">{L('배운 점', 'What I learned')}: {f.learned}</span> : null}
                      </p>
                    ) : f.sealed_at && onSettle ? (
                      <div className="mt-1.5">
                        <Button variant="secondary" size="sm" onClick={() => onSettle(f.followup_id)}>
                          {L('정산하기 (현실 기록)', 'Settle (record reality)')}
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
                {L(
                  `나머지 발견 (${receipt.findings.length - topFindings.length})`,
                  `Remaining findings (${receipt.findings.length - topFindings.length})`,
                )}
              </div>
              <div className="space-y-2.5">
                {receipt.findings.slice(3).map((f) => (
                  <FindingRow key={f.finding_id} f={f} isImage={isImage} />
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

/** One judgment obligation — the decision stays visible; the "why / evidence"
 *  reasoning collapses so the card scans at a glance instead of stacking prose. */
function ObligationRow({
  o,
  onSealObligation,
  isImage = false,
}: {
  o: JudgmentObligation;
  onSealObligation?: (obligation: JudgmentObligation) => void;
  isImage?: boolean;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const [open, setOpen] = useState(false);
  const hasWhy = Boolean(o.why_human || o.evidence_needed);
  const sealed = Boolean(o.sealed_judgment_id);
  return (
    <div className="border-b border-[#8b6914]/10 last:border-0 pb-2.5 last:pb-0">
      <p className="text-[14px] font-medium leading-snug text-[var(--text-primary)]">
        {o.statement}
        {anchorLabel(L, o.anchors[0], isImage) && (
          <span className="ml-1 text-[11px] font-normal text-[var(--text-tertiary)]">({anchorLabel(L, o.anchors[0], isImage)})</span>
        )}
      </p>
      <div className="mt-2 flex items-center gap-2">
        {sealed ? (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-green-700">
            ✓ {L('내가 소유·봉인함 — 확인일에 정산', 'Owned & sealed — settle on the check-in date')}
          </span>
        ) : (
          <Button variant="accent" size="sm" onClick={() => onSealObligation?.(o)}>
            {L('이 판단을 내가 소유하기', 'Own this judgment')}
          </Button>
        )}
        {hasWhy && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          >
            {open ? L('접기', 'Less') : L('왜 사람인가 ▾', 'Why a human ▾')}
          </button>
        )}
      </div>
      {open && hasWhy && (
        <div className="mt-1.5 space-y-0.5">
          {o.why_human && <p className="text-[12px] text-[var(--text-secondary)]">{L('왜 사람인가', 'Why a human')}: {o.why_human}</p>}
          {o.evidence_needed && (
            <p className="text-[12px] text-[var(--text-tertiary)]">{L('확인할 근거', 'Evidence to check')}: {o.evidence_needed}</p>
          )}
        </div>
      )}
    </div>
  );
}

/** One finding — a scannable single line (severity · title · anchor); the detail
 *  and suggested action open on tap so the receipt reads at a glance. */
function FindingRow({ f, isImage = false }: { f: Finding; isImage?: boolean }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const [open, setOpen] = useState(false);
  const hasMore = Boolean(f.detail || f.suggested_action);
  return (
    <div className="border-b border-[var(--border-subtle)] last:border-0 pb-2 last:pb-0">
      <button
        type="button"
        onClick={() => hasMore && setOpen((v) => !v)}
        className={`w-full flex items-start gap-2 text-left ${hasMore ? 'cursor-pointer' : 'cursor-default'}`}
        aria-expanded={hasMore ? open : undefined}
      >
        <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded border ${SEVERITY_CLS[f.severity]}`}>{severityLabel(f.severity, L)}</span>
        <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-[var(--text-primary)]">
          {f.title}
          {anchorLabel(L, f.anchors[0], isImage) && (
            <span className="ml-1 text-[11px] font-normal text-[var(--text-tertiary)]">({anchorLabel(L, f.anchors[0], isImage)})</span>
          )}
        </span>
        {hasMore && <span className="shrink-0 mt-0.5 text-[10px] text-[var(--text-tertiary)]">{open ? '▲' : '▼'}</span>}
      </button>
      {open && hasMore && (
        <div className="mt-1 pl-8 space-y-0.5">
          {f.detail && <p className="text-[12px] text-[var(--text-secondary)]">{f.detail}</p>}
          {f.suggested_action && (
            <p className="text-[12px] text-[var(--accent)]">{L('확인', 'Check')}: {f.suggested_action}</p>
          )}
        </div>
      )}
    </div>
  );
}
