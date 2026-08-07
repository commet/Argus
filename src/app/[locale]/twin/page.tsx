'use client';

/**
 * 분신의 집 — 누적을 보는 화면.
 *
 * PRODUCT-PLAN §4 가 웹에 준 역할이 "누적을 보는 집(획득 표면 아님)"인데,
 * 그 누적이 지금까지 설정 페이지의 접힌 details 안에 묻혀 있었다. 여기가 그 집이다.
 *
 * 화면의 중심은 **봉인된 예측**이다. 차트도 점수판도 아니다:
 * 열 수 없는 봉투 하나가 날짜를 달고 놓여 있고, 정산이 오면 스스로 열린다.
 * 그것이 이 제품에서 유일하게 다른 곳에 없는 물건이기 때문이다.
 *
 * 스파인 게이트 (CLAUDE.md, 모든 신규 사용자향 표면):
 * · 생성하는가 판정하는가 — 여기 있는 것은 (a) 사용자가 쓴 문장, (b) 분신의
 *   예측과 그 채점, (c) 개수뿐이다. **사용자를 채점하는 숫자는 없다.**
 * · 저자성 — AI 가 관찰한 프로필 항목은 근거 케이스 id 와 함께만 보이고,
 *   사용자가 쓴 위임 원문은 인용부호 안에 그의 말로 남는다.
 * · 과발화(거울 조항) — 이 화면은 **당김 표면**이다. 사용자가 걸어 들어와야
 *   보이고, 아무것도 밀지 않는다. 그것이 자제의 가장 강한 형태다.
 * · 봉인 — 정산 전 예측의 본문은 여기에도 오지 않는다. 서버가 조회조차 하지
 *   않으므로(api/twin/home) 이 화면이 실수로 흘릴 코드가 존재하지 않는다.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Lock, Loader2, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LocaleLink } from '@/components/ui/LocaleLink';
import { useLocale } from '@/hooks/useLocale';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { fetchTwinHome, type TwinHome } from '@/lib/api-account';
import { TWIN_SCORE_MIN_SAMPLE } from '@/lib/twin/store';

// ── 타입 (RLS 로 브라우저가 직접 읽는 것들) ──────────────────────────────
interface CaseRow {
  id: string;
  title: string | null;
  choice: string | null;
  last_observation: string | null;
  settled_at: string | null;
}
interface ProfileRow {
  id: string;
  layer: string;
  domain: string;
  content: string;
  evidence_case_ids: string[] | null;
  counterexamples: string[] | null;
  status: string;
}
interface DelegationRow {
  id: string;
  policy: string;
  scope_domain: string;
  user_words: string;
  expires_at: string;
  status: string;
  applications: number;
  supported: number;
  contradicted: number;
}

// ── 작은 조판 프리미티브 ──────────────────────────────────────────────────
// 코드베이스 최빈 관용구 그대로 (11px / semibold / tracking-[0.12em] / uppercase).
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[var(--text-tertiary)] mb-3">
      {children}
    </div>
  );
}

/** 비어 있음을 **설계한다** — 빈 div 는 "고장"으로 읽히고, 이 제품은 초반이 비어 있다. */
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] text-[var(--text-tertiary)] break-keep leading-relaxed">{children}</p>;
}

const TARGET_LABEL: Record<string, { ko: string; en: string }> = {
  outcome: { ko: '결과 예측', en: 'outcome' },
  choice: { ko: '선택 예측', en: 'choice' },
  deviation: { ko: '이탈 예측', en: 'deviation' },
};

