import { SettlementModal } from 'argus';

// SettlementModal — "그래서, 어떻게 됐어요?" The return surface that opens on a
// sealed decision's check-in day. Each prediction settles with the per-source
// 3-tap verdict; the 4th path ("아직") extends the date instead of resolving.
// Closing every loop returns one line of the user's accumulating record.
//
// OVERLAY: this renders inside <Modal open> over a backdrop. For a clean
// capture it wants cfg.overrides { cardMode: 'single', viewport ~480x560 }.
//
// Seed the locale + a couple of already-closed loops so the "지금까지 …" record
// line in the resolved state has real substance.
if (typeof window !== 'undefined') {
  window.localStorage.setItem('sot_settings', JSON.stringify({ language: 'ko' }));
  window.localStorage.setItem(
    'sot_projects',
    JSON.stringify([
      {
        id: 'past-1', name: '베를린 진출 보류', description: '', refs: [],
        created_at: '2026-04-01T09:00:00.000Z', updated_at: '2026-05-01T09:00:00.000Z',
        decision_contract: {
          id: 'pc-1', project_id: 'past-1', graded_at: '2026-05-01T09:00:00.000Z',
          created_at: '2026-04-01T09:00:00.000Z',
          predicates: [{ id: 'x1', source: 'risk', text: '현지 규제로 출시가 막힌다', verdict: 'avoided', basis: 'reasoned', graded_at: '2026-05-01T09:00:00.000Z' }],
        },
      },
      {
        id: 'past-2', name: '가격 인상 결정', description: '', refs: [],
        created_at: '2026-03-01T09:00:00.000Z', updated_at: '2026-04-01T09:00:00.000Z',
        decision_contract: {
          id: 'pc-2', project_id: 'past-2', graded_at: '2026-04-01T09:00:00.000Z',
          created_at: '2026-03-01T09:00:00.000Z',
          predicates: [{ id: 'x2', source: 'risk', text: '핵심 고객이 이탈한다', verdict: 'avoided', basis: 'luck', graded_at: '2026-04-01T09:00:00.000Z' }],
        },
      },
    ]),
  );
}

const noop = () => {};

// Clock is pinned to 2024-05-15 in capture — keep the seal date just before it
// so the "…에 봉인한 결정이에요" line reads as a real past date.
const project = (id: string, name: string, predicates: unknown[]) => ({
  id, name, description: '', refs: [],
  created_at: '2024-04-30T09:00:00.000Z', updated_at: '2024-05-14T09:00:00.000Z',
  decision_contract: {
    id: `c-${id}`, project_id: id, predicates,
    created_at: '2024-04-30T09:00:00.000Z',
    check_in_interval: '2w', check_in_at: '2024-05-14T09:00:00.000Z',
  },
});

// Mid-settlement: one risk already marked "회피" (so the optional "운이었나요?"
// tap is showing), one bet still untapped, plus the extend ("아직") row below.
export const ToSettle = () => (
  <SettlementModal
    onClose={noop}
    project={project('proj-settle', '신사업 AI 상담 4주 MVP', [
      { id: 's-risk', source: 'risk', text: 'CFO가 회수 가정에 반대한다', persona_id: 'p-cfo', verdict: 'avoided', basis: 'reasoned' },
      { id: 's-bet', source: 'governing_idea', text: '첫 주 매출 리포트가 월 29만 원 결제를 끌어낸다' },
    ])}
  />
);

// Every loop closed — the green "고리를 닫았어요" confirmation plus the running
// record across past decisions (loops, risks steered past, luck-marked wins).
export const Resolved = () => (
  <SettlementModal
    onClose={noop}
    project={project('proj-closed', '시니어 1명 채용 결정', [
      { id: 'r-risk', source: 'risk', text: '온보딩 이탈률이 40%를 넘는다', persona_id: 'p-pm', verdict: 'avoided', basis: 'reasoned', graded_at: '2026-06-18T09:00:00.000Z' },
      { id: 'r-bet', source: 'governing_idea', text: '시니어가 마이그레이션 리스크를 한 달 안에 끈다', verdict: 'happened', basis: 'reasoned', graded_at: '2026-06-18T09:00:00.000Z' },
    ])}
  />
);
