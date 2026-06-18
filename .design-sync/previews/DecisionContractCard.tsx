import { DecisionContractCard } from 'argus';

// DecisionContractCard — the falsifiable closed loop on the project page. Four
// derived states (never a stored status): SEAL an offer, WAITING after sealing,
// GRADE when the check-in date arrives, and VERIFIED once every prediction is
// resolved. Predictions are framed as yes/no questions per source (가설/위험/사람).
if (typeof window !== 'undefined') {
  window.localStorage.setItem('sot_settings', JSON.stringify({ language: 'ko' }));
}

const wrap: React.CSSProperties = { maxWidth: 460, padding: 24 };

const predicate = (
  id: string,
  source: 'governing_idea' | 'risk' | 'actor',
  text: string,
  extra: Record<string, unknown> = {},
) => ({ id, source, text, ...extra });

const base = (id: string, name: string, contract: unknown) => ({
  id, name, description: '', refs: [],
  decision_contract: contract,
  created_at: '2026-06-01T09:00:00.000Z',
  updated_at: '2026-06-01T09:00:00.000Z',
});

const PREDS = [
  predicate('pr-bet', 'governing_idea', '첫 주 매출 리포트 한 장이 셀러의 월 29만 원 결제를 끌어낸다'),
  predicate('pr-risk', 'risk', 'CFO가 가격 단계에서 회수 가정에 반대한다', { persona_id: 'p-cfo' }),
  predicate('pr-actor', 'actor', '엔지니어 2명을 빼는 결정은 사람 판단이 필요했다', { persona_id: 'p-eng' }),
];

// ── State 1: SEAL — voyage finished, predictions ready, nothing sealed yet.
export const SealOffer = () => (
  <div style={wrap}>
    <DecisionContractCard project={base('proj-seal', '신사업 AI 상담 4주 MVP', null)} sealable livePredicates={PREDS} />
  </div>
);

// ── State 2: WAITING — sealed, check-in date still ahead.
export const Waiting = () => (
  <div style={wrap}>
    <DecisionContractCard
      sealable={false}
      project={base('proj-wait', '베를린 진출 보류 결정', {
        id: 'c-wait', project_id: 'proj-wait', predicates: PREDS,
        created_at: '2026-06-18T09:00:00.000Z',
        check_in_interval: '2w', check_in_at: '2026-07-03T09:00:00.000Z',
      })}
    />
  </div>
);

// ── State 3: GRADE — check-in date has arrived; verdict chips per source, with
// the optional "운이었나요?" tap appearing on a credit-claiming verdict. The
// capture clock is pinned to 2024-05-15, so the check-in date sits just before it.
export const DueToGrade = () => (
  <div style={wrap}>
    <DecisionContractCard
      sealable={false}
      project={base('proj-due', '시니어 1명 채용 결정', {
        id: 'c-due', project_id: 'proj-due',
        predicates: [
          predicate('pr-bet2', 'governing_idea', '백엔드 시니어가 마이그레이션 리스크를 한 달 안에 끈다'),
          predicate('pr-risk2', 'risk', '온보딩 이탈률이 40%를 넘어 활성화가 막힌다', { persona_id: 'p-pm', verdict: 'avoided', basis: 'reasoned' }),
        ],
        created_at: '2024-04-01T09:00:00.000Z',
        check_in_interval: '2w', check_in_at: '2024-04-15T09:00:00.000Z',
      })}
    />
  </div>
);

// ── State 4: VERIFIED — every prediction resolved; honest per-source scorecard,
// including a win the user marked as luck (so it doesn't read as a judgment-win).
export const Verified = () => (
  <div style={wrap}>
    <DecisionContractCard
      sealable={false}
      project={base('proj-done', '도쿄 진출 1분기 결정', {
        id: 'c-done', project_id: 'proj-done',
        predicates: [
          predicate('pr-bet3', 'governing_idea', '첫 주 매출 리포트가 결제를 끌어낸다', { verdict: 'happened', basis: 'luck', graded_at: '2026-06-17T09:00:00.000Z' }),
          predicate('pr-risk3', 'risk', 'CFO가 회수 가정에 반대한다', { verdict: 'avoided', basis: 'reasoned', graded_at: '2026-06-17T09:00:00.000Z' }),
          predicate('pr-actor3', 'actor', '엔지니어 재배치는 사람 판단이 필요했다', { verdict: 'happened', graded_at: '2026-06-17T09:00:00.000Z' }),
        ],
        created_at: '2026-06-01T09:00:00.000Z',
        check_in_interval: '2w', check_in_at: '2026-06-15T09:00:00.000Z',
        graded_at: '2026-06-17T09:00:00.000Z',
      })}
    />
  </div>
);
