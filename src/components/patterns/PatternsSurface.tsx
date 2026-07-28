'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookMarked, Loader2, Scale } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useLocale } from '@/hooks/useLocale';
import { generateId } from '@/lib/uuid';
import type { ClaimReviewCardProjection, PublicPatternProjection } from '@/lib/epistemic/patterns-projection';
import type { E3BReviewActionInput, ServerReviewSnapshot } from '@/lib/epistemic/server-review';
import { ClaimReviewCard } from './ClaimReviewCard';
import { PatternCard } from './PatternCard';

interface ReviewResponse extends ServerReviewSnapshot {
  release_receipt_id: string;
}

export function PatternsSurface() {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const { session } = useAuth();
  const [snapshot, setSnapshot] = useState<ReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyClaim, setBusyClaim] = useState<string | null>(null);
  const [deferred, setDeferred] = useState<Set<string>>(() => new Set());
  const [readError, setReadError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.access_token) {
      setSnapshot(null);
      setReadError('UNAUTHENTICATED');
      setLoading(false);
      return false;
    }
    setLoading(true);
    setReadError(null);
    try {
      const response = await fetch('/api/epistemic/review', {
        headers: { authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      });
      const body = await response.json().catch(() => ({})) as ReviewResponse & { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'REVIEW_READ_FAILED');
      setSnapshot(body);
      return true;
    } catch (cause) {
      setSnapshot(null);
      setReadError(cause instanceof Error ? cause.message : 'REVIEW_READ_FAILED');
      return false;
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => { void load(); }, [load]);

  const act = useCallback(async (action: E3BReviewActionInput) => {
    if (!session?.access_token) return;
    setBusyClaim(action.claim_id);
    setMutationError(null);
    try {
      const response = await fetch('/api/epistemic/review', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ...action, action_id: generateId() }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'REVIEW_WRITE_FAILED');
      await load();
    } catch (cause) {
      setMutationError(cause instanceof Error ? cause.message : 'REVIEW_WRITE_FAILED');
    } finally {
      setBusyClaim(null);
    }
  }, [load, session?.access_token]);

  const reviewCards = useMemo<ClaimReviewCardProjection[]>(() =>
    (snapshot?.review_cards ?? []).filter((card) => !deferred.has(card.claim_id)),
  [deferred, snapshot?.review_cards]);
  const patterns = snapshot?.patterns ?? [];

  if (loading) return (
    <div className="flex min-h-[50vh] items-center justify-center gap-2 text-[13px] text-[var(--text-secondary)]">
      <Loader2 size={17} className="animate-spin" />{L('검토할 기록을 확인하는 중…', 'Checking records for review…')}
    </div>
  );

  if (readError || !snapshot) return (
    <div className="mx-auto flex min-h-[55vh] w-full max-w-2xl items-center px-4 py-12">
      <div role="alert" className="w-full rounded-2xl border border-[var(--risk-critical)]/30 bg-[var(--surface)] p-6 text-center">
        <AlertTriangle size={20} className="mx-auto text-[var(--risk-critical)]" />
        <h1 className="mt-3 text-[17px] font-bold text-[var(--text-primary)]">{L('기록을 불러오지 못했습니다.', 'Could not load your records.')}</h1>
        <p className="mt-2 text-[12px] leading-5 text-[var(--text-secondary)]">
          {readError === 'UNAUTHENTICATED'
            ? L('세션을 다시 확인한 뒤 로그인해 주세요.', 'Check your session and sign in again.')
            : L('빈 기록으로 표시하지 않았습니다. 연결을 확인한 뒤 다시 시도해 주세요.', 'Nothing was shown as empty. Check the connection and try again.')}
        </p>
        <button type="button" onClick={() => void load()} className="mt-4 rounded-lg border border-[var(--border)] px-3 py-2 text-[12px] font-semibold text-[var(--text-primary)]">
          {L('다시 불러오기', 'Try again')}
        </button>
        <p className="mt-3 font-mono text-[12px] text-[var(--text-tertiary)]">{readError}</p>
      </div>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="max-w-3xl">
        <p className="text-[12.5px] font-bold tracking-[0.17em] text-[var(--accent)] uppercase">{L('판단 패턴', 'Decision patterns')}</p>
        <h1 className="mt-3 text-[28px] font-bold leading-tight tracking-[-0.025em] text-[var(--text-primary)] sm:text-[36px]">
          {L('기록은 결론이 아니라, 내가 검토할 수 있는 표현입니다.', 'A record is not a verdict. It is wording I can review.')}
        </h1>
        <p className="mt-4 text-[14px] leading-7 text-[var(--text-secondary)]">
          {L('독립된 현실 사례와 반례를 먼저 보고, 표현을 채택할지 결정하세요. 미래 AI에 영향을 줄 권한은 그 다음에 별도로 정합니다.', 'Inspect independent real-world cases and counterexamples before adopting wording. Permission to affect future AI comes later, as a separate choice.')}
        </p>
      </header>

      {mutationError && (
        <div role="alert" className="mt-6 flex gap-2 rounded-xl border border-[var(--risk-critical)]/30 bg-[var(--risk-critical)]/5 p-4 text-[13px] text-[var(--text-primary)]">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--risk-critical)]" />
          <span>{L('변경을 반영하지 못했습니다. 기록은 바뀌지 않았습니다.', 'The change was not applied. The record is unchanged.')} <span className="font-mono text-[12.5px]">({mutationError})</span></span>
        </div>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-labelledby="patterns-review-heading">
          <div className="mb-4 flex items-center gap-2">
            <Scale size={17} className="text-[var(--accent)]" />
            <h2 id="patterns-review-heading" className="text-[15px] font-bold text-[var(--text-primary)]">{L('검토 대기', 'Awaiting review')}</h2>
            <span className="text-[12px] text-[var(--text-tertiary)]">{reviewCards.length}</span>
          </div>
          <div className="grid gap-4">
            {reviewCards.map((card) => (
              <ClaimReviewCard
                key={card.claim_id}
                card={card}
                locale={locale}
                busy={busyClaim === card.claim_id}
                onAction={act}
                onLater={() => setDeferred((current) => new Set(current).add(card.claim_id))}
              />
            ))}
            {reviewCards.length === 0 && <EmptyState locale={locale} kind="review" />}
          </div>
        </section>

        <section aria-labelledby="patterns-endorsed-heading">
          <div className="mb-4 flex items-center gap-2">
            <BookMarked size={17} className="text-[var(--primary)]" />
            <h2 id="patterns-endorsed-heading" className="text-[15px] font-bold text-[var(--text-primary)]">{L('내가 채택한 기록', 'Records I endorsed')}</h2>
            <span className="text-[12px] text-[var(--text-tertiary)]">{patterns.length}</span>
          </div>
          <div className="grid gap-4">
            {patterns.map((pattern: PublicPatternProjection) => (
              <PatternCard key={pattern.claim.claim_id} pattern={pattern} locale={locale} busy={busyClaim === pattern.claim.claim_id} onAction={act} />
            ))}
            {patterns.length === 0 && <EmptyState locale={locale} kind="patterns" />}
          </div>
        </section>
      </div>

      {snapshot && (
        <p className="mt-10 text-center font-mono text-[12px] text-[var(--text-tertiary)]">
          {L('검토 데이터 버전', 'Review data version')} · {snapshot.release_receipt_id}
        </p>
      )}
    </div>
  );
}

function EmptyState({ locale, kind }: { locale: 'ko' | 'en'; kind: 'review' | 'patterns' }) {
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-center">
      <p className="text-[13px] font-semibold text-[var(--text-primary)]">
        {kind === 'review' ? L('지금 검토할 표현이 없습니다.', 'There is no wording to review now.') : L('아직 채택한 기록이 없습니다.', 'You have not endorsed a record yet.')}
      </p>
      <p className="mt-1 text-[12.5px] leading-5 text-[var(--text-tertiary)]">
        {kind === 'review'
          ? L('독립된 해결 사례 3건과 출처가 갖춰진 후보만 여기에 옵니다.', 'Only candidates with three independent resolved cases and sources appear here.')
          : L('동의율을 높이는 것이 목적이 아닙니다. 맞는 표현만 남기세요.', 'A high agreement rate is not the goal. Keep only wording that fits.')}
      </p>
    </div>
  );
}