export default function TwinPage() {
  const locale = useLocale();
  const ko = locale === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);
  const { user } = useAuth();

  const [home, setHome] = useState<TwinHome | null>(null);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [profile, setProfile] = useState<ProfileRow[]>([]);
  const [delegations, setDelegations] = useState<DelegationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const fmt = useCallback(
    (iso: string | null) =>
      iso ? new Date(iso).toLocaleDateString(ko ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric' }) : '',
    [ko],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      // 봉인만 서버를 거친다 (RLS 정책 0). 나머지는 본인 read 정책이 있어
      // 브라우저가 직접 읽는다 — 최소 권한이고, 이 비대칭이 제품의 이야기다.
      const [h, c, p, d] = await Promise.all([
        fetchTwinHome(),
        supabase.from('argus_cases').select('id, title, choice, last_observation, settled_at').order('updated_at', { ascending: false }).limit(50),
        supabase.from('argus_profile_items').select('id, layer, domain, content, evidence_case_ids, counterexamples, status').in('status', ['active', 'retired']).order('confidence', { ascending: false }).limit(20),
        supabase.from('argus_delegations').select('id, policy, scope_domain, user_words, expires_at, status, applications, supported, contradicted').neq('status', 'revoked').limit(20),
      ]);
      setHome(h);
      setCases((c.data ?? []) as CaseRow[]);
      setProfile((p.data ?? []) as ProfileRow[]);
      setDelegations((d.data ?? []) as DelegationRow[]);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { if (user) void load(); else setLoading(false); }, [user, load]);

  const caseById = useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases]);

  // 케이스별로 묶는다 — 사람은 예측 단위가 아니라 결정 단위로 기억한다.
  const sealedByCase = useMemo(() => {
    const m = new Map<string, { sealedAt: string; targets: string[]; late: boolean }>();
    for (const s of home?.sealed ?? []) {
      const cur = m.get(s.case_id) ?? { sealedAt: s.sealed_at, targets: [], late: false };
      cur.targets.push(s.target);
      if (s.status === 'late') cur.late = true;
      m.set(s.case_id, cur);
    }
    return [...m.entries()];
  }, [home]);

  const revealedByCase = useMemo(() => {
    const m = new Map<string, NonNullable<TwinHome['revealed']>>();
    for (const r of home?.revealed ?? []) {
      m.set(r.case_id, [...(m.get(r.case_id) ?? []), r]);
    }
    return [...m.entries()];
  }, [home]);

  if (!user) {
    return (
      <Card>
        <h1 className="text-[17px] font-bold text-[var(--text-primary)] mb-2">{L('분신', 'Your twin')}</h1>
        <Empty>{L('로그인하면 분신이 쌓아 온 기록을 볼 수 있습니다.', 'Sign in to see what your twin has accumulated.')}</Empty>
        <LocaleLink href="/login" className="inline-block mt-4">
          <Button variant="secondary" size="sm">{L('로그인', 'Sign in')}</Button>
        </LocaleLink>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-[var(--text-tertiary)] py-12">
        <Loader2 size={14} className="animate-spin" /> {L('불러오는 중', 'Loading')}
      </div>
    );
  }

  const nothingYet =
    (home?.sealed?.length ?? 0) === 0 &&
    (home?.revealed?.length ?? 0) === 0 &&
    cases.length === 0;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[19px] font-bold text-[var(--text-primary)] tracking-tight">{L('분신', 'Your twin')}</h1>
        <p className="text-[13px] text-[var(--text-secondary)] mt-1 break-keep leading-relaxed">
          {L(
            '당신이 결정할 때, 분신도 같은 시험을 칩니다. 답안은 봉인되고 정산할 때 함께 열립니다.',
            'When you decide, your twin sits the same exam. Its answer is sealed, and opens when reality does.',
          )}
        </p>
      </header>

      {failed && (
        <Card variant="muted">
          <Empty>
            {L('기록을 읽지 못했습니다. 잠시 후 다시 시도해 주세요.', 'Could not read the record. Please try again shortly.')}
          </Empty>
          <Button variant="secondary" size="sm" onClick={load} className="mt-3">{L('다시 시도', 'Retry')}</Button>
        </Card>
      )}

      {/* ── 아직 아무것도 없을 때: 빈 절 다섯 개 대신 시작하는 법 하나 ── */}
      {nothingYet && !failed && (
        <Card>
          <SectionLabel>{L('아직 비어 있습니다', 'Nothing here yet')}</SectionLabel>
          <p className="text-[13px] text-[var(--text-secondary)] break-keep leading-relaxed">
            {L(
              '분신은 당신의 결정 위에서만 자랍니다. 결정을 하나 열면 그 자리에서 분신이 예측을 적어 봉인하고, 기한이 되어 정산할 때 그 봉투가 열립니다.',
              'Your twin only grows on your decisions. Open one, and it writes a prediction and seals it on the spot — the envelope opens when you settle.',
            )}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <LocaleLink href="/connect">
              <Button variant="secondary" size="sm">
                {L('쓰던 AI에 연결하기', 'Connect your AI')} <ArrowRight size={14} />
              </Button>
            </LocaleLink>
            <LocaleLink href="/workspace">
              <Button variant="ghost" size="sm">{L('웹에서 바로 열기', 'Open one here')}</Button>
            </LocaleLink>
          </div>
        </Card>
      )}

      {/* ── 1. 봉인 — 이 화면의 중심 ─────────────────────────────────── */}
      {!nothingYet && (
        <Card>
          <SectionLabel>{L('봉인된 예측', 'Sealed')}</SectionLabel>
          {home?.sealed === null ? (
            <Empty>{L('봉인 기록을 읽지 못했습니다 (서버 준비 상태를 확인해 주세요).', 'Could not read sealed records — check server readiness.')}</Empty>
          ) : sealedByCase.length === 0 ? (
            <Empty>
              {L(
                '지금 잠겨 있는 예측이 없습니다. 다음 결정을 열면 다시 생깁니다.',
                'Nothing is sealed right now. It starts again with your next decision.',
              )}
            </Empty>
          ) : (
            <>
              <div className="rounded-lg bg-[var(--accent)]/[0.04] px-4 py-3">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text-primary)]">
                  <Lock size={14} className="text-[var(--accent)]" />
                  {L(`${home!.sealed!.length}건이 잠겨 있습니다`, `${home!.sealed!.length} sealed`)}
                </div>
                <p className="text-[12px] text-[var(--text-secondary)] mt-1.5 break-keep leading-relaxed">
                  {L(
                    '이 안은 당신도 볼 수 없습니다 — 읽을 권한 자체를 만들지 않았습니다. 미리 보면 시험이 시험이 아니게 되기 때문입니다.',
                    'You cannot read inside either — the permission simply does not exist. A test you can peek at is not a test.',
                  )}
                </p>
              </div>
              <ul className="mt-3 space-y-1.5">
                {sealedByCase.map(([caseId, s]) => (
                  <li key={caseId} className="text-[12px] px-2.5 py-2 rounded-md bg-[var(--bg)]">
                    <span className="text-[var(--text-secondary)] break-keep">
                      {caseById.get(caseId)?.title ?? caseId}
                    </span>
                    <span className="block text-[11px] text-[var(--text-tertiary)] mt-0.5">
                      {fmt(s.sealedAt)} · {s.targets.map((t) => (ko ? TARGET_LABEL[t]?.ko : TARGET_LABEL[t]?.en) ?? t).join(' · ')}
                      {s.late && ` · ${L('봉인이 채택보다 늦어 채점 제외', 'sealed after adoption — not graded')}`}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}

      {/* ── 2. 열린 봉인 = 그때와 현실의 대조 ────────────────────────── */}
      {!nothingYet && (
        <Card>
          <SectionLabel>{L('열린 봉인', 'Opened')}</SectionLabel>
          {revealedByCase.length === 0 ? (
            <Empty>
              {L(
                '아직 열린 봉투가 없습니다. 첫 정산이 끝나면 분신이 적었던 문장과 현실이 답한 문장이 여기 나란히 놓입니다.',
                'No envelope has opened yet. After your first settlement, what the twin wrote and what reality answered sit side by side here.',
              )}
            </Empty>
          ) : (
            <div className="space-y-4">
              {revealedByCase.map(([caseId, preds]) => {
                const c = caseById.get(caseId);
                return (
                  <div key={caseId} className="rounded-lg bg-[var(--bg)] px-4 py-3">
                    <div className="text-[13px] font-semibold text-[var(--text-primary)] break-keep">
                      {c?.title ?? caseId}
                    </div>
                    <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                      {fmt(c?.settled_at ?? preds[0].revealed_at)}
                      {c?.choice && ` · ${L('채택', 'adopted')}: ${c.choice}`}
                    </div>

                    <div className="mt-3 space-y-2">
                      {preds.map((p, i) => (
                        <div key={i} className="text-[12px]">
                          <span className="text-[var(--text-tertiary)]">
                            {(ko ? TARGET_LABEL[p.target]?.ko : TARGET_LABEL[p.target]?.en) ?? p.target}
                            {' · '}
                            {L(`확신 ${Math.round(p.confidence * 100)}%`, `${Math.round(p.confidence * 100)}% confident`)}
                          </span>
                          <p className="text-[var(--text-secondary)] break-keep leading-relaxed mt-0.5">
                            &ldquo;{p.expectation}&rdquo;
                          </p>
                          {p.verdict && (
                            <p className="text-[11px] mt-1 break-keep">
                              <span
                                className={
                                  p.verdict === 'supported'
                                    ? 'text-[var(--success)] font-semibold'
                                    : p.verdict === 'contradicted'
                                      ? 'text-[var(--danger)] font-semibold'
                                      : 'text-[var(--text-tertiary)] font-semibold'
                                }
                              >
                                {p.verdict === 'supported'
                                  ? L('현실이 뒷받침', 'reality supported it')
                                  : p.verdict === 'contradicted'
                                    ? L('현실과 어긋남', 'reality contradicted it')
                                    : L('판정 못 함 — 성적에서 제외', 'indeterminate — excluded from the score')}
                              </span>
                              {p.verdict_quote && (
                                <span className="text-[var(--text-tertiary)]"> · &ldquo;{p.verdict_quote}&rdquo;</span>
                              )}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    {c?.last_observation && (
                      <p className="text-[12px] text-[var(--text-secondary)] mt-3 pt-3 border-t border-[var(--border-subtle)] break-keep leading-relaxed">
                        <span className="text-[var(--text-tertiary)]">{L('당신이 적은 현실: ', 'what you wrote: ')}</span>
                        &ldquo;{c.last_observation}&rdquo;
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* ── 3. 분신 성적 ─────────────────────────────────────────────── */}
      {!nothingYet && home?.score && (
        <Card>
          <SectionLabel>{L('분신 성적', 'Twin score')}</SectionLabel>
          <div className="space-y-1.5">
            <ScoreRow
              label={L('당신의 선택을 맞힌 비율', 'Matched your choice')}
              rate={home.score.matchRate}
              sample={home.score.matchSample}
              L={L}
            />
            <ScoreRow
              label={L('현실을 맞힌 비율', 'Matched reality')}
              rate={home.score.outcomeRate}
              sample={home.score.outcomeSample}
              L={L}
            />
          </div>
          <p className="text-[11px] text-[var(--text-tertiary)] mt-3 break-keep leading-relaxed">
            {L(
              '채점 대상은 분신의 예측입니다 — 당신에 대한 평가가 아닙니다. 판정하지 못한 것과 봉인이 늦은 것은 세지 않았습니다.',
              'What is graded is the twin’s prediction, not you. Indeterminate and late seals are not counted.',
            )}
          </p>
        </Card>
      )}

      {/* ── 4. 판단 프로필 (읽기 — 고치기는 설정에서) ────────────────── */}
      {profile.length > 0 && (
        <Card>
          <SectionLabel>{L('정산에서 관찰된 패턴', 'Observed from settlements')}</SectionLabel>
          <div className="space-y-1.5">
            {profile.map((p) => (
              <div key={p.id} className="text-[12px] px-2.5 py-2 rounded-md bg-[var(--bg)]">
                <span className={p.status === 'retired' ? 'text-[var(--text-tertiary)] line-through decoration-1' : 'text-[var(--text-secondary)]'}>
                  <span className="text-[var(--text-tertiary)]">[{p.layer}·{p.domain}]</span>{' '}
                  <span className="break-keep">{p.content}</span>
                </span>
                <span className="block text-[11px] text-[var(--text-tertiary)] mt-0.5">
                  {L('근거 정산 ', 'from ')}{(p.evidence_case_ids ?? []).length}{L('건', '')}
                  {(p.counterexamples ?? []).length > 0 && ` · ${L('반례', 'counterexamples')} ${(p.counterexamples ?? []).length}`}
                  {p.status === 'retired' && ` · ${L('현실이 반대로 답해서 물러남', 'retired — reality answered otherwise')}`}
                </span>
              </div>
            ))}
          </div>
          <LocaleLink href="/settings" className="inline-block mt-3 text-[12px] text-[var(--accent)] hover:underline">
            {L('설정에서 고치거나 지우기', 'Edit or remove in settings')}
          </LocaleLink>
        </Card>
      )}

      {/* ── 5. 범위 위임 ─────────────────────────────────────────────── */}
      {delegations.length > 0 && (
        <Card>
          <SectionLabel>{L('내가 미리 승인해 둔 정책', 'Policies you authorized')}</SectionLabel>
          <div className="space-y-1.5">
            {delegations.map((d) => (
              <div key={d.id} className="text-[12px] px-2.5 py-2 rounded-md bg-[var(--bg)]">
                <span className={d.status === 'suspended' ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-secondary)]'}>
                  <span className="text-[var(--text-tertiary)]">[{d.scope_domain}]</span>{' '}
                  <span className="break-keep">{d.policy}</span>
                </span>
                <span className="block text-[11px] text-[var(--text-tertiary)] mt-0.5 break-keep">
                  {L('그때 하신 말: ', 'your words: ')}&ldquo;{d.user_words}&rdquo;
                </span>
                <span className="block text-[11px] text-[var(--text-tertiary)]">
                  {L('적용 ', 'applied ')}{d.applications}
                  {L(' · 맞음 ', ' · supported ')}{d.supported}
                  {L(' · 어긋남 ', ' · contradicted ')}{d.contradicted}
                  {L(' · 만료 ', ' · expires ')}{fmt(d.expires_at)}
                  {d.status === 'suspended' && ` · ${L('어긋남이 쌓여 스스로 멈췄습니다', 'suspended itself')}`}
                </span>
              </div>
            ))}
          </div>
          <LocaleLink href="/settings" className="inline-block mt-3 text-[12px] text-[var(--accent)] hover:underline">
            {L('설정에서 철회하거나 다시 켜기', 'Revoke or resume in settings')}
          </LocaleLink>
        </Card>
      )}
    </div>
  );
}

/**
 * 성적 한 줄. **표본이 임계 미달이면 숫자를 만들지 않는다** — 2건짜리 "50%"는
 * 정보가 아니라 소음이고, 소음을 성적처럼 보이게 하는 것이 이 제품이 하지
 * 않기로 한 일이다. 임계의 정본은 TWIN_SCORE_MIN_SAMPLE 하나뿐이다.
 */
function ScoreRow({
  label,
  rate,
  sample,
  L,
}: {
  label: string;
  rate: number | null;
  sample: number;
  L: (k: string, e: string) => string;
}) {
  const ready = sample >= TWIN_SCORE_MIN_SAMPLE && rate !== null;
  return (
    <div className="flex items-baseline justify-between gap-3 text-[13px] px-2.5 py-2 rounded-md bg-[var(--bg)]">
      <span className="text-[var(--text-secondary)] break-keep">{label}</span>
      {ready ? (
        <span className="text-[var(--text-primary)] font-semibold shrink-0">
          {Math.round(rate * 100)}%
          <span className="text-[11px] text-[var(--text-tertiary)] font-normal"> ({sample})</span>
        </span>
      ) : (
        <span className="text-[12px] text-[var(--text-tertiary)] shrink-0 text-right">
          {L(`아직 모릅니다 · ${sample}/${TWIN_SCORE_MIN_SAMPLE}`, `not yet · ${sample}/${TWIN_SCORE_MIN_SAMPLE}`)}
        </span>
      )}
    </div>
  );
}
