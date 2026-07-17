'use client';

import { useMemo, useState } from 'react';
import { Ban, KeyRound, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { ClaimReviewCardProjection } from '@/lib/epistemic/patterns-projection';
import type { E3BReviewActionInput } from '@/lib/epistemic/server-review';
import type { InfluenceEffect, InfluenceSurface } from '@/lib/epistemic/domain/types';

export function InfluenceGrantPanel({
  claim,
  locale,
  busy,
  onAction,
}: {
  claim: ClaimReviewCardProjection;
  locale: 'ko' | 'en';
  busy: boolean;
  onAction: (action: E3BReviewActionInput) => void;
}) {
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const [effect, setEffect] = useState<InfluenceEffect>('retrieve_only');
  const [surfaces, setSurfaces] = useState<InfluenceSurface[]>(['web']);
  const [domain, setDomain] = useState(claim.scope.domains[0] ?? '');
  const [duration, setDuration] = useState<'30' | '90' | 'none'>('90');
  const expiresAt = useMemo(() => {
    if (duration === 'none') return undefined;
    const next = new Date();
    next.setUTCDate(next.getUTCDate() + Number(duration));
    return next.toISOString();
  }, [duration]);

  const toggleSurface = (surface: InfluenceSurface) => {
    setSurfaces((current) => current.includes(surface)
      ? current.filter((item) => item !== surface)
      : [...current, surface]);
  };

  return (
    <section className="relative mt-5 rounded-2xl border border-dashed border-[var(--accent)]/60 bg-[var(--accent)]/[0.035] p-5" aria-labelledby={`${claim.claim_id}-grant-title`}>
      <div aria-hidden className="absolute -top-5 left-7 h-5 border-l border-dashed border-[var(--accent)]/60" />
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl bg-[var(--accent)]/10 p-2 text-[var(--accent)]"><KeyRound size={17} /></div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold tracking-[0.16em] text-[var(--accent)] uppercase">{L('별도 권한', 'Separate permission')}</p>
          <h3 id={`${claim.claim_id}-grant-title`} className="mt-1 text-[16px] font-bold text-[var(--text-primary)]">
            {L('미래 AI가 이 기억을 어떻게 다뤄도 될까요?', 'How may future AI use this memory?')}
          </h3>
          <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
            {L('아무것도 선택하지 않으면 검토한 기록으로만 남습니다. 허용은 언제든 즉시 철회할 수 있습니다.', 'Without this permission it remains a reviewed record only. You can revoke permission at any time.')}
          </p>

          <fieldset className="mt-4 grid gap-2">
            <legend className="mb-1 text-[12px] font-bold text-[var(--text-primary)]">{L('영향 방식', 'Influence mode')}</legend>
            {([
              ['retrieve_only', L('기억만', 'Remember only'), L('내가 과거 기록을 요청할 때만 출처와 함께 찾습니다.', 'Retrieve it with sources only when I ask for past records.')],
              ['ask_once', L('관련될 때 질문', 'Ask when relevant'), L('사실로 전제하지 않고 중립 질문 한 번만 합니다.', 'Ask one neutral question without treating it as fact.')],
              ['adapt_generation', L('이 범위 생성에 반영', 'Apply within this scope'), L('하나의 후보 렌즈로만 추가하며 추천 순서를 바꾸지 않습니다.', 'Add it as one candidate lens without changing recommendation order.')],
            ] as const).map(([value, label, description]) => (
              <label key={value} className={`cursor-pointer rounded-xl border p-3 transition-colors ${effect === value ? 'border-[var(--accent)] bg-[var(--surface)]' : 'border-[var(--border-subtle)]'}`}>
                <span className="flex gap-2">
                  <input type="radio" name={`${claim.claim_id}-effect`} value={value} checked={effect === value} onChange={() => setEffect(value)} className="mt-1 accent-[var(--accent)]" />
                  <span><span className="block text-[13px] font-semibold text-[var(--text-primary)]">{label}</span><span className="mt-0.5 block text-[11px] leading-5 text-[var(--text-secondary)]">{description}</span></span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <fieldset>
              <legend className="text-[12px] font-bold text-[var(--text-primary)]">{L('허용할 표면', 'Allowed surfaces')}</legend>
              <div className="mt-2 flex flex-wrap gap-3">
                {(['web', 'mcp', 'plugin'] as const).map((surface) => (
                  <label key={surface} className="flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
                    <input type="checkbox" checked={surfaces.includes(surface)} onChange={() => toggleSurface(surface)} className="accent-[var(--accent)]" />{surface}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="grid gap-1.5 text-[12px] font-bold text-[var(--text-primary)]">
              {L('만료', 'Expires')}
              <select value={duration} onChange={(event) => setDuration(event.target.value as typeof duration)} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] font-normal">
                <option value="30">{L('30일 뒤', 'In 30 days')}</option>
                <option value="90">{L('90일 뒤', 'In 90 days')}</option>
                <option value="none">{L('만료 없음', 'No expiry')}</option>
              </select>
            </label>
          </div>
          <label className="mt-4 grid gap-1.5 text-[12px] font-bold text-[var(--text-primary)]">
            {L('적용 도메인', 'Domain scope')}
            <input value={domain} onChange={(event) => setDomain(event.target.value)} maxLength={200} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] font-normal" />
          </label>

          <Button className="mt-4" variant="accent" size="sm" disabled={busy || surfaces.length === 0 || !domain.trim()} onClick={() => onAction({
            kind: 'grant', claim_id: claim.claim_id, effect, surfaces,
            scope: { domain: domain.trim() }, expires_at: expiresAt,
          })}>
            <ShieldCheck size={14} />{L('이 범위만 허용', 'Allow only this scope')}
          </Button>

          {claim.active_grants.length > 0 && (
            <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
              <h4 className="text-[12px] font-bold text-[var(--text-primary)]">{L('현재 활성 권한', 'Active permissions')}</h4>
              <ul className="mt-2 grid gap-2">
                {claim.active_grants.map((grant) => (
                  <li key={grant.grant_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--surface)] px-3 py-2 text-[11px] text-[var(--text-secondary)]">
                    <span>{grant.effect} · {grant.surfaces.join(', ')} · {grant.scope.domain ?? L('지정 범위', 'specified scope')}</span>
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => onAction({ kind: 'revoke', claim_id: claim.claim_id, grant_id: grant.grant_id })}>
                      <Ban size={13} />{L('철회', 'Revoke')}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
