// 핸들러 전 구간 — 원장을 메모리로 갈아 끼우고 **진짜 하네스**를 통과시킨다.
//
// 왜 store만 가짜인가: 이 층에서 틀릴 수 있는 것은 Supabase가 아니라 배선이다.
// (관찰 없이 기록을 열지 않는가, 채택 전에 계획을 막는가, 안 온 값을 지어내지
// 않는가.) 하네스를 같이 가짜로 만들면 그 배선이 맞는지 아무것도 증명하지 못한다.
//
// 2026-08-05: 이 파일이 생기기 전까지 원격 표면에는 protocol 테스트뿐이었고,
// 핸들러 여섯 개는 한 줄도 실행된 적이 없었다.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Ledger, restoreLedger } from '../../../../../../method-harness/ledger';
import { SessionEngine } from '../../../../../../method-harness/surfaces/engine';
import type { LedgerEvent } from '../../../../../../method-harness/types';

// ── 메모리 원장 (append-only 를 그대로 흉내 낸다) ─────────────────────────
const events = new Map<string, LedgerEvent[]>();
type Row = {
  id: string;
  title: string;
  state: string;
  updated_at: string;
  choice?: string | null;
  last_observation?: string | null;
  recall_gap?: string | null;
  settled_at?: string | null;
};
const cases = new Map<string, Row>();
let returns: Array<{ case_id: string; kind: string; due_at: string; from_step?: string | null; status: string }> = [];

vi.mock('../store', () => ({
  loadEngine: async (_u: string, caseId: string) => {
    const evs = events.get(caseId) ?? [];
    return new SessionEngine(caseId, evs.length > 0 ? restoreLedger(evs) : new Ledger());
  },
  knownEventIds: async (_u: string, caseId: string) => new Set((events.get(caseId) ?? []).map((e) => e.id)),
  persistNewEvents: async (_u: string, caseId: string, engine: SessionEngine, known: ReadonlySet<string>) => {
    const fresh = engine.ledger.forCase(caseId).filter((e) => !known.has(e.id));
    events.set(caseId, [...(events.get(caseId) ?? []), ...fresh]);
    return fresh.length;
  },
  upsertCase: async (_u: string, caseId: string, title: string, state: string) => {
    cases.set(caseId, { ...(cases.get(caseId) ?? {}), id: caseId, title, state, updated_at: new Date().toISOString() });
  },
  listCases: async () => [...cases.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
  getCase: async (_u: string, caseId: string) => cases.get(caseId) ?? null,
  projectOutcome: async (
    _u: string,
    caseId: string,
    o: { choice?: string; observation: string; recall: string; settledAt: string },
  ) => {
    const row = cases.get(caseId);
    if (row) {
      cases.set(caseId, {
        ...row,
        choice: o.choice ?? row.choice,
        last_observation: o.observation,
        recall_gap: o.recall,
        settled_at: o.settledAt,
      });
    }
  },
  armReturns: async (_u: string, caseId: string, rs: Array<{ kind: string; dueAt: string; fromStep?: string }>) => {
    for (const r of rs) returns.push({ case_id: caseId, kind: r.kind, due_at: r.dueAt, from_step: r.fromStep, status: 'armed' });
  },
  completeReturns: async (_u: string, caseId: string) => {
    returns = returns.map((r) => (r.case_id === caseId ? { ...r, status: 'completed' } : r));
  },
  completeOneReturn: async (_u: string, caseId: string) => {
    const open = returns
      .filter((r) => r.case_id === caseId && ['armed', 'sent'].includes(r.status))
      .sort((a, b) => a.due_at.localeCompare(b.due_at));
    const target = open[0];
    if (target) returns = returns.map((r) => (r === target ? { ...r, status: 'completed' } : r));
  },
  updateLastObservation: async (_u: string, caseId: string, observation: string) => {
    const row = cases.get(caseId);
    if (row) cases.set(caseId, { ...row, last_observation: observation });
  },
  dueReturns: async (_u: string, at: string) =>
    returns.filter((r) => ['armed', 'sent'].includes(r.status) && r.due_at <= at),
}));

// ── TWIN 표면 (그림자·위임) ──────────────────────────────────────────────
// 이 둘은 실제로는 service role DB 와 LLM 을 탄다. mock 하지 않으면 try/catch 가
// 삼켜서 **조용히 아무 일도 없는 것처럼** 통과하고, 배선이 맞는지 아무것도
// 증명하지 못한다 (이 파일이 존재하는 이유와 정확히 같은 함정).
const sealed: Array<{ lean?: string }> = [];
let delegationMatch: { delegation: { id: string; policy: string }; text: string } | null = null;
let delegationCreate: { ok: true; id: string; expiresAt: string } | { ok: false; reason: string } = {
  ok: true,
  id: 'deleg-1',
  expiresAt: '2026-09-05T00:00:00Z',
};
const marked: Array<{ caseId: string; delegationId: string }> = [];
// 열 때 꺼내진 위임의 서버 기록 (결정론 백스톱) — 모델의 에코와 무관하게 남는다.
const offeredMarks: Array<{ caseId: string; delegationId: string }> = [];
let offeredId: string | null = null;

vi.mock('@/lib/twin/shadow', () => ({
  // after() 를 즉시 실행한다 — 봉인이 무엇을 받았는지 테스트가 보려면 필요하다.
  runAfterResponse: (fn: () => Promise<unknown> | unknown) => { void fn(); },
  generateAndSealShadow: async (_u: string, _c: string, opening: { lean?: string }) => {
    sealed.push({ lean: opening.lean });
  },
  revealShadowsText: async () => ({ text: '', revealed: [] }),
  gradeRevealedShadows: async () => {},
}));

vi.mock('@/lib/twin/delegation', () => ({
  applyDelegation: async () => delegationMatch,
  createDelegation: async () => delegationCreate,
  markCaseDelegation: async (_u: string, caseId: string, delegationId: string) => {
    marked.push({ caseId, delegationId });
  },
  markCaseDelegationOffered: async (_u: string, caseId: string, delegationId: string) => {
    offeredMarks.push({ caseId, delegationId });
  },
  offeredDelegationId: async () => offeredId,
  caseDelegationId: async () => null,
  gradeDelegation: async () => null,
  describeDelegationGrade: () => '',
  DELEGATION_DEFAULT_DAYS: 30,
  DELEGATION_MAX_DAYS: 90,
}));

let cruxText = '';
let cruxCalls = 0;
vi.mock('@/lib/twin/divergence', () => ({
  divergenceCrux: async () => {
    cruxCalls += 1;
    return cruxText;
  },
}));
vi.mock('@/lib/twin/profile', () => ({
  profileLines: async () => [],
  recentlyRetiredLines: async () => [],
  extractProfileFromSettlement: async () => ({ inserted: 0, reinforced: 0, contradicted: 0, retired: 0 }),
}));
// 부분 목 — 전체 목은 이 모듈의 다른 export(TWIN_SCORE_MIN_SAMPLE)를 전부
// 없애서, 상수가 undefined 가 된 채 비교가 조용히 무너진다 (CLAUDE.md 함정).
vi.mock('@/lib/twin/store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/twin/store')>()),
  twinScore: async () => ({
    matchRate: null, matchSample: 0, outcomeRate: null, outcomeSample: 0,
    matchCases: [], outcomeCases: [],
  }),
}));

const {
  handleAdopt,
  handleOpen,
  handlePlan,
  handleRecall,
  handleReturn,
  handleSharpen,
  formatDueNotice,
  formatMaterialNote,
  readMaterials,
  MAX_INLINE_NOTICES,
} = await import('../handlers');
const { MATERIAL_EXCERPT_MAX, MATERIAL_MAX_COUNT } = await import('../tools');

const U = 'user-1';
const text = (r: { content: Array<{ text: string }> }) => r.content[0].text;
const isErr = (r: { isError?: boolean }) => r.isError === true;

beforeEach(() => {
  events.clear();
  cases.clear();
  returns = [];
  sealed.length = 0;
  marked.length = 0;
  offeredMarks.length = 0;
  offeredId = null;
  delegationMatch = null;
  cruxText = '';
  cruxCalls = 0;
  delegationCreate = { ok: true, id: 'deleg-1', expiresAt: '2026-09-05T00:00:00Z' };
});

async function openCase(utterance = '가격을 올릴까 말까 고민이야') {
  const res = await handleOpen(U, { utterance, lean: '올린다', statedReasons: ['마진이 얇다'] });
  const id = /id: (case_[a-z0-9_]+)/.exec(text(res))?.[1];
  expect(id, text(res)).toBeTruthy();
  return id!;
}

// ── fire-gate 가 장식이 아니어야 한다 ────────────────────────────────────
describe('argus_open — 발동 관문', () => {
  it('평평한 말에는 결정을 열지 않는다 (모델이 불렀다는 사실만으로 통과하지 않는다)', async () => {
    const res = await handleOpen(U, { utterance: '오늘 점심 뭐 먹지 딱히 상관없어' });
    expect(isErr(res)).toBe(true);
    expect(text(res)).toMatch(/flat_context|열지 않습니다/);
    expect(events.size).toBe(0); // 원장에 아무것도 남지 않는다
  });

  it('사용자가 명시적으로 불렀다고 모델이 말하면 연다', async () => {
    const res = await handleOpen(U, { utterance: '아무거나', userInvoked: true });
    expect(isErr(res)).toBe(false);
    expect(text(res)).toContain('user_invoked');
  });

  it('결정을 여는 말이면 명시 호출 없이도 열린다', async () => {
    const res = await handleOpen(U, { utterance: '가격을 올릴까 말까 고민이야' });
    expect(isErr(res)).toBe(false);
    expect(text(res)).toContain('explicit_decision_ask');
  });

  it('말하지 않은 기울기를 지어내지 않는다 — 부재가 부재로 남는다', async () => {
    await handleOpen(U, { utterance: '이걸 결정해야 하는데' });
    const evs = [...events.values()][0];
    expect(evs.some((e) => e.type === 'baseline_not_captured')).toBe(true);
  });

  it('AI가 말하기 전의 기울기는 그대로 보존된다', async () => {
    const id = await openCase();
    const evs = events.get(id)!;
    const baseline = evs.find((e) => e.type === 'baseline_captured') as { lean: string } | undefined;
    expect(baseline?.lean).toBe('올린다');
  });
});

// ── 검증기가 원격에서도 실제로 돈다 ──────────────────────────────────────
describe('argus_sharpen — 검증기 배선', () => {
  it('짚기 없이 부르면 지켜야 할 규칙과 사용자가 말한 것만 돌려준다', async () => {
    const id = await openCase();
    const res = await handleSharpen(U, { caseId: id });
    expect(text(res)).toContain('하중이 가장 큰 가정');
    expect(text(res)).toContain('마진이 얇다');
    expect(events.get(id)!.some((e) => e.type === 'ai_proposal')).toBe(false);
  });

  it('반증 사실이 없는 짚기는 검증기가 질문으로 낮추고, 그 사실을 숨기지 않는다', async () => {
    const id = await openCase();
    const res = await handleSharpen(U, { caseId: id, assumption: '고객이 가격에 둔감하다' });
    expect(text(res)).toContain('검증기가 형태를 낮췄습니다');
    expect(text(res)).toContain('reframe_without_falsifier_to_question');
    expect(text(res)).toContain('대신 물을 것');
  });

  it('반증 사실이 있으면 그대로 통과하고 다운그레이드가 없다', async () => {
    const id = await openCase();
    const res = await handleSharpen(U, {
      caseId: id,
      assumption: '고객이 가격에 둔감하다',
      falsifier: '인상 후 2주간 이탈률이 5%를 넘으면 틀렸다',
    });
    expect(text(res)).not.toContain('검증기가 형태를 낮췄습니다');
    expect(text(res)).toContain('이탈률');
  });

  it('"기록했습니다"가 거짓말이 아니다 — 통과한 짚기는 원장에 ai_proposal 로 남는다', async () => {
    // 2026-08-09 프로덕션 도그푸드에서 걸린 결함: 검증기는 통과시키는데 카드도
    // 추천도 없는 턴은 아무 이벤트도 append 하지 않아, 응답 문구("원장에
    // 남습니다")가 거짓이었다. 짚기는 채팅 스크롤백에만 존재했다.
    const id = await openCase();
    await handleSharpen(U, {
      caseId: id,
      assumption: '고객이 가격에 둔감하다',
      falsifier: '인상 후 2주간 이탈률이 5%를 넘으면 틀렸다',
    });
    const trace = events.get(id)!.find((e) => e.type === 'ai_proposal') as { description: string } | undefined;
    expect(trace).toBeTruthy();
    expect(trace!.description).toContain('고객이 가격에 둔감하다');
    expect(trace!.description).toContain('이탈률이 5%');
  });

  it('열리지 않은 결정에는 짚지 않는다', async () => {
    const res = await handleSharpen(U, { caseId: 'case_없음' });
    expect(isErr(res)).toBe(true);
  });
});

// ── 채택: 지어내지 않고, 빈 자리를 드러낸다 ─────────────────────────────
describe('argus_adopt — 조작 없는 채택', () => {
  it('하중이 안 오면 가장 엄격한 쪽으로 닫고 그렇게 했다고 말한다', async () => {
    const id = await openCase();
    const res = await handleAdopt(U, { caseId: id, choiceOrPolicy: '10% 인상' });
    expect(text(res)).toContain('major / one_way');
    expect(text(res)).toContain('가장 엄격한 쪽');
  });

  it('하중이 오면 그대로 기록하고 가정했다고 말하지 않는다', async () => {
    const id = await openCase();
    const res = await handleAdopt(U, {
      caseId: id,
      choiceOrPolicy: '10% 인상',
      stakes: { weight: 'significant', reversibility: 'reversible' },
      values: ['현금흐름 우선'],
    });
    expect(text(res)).toContain('significant / reversible');
    expect(text(res)).not.toContain('가장 엄격한 쪽');
  });

  it('가치·믿음이 비면 빈 채로 두고 비었다고 말한다 (채우지 않는다)', async () => {
    const id = await openCase();
    const res = await handleAdopt(U, { caseId: id, choiceOrPolicy: '10% 인상' });
    expect(text(res)).toContain('비어 있는 자리');
    const adopted = events.get(id)!.find((e) => e.type === 'card_adopted') as { card: { rationale: { values: string[] } } };
    expect(adopted.card.rationale.values).toEqual([]);
  });

  it('알 수 없는 enum 값은 조용히 통과시키지 않고 기본값으로 닫는다', async () => {
    const id = await openCase();
    await handleAdopt(U, {
      caseId: id,
      choiceOrPolicy: 'x',
      stakes: { weight: '엄청남', reversibility: 'reversible' },
      adoptedState: '아무거나',
    });
    const adopted = events.get(id)!.find((e) => e.type === 'card_adopted') as {
      card: { stakes: { weight: string }; adoptedState: string };
    };
    expect(adopted.card.stakes.weight).toBe('major'); // fail-closed
    expect(adopted.card.adoptedState).toBe('decide');
  });
});

// ── 계획 = 귀환 약속 ─────────────────────────────────────────────────────
describe('argus_plan — 마일스톤이 곧 돌아보기 약속', () => {
  it('채택 전에는 계획을 만들지 않는다', async () => {
    const id = await openCase();
    const res = await handlePlan(U, {
      caseId: id,
      steps: [{ what: 'a', kind: 'execute', byOrWhen: '내일', dueDate: '2026-09-01T00:00:00Z' }],
    });
    expect(isErr(res)).toBe(true);
    expect(text(res)).toMatch(/PLAN_WITHOUT_ADOPTED_CARD|채택/);
  });

  it('steps 가 없으면 형태만 알려주고 계획을 지어내지 않는다', async () => {
    const id = await openCase();
    await handleAdopt(U, { caseId: id, choiceOrPolicy: '10% 인상' });
    const res = await handlePlan(U, { caseId: id });
    expect(isErr(res)).toBe(true);
    expect(text(res)).toContain('확인 필요');
    expect(events.get(id)!.some((e) => e.type === 'plan_adopted')).toBe(false);
  });

  it('기한이 붙은 단계가 귀환 계약이 된다 — 사용자가 따로 승낙하지 않아도', async () => {
    const id = await openCase();
    await handleAdopt(U, { caseId: id, choiceOrPolicy: '10% 인상' });
    const res = await handlePlan(U, {
      caseId: id,
      steps: [
        { what: '가격표 갱신', kind: 'prepare', byOrWhen: '이번 주', dueDate: '2026-09-01T00:00:00Z' },
        { what: '이탈률 확인', kind: 'investigate', byOrWhen: '2주 뒤', dueDate: '2026-09-15T00:00:00Z' },
        { what: '기록만 하는 단계', kind: 'prepare', byOrWhen: '언젠가' },
      ],
      openQuestions: ['확인 필요: 경쟁사 가격'],
    });
    expect(isErr(res)).toBe(false);
    expect(returns.map((r) => r.from_step)).toEqual(['가격표 갱신', '이탈률 확인']);
    expect(returns[0].kind).toBe('commitment');
    expect(text(res)).toContain('경쟁사 가격');
  });

  it('기한 없는 단계가 몇 개 빠졌는지 밝힌다 (조용한 절삭 금지)', async () => {
    const id = await openCase();
    await handleAdopt(U, { caseId: id, choiceOrPolicy: 'x' });
    const res = await handlePlan(U, {
      caseId: id,
      steps: [
        { what: 'a', kind: 'execute', byOrWhen: '1', dueDate: '2026-09-01T00:00:00Z' },
        { what: 'b', kind: 'execute', byOrWhen: '2' },
      ],
    });
    expect(text(res)).toMatch(/1|하나/);
  });
});

// ── 관찰 우선 순서 ───────────────────────────────────────────────────────
describe('argus_return — 순서가 규칙이다', () => {
  async function plannedCase() {
    const id = await openCase();
    await handleAdopt(U, { caseId: id, choiceOrPolicy: '10% 인상' });
    await handlePlan(U, {
      caseId: id,
      steps: [{ what: '이탈률 확인', kind: 'investigate', byOrWhen: '2주', dueDate: '2026-09-01T00:00:00Z' }],
    });
    return id;
  }

  it('관찰 없이는 기록을 열지 않고 질문만 돌려준다', async () => {
    const id = await plannedCase();
    const res = await handleReturn(U, { caseId: id });
    expect(isErr(res)).toBe(true);
    expect(text(res)).toContain('먼저 실제로 무슨 일이 있었는지');
    expect(text(res)).not.toContain('10% 인상'); // 선택이 새면 안 된다
  });

  it('관찰만 왔을 때는 회상을 묻고, 여전히 기록을 열지 않는다 — 성공 스텝이지 에러가 아니다', async () => {
    const id = await plannedCase();
    const res = await handleReturn(U, { caseId: id, observation: '이탈률 3%였다' });
    // 관찰은 방금 원장에 들어갔다 — isError 로 신고하면 호스트 모델이 재시도부터 한다.
    expect(isErr(res)).toBe(false);
    expect(text(res)).toContain('왜 그렇게 정했는지');
    expect(text(res)).not.toContain('10% 인상');
    expect(events.get(id)!.some((e) => e.type === 'record_revealed')).toBe(false);
  });

  it('안내문이 약속한 경로가 실제로 열린다 — 회상만 들고 온 2차 호출로 정산이 끝난다', async () => {
    // 1차 응답이 "답을 recall 로 보내주시면"이라고 안내한다. 그 말대로 한 호출이
    // 거절되면 안내문이 거짓말이다 (2026-08-09 프로덕션 도그푸드에서 실제로 걸림).
    const id = await plannedCase();
    await handleReturn(U, { caseId: id, observation: '이탈률 3%였다' });
    const res = await handleReturn(U, { caseId: id, recall: '마진 때문이었던 듯' });
    expect(isErr(res)).toBe(false);
    expect(text(res)).toContain('10% 인상');
    expect(text(res)).toContain('마진 때문이었던 듯');
    expect(text(res)).toContain('이탈률 3%였다'); // 원장의 관찰이 정산에 쓰였다
    expect(returns.every((r) => r.status === 'completed')).toBe(true);
    expect(events.get(id)!.some((e) => e.type === 'return_closed')).toBe(true);
  });

  it('관찰과 회상을 같이 다시 보내도 같은 관찰이 두 번 남지 않는다 (append-only 오염 방지)', async () => {
    const id = await plannedCase();
    await handleReturn(U, { caseId: id, observation: '이탈률 3%였다' });
    const res = await handleReturn(U, { caseId: id, observation: '이탈률 3%였다', recall: '마진 때문이었던 듯' });
    expect(text(res)).toContain('10% 인상');
    expect(events.get(id)!.filter((e) => e.type === 'observation').length).toBe(1);
  });

  it('원장에 관찰이 없는 채로 회상만 오면 여전히 관찰부터 요구한다', async () => {
    const id = await plannedCase();
    const res = await handleReturn(U, { caseId: id, recall: '기억은 이렇다' });
    expect(isErr(res)).toBe(true);
    expect(text(res)).toContain('먼저 실제로 무슨 일이 있었는지');
    expect(events.get(id)!.some((e) => e.type === 'recall_probe_answer')).toBe(false);
  });

  it('계획 없이 채택만 한 결정도 정산할 수 있다 — "이미 정산 끝"이라는 거짓말 금지', async () => {
    // 귀환이 무장된 적 없는 케이스(계획·귀환 계약 없이 채택만)를 activeReturn
    // 부재만 보고 "이미 정산이 끝났습니다"로 돌려보내면, 그 케이스는 영영 정산
    // 불가가 된다 (2026-08-09 프로덕션 도그푸드 2회차에서 실제로 걸림).
    const id = await openCase();
    await handleAdopt(U, { caseId: id, choiceOrPolicy: '10% 인상' });
    const first = await handleReturn(U, { caseId: id, observation: '이탈률 3%였다' });
    expect(text(first)).not.toContain('이미 정산이 끝났습니다');
    expect(text(first)).toContain('왜 그렇게 정했는지');
    const res = await handleReturn(U, { caseId: id, recall: '마진 때문이었다' });
    expect(isErr(res)).toBe(false);
    expect(text(res)).toContain('10% 인상');
    expect(events.get(id)!.some((e) => e.type === 'record_revealed')).toBe(true);
    expect(events.get(id)!.some((e) => e.type === 'return_closed')).toBe(false); // 닫을 귀환이 없었다
    expect(cases.get(id)?.settled_at).toBeTruthy(); // 정산 투영이 남았다 — recall 이 말할 수 있다
  });

  it('기록이 공개된 뒤에는 귀환 유무와 무관하게 나중 사실만 덧붙는다', async () => {
    const id = await openCase();
    await handleAdopt(U, { caseId: id, choiceOrPolicy: '10% 인상' });
    await handleReturn(U, { caseId: id, observation: '이탈률 3%였다' });
    await handleReturn(U, { caseId: id, recall: '마진 때문이었다' });
    const res = await handleReturn(U, { caseId: id, observation: '한 달 뒤 이탈률이 4%로 올랐다' });
    expect(text(res)).toContain('나중 사실로 덧붙였습니다');
    expect(events.get(id)!.filter((e) => e.type === 'recall_probe_answer').length).toBe(1);
  });

  it('기록이 열린 뒤의 회상은 다시 받지 않는다 — 오염된 기억이기 때문', async () => {
    const id = await plannedCase();
    await handleReturn(U, { caseId: id, observation: 'o' });
    await handleReturn(U, { caseId: id, observation: 'o', recall: 'r' });
    const res = await handleReturn(U, { caseId: id, observation: '더 있었다', recall: '사실은 이랬다' });
    expect(text(res)).toContain('회상 탐침은 다시 하지 않습니다');
    // 원장은 오염되지 않는다: 회상 탐침이 두 번 들어가지 않았다
    expect(events.get(id)!.filter((e) => e.type === 'recall_probe_answer').length).toBe(1);
  });

  it('채택되지 않은 결정은 돌아볼 것이 없다', async () => {
    const id = await openCase();
    const res = await handleReturn(U, { caseId: id, observation: 'x' });
    expect(isErr(res)).toBe(true);
  });
});

// ── 불러오기: 유령 파라미터 없음 ─────────────────────────────────────────
describe('argus_recall — query 가 실제로 거른다', () => {
  it('검색어가 제목에 없는 결정은 빠지고, 몇 건 중 몇 건인지 밝힌다', async () => {
    await openCase('가격을 올릴까 말까 고민이야');
    await openCase('채용을 미룰까 고민이야');
    const res = await handleRecall(U, { query: '채용' });
    expect(text(res)).toContain('채용');
    expect(text(res)).not.toContain('가격을 올릴까');
    expect(text(res)).toContain('지난 결정 1건 (기록 전체 2건)');
  });

  it('겹치는 것이 없으면 없다고 말한다 (빈 목록을 전체인 척하지 않는다)', async () => {
    await openCase();
    const res = await handleRecall(U, { query: '존재하지않는말' });
    expect(text(res)).toContain('겹치는 지난 결정이 없습니다');
  });

  it('limit 은 1–20 으로 닫힌다', async () => {
    await openCase();
    expect(isErr(await handleRecall(U, { limit: 9999 }))).toBe(false);
    expect(isErr(await handleRecall(U, { limit: -3 }))).toBe(false);
  });
});

// ── 채팅 안 알림 ─────────────────────────────────────────────────────────
describe('기한이 된 귀환은 채팅 안에서 알린다', () => {
  // 만기가 지난 귀환은 **시간이 흘러야** 생긴다. 계획을 세우며 과거 날짜를 넣는
  // 길은 (당연히) 막혀 있으므로, 여기서는 큐에 직접 넣어 그 상태를 만든다.
  const armOverdue = (caseId: string, fromStep = '지난 약속') => {
    returns.push({ case_id: caseId, kind: 'commitment', due_at: '2020-01-01T00:00:00Z', from_step: fromStep, status: 'armed' });
  };

  it('성공 응답 끝에 붙고, 지금 다루는 결정은 제외한다', async () => {
    const id = await openCase();
    await handleAdopt(U, { caseId: id, choiceOrPolicy: 'x' });
    armOverdue(id);
    const other = await handleRecall(U, {});
    expect(text(other)).toContain('돌아볼 때가 된 결정이 1건');
    expect(text(other)).toContain('지난 약속');

    const same = await handleSharpen(U, { caseId: id });
    expect(text(same)).not.toContain('돌아볼 때가 된 결정');
  });

  it('실패 응답에는 붙지 않는다 — 고쳐야 할 것을 가리지 않는다', async () => {
    const id = await openCase();
    await handleAdopt(U, { caseId: id, choiceOrPolicy: 'x' });
    armOverdue(id);
    const res = await handleSharpen(U, { caseId: 'case_없음' });
    expect(isErr(res)).toBe(true);
    expect(text(res)).not.toContain('돌아볼 때가 된 결정');
  });

  it('두 건까지만 부른다 (알림이 본문을 밀어내면 그것이 과발화다)', () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ case_id: `c${i}`, from_step: `s${i}` }));
    const notice = formatDueNotice(rows);
    expect(MAX_INLINE_NOTICES).toBe(2);
    expect(notice).toContain('2건');
    expect(notice).not.toContain('s2');
  });

  it('알릴 것이 없으면 한 글자도 붙이지 않는다', () => {
    expect(formatDueNotice([])).toBe('');
    expect(formatDueNotice([{ case_id: 'c1' }], 'c1')).toBe('');
  });

  it('단계 이름이 없어도 무너지지 않는다', () => {
    expect(formatDueNotice([{ case_id: 'c1', from_step: null }])).toContain('지난 결정');
  });
});

describe('제목이 선택을 흘리지 않는다 (귀환 메일 제목까지 이어지는 경로)', () => {
  it('결정 질문은 원문에서 오고, 선택으로 대체되지 않는다', async () => {
    const id = await openCase('가격을 올릴까 말까 고민이야');
    await handleAdopt(U, { caseId: id, choiceOrPolicy: '10% 인상' });
    expect(cases.get(id)!.title).toContain('가격을 올릴까');
    expect(cases.get(id)!.title).not.toContain('10% 인상');
  });

  it('열린 적 없는 결정은 채택할 수 없다 (질문 자리에 선택이 들어가는 경로를 막는다)', async () => {
    const res = await handleAdopt(U, { caseId: 'case_유령', choiceOrPolicy: '10% 인상' });
    expect(isErr(res)).toBe(true);
    expect(cases.has('case_유령')).toBe(false);
  });
});

describe('과거 기한은 계획으로 들어오지 못한다', () => {
  it('이미 지난 dueDate 는 거부되고 이유를 말한다 — 방금 세운 계획이 즉시 만기가 되면 그것이 과발화다', async () => {
    const id = await openCase();
    await handleAdopt(U, { caseId: id, choiceOrPolicy: 'x' });
    const res = await handlePlan(U, {
      caseId: id,
      steps: [{ what: '지난 약속', kind: 'execute', byOrWhen: '어제', dueDate: '2020-01-01T00:00:00Z' }],
    });
    expect(isErr(res)).toBe(true);
    expect(text(res)).toContain('이미 지난 날짜');
    expect(returns).toEqual([]);
    expect(events.get(id)!.some((e) => e.type === 'plan_adopted')).toBe(false);
  });

  it('날짜가 아닌 dueDate 도 조용히 넘어가지 않는다 (DB 에 도달하기 전에 막는다)', async () => {
    const id = await openCase();
    await handleAdopt(U, { caseId: id, choiceOrPolicy: 'x' });
    const res = await handlePlan(U, {
      caseId: id,
      steps: [{ what: 'a', kind: 'execute', byOrWhen: '다음 주', dueDate: '다음 주 월요일' }],
    });
    expect(isErr(res)).toBe(true);
    expect(text(res)).toContain('날짜가 아니다');
  });
});

// ── 해자: 정산 결과가 다음 결정으로 돌아온다 ─────────────────────────────
//
// 이 제품이 범용 AI와 갈리는 유일한 지점이다. 계획은 어디서나 받을 수 있지만
// "지난번엔 이렇게 가정했고 현실은 이렇게 답했다"는 기록해 둔 쪽만 말할 수 있다.
describe('argus_recall — 정산된 것이 실제로 돌아온다', () => {
  async function settledCase(utterance = '가격을 올릴까 말까 고민이야') {
    const id = await openCase(utterance);
    await handleAdopt(U, { caseId: id, choiceOrPolicy: '10% 인상' });
    await handlePlan(U, {
      caseId: id,
      steps: [{ what: '이탈률 확인', kind: 'investigate', byOrWhen: '2주', dueDate: '2099-09-01T00:00:00Z' }],
    });
    await handleReturn(U, { caseId: id, observation: '이탈은 3%였고 매출은 8% 늘었다' });
    await handleReturn(U, {
      caseId: id,
      observation: '이탈은 3%였고 매출은 8% 늘었다',
      recall: '고객이 가격에 민감할까 봐 망설였다',
    });
    return id;
  }

  it('정산이 끝나면 그때의 선택·기억·실제가 케이스에 남는다', async () => {
    const id = await settledCase();
    const row = cases.get(id)!;
    expect(row.choice).toBe('10% 인상');
    expect(row.last_observation).toContain('이탈은 3%');
    expect(row.recall_gap).toContain('망설였다');
    expect(row.settled_at).toBeTruthy();
  });

  it('한 건을 물으면 그때의 가정과 실제를 나란히 돌려준다', async () => {
    const id = await settledCase();
    const res = await handleRecall(U, { caseId: id });
    expect(text(res)).toContain('10% 인상');
    expect(text(res)).toContain('망설였다');
    expect(text(res)).toContain('이탈은 3%');
    expect(text(res)).toContain('결과를 알고 나면 누구나 이유를 다시 씁니다');
  });

  it('목록은 정산된 것을 먼저, 실제로 일어난 일과 함께 보여준다', async () => {
    await settledCase();
    await openCase('채용을 미룰까 고민이야');
    const res = await handleRecall(U, {});
    const body = text(res);
    expect(body).toContain('현실이 답을 준 결정 1건');
    expect(body).toContain('실제로: "이탈은 3%였고 매출은 8% 늘었다"');
    expect(body).toContain('아직 정산되지 않은 결정 1건');
    expect(body.indexOf('현실이 답을 준')).toBeLessThan(body.indexOf('아직 정산되지 않은'));
  });

  it('아직 정산 안 된 것을 정산된 것처럼 말하지 않는다', async () => {
    const id = await openCase();
    const res = await handleRecall(U, { caseId: id });
    expect(text(res)).toContain('아직 정산되지 않았습니다');
    expect(text(res)).not.toContain('실제로 일어난 일');
  });

  it('없는 id 는 없다고 말한다 (빈 기록을 지어내지 않는다)', async () => {
    const res = await handleRecall(U, { caseId: 'case_유령' });
    expect(isErr(res)).toBe(true);
  });

  it('검색어는 실제 결과 문장에도 걸린다 — "그때 매출이 어땠더라"로 찾을 수 있어야 한다', async () => {
    await settledCase();
    await openCase('채용을 미룰까 고민이야');
    const res = await handleRecall(U, { query: '매출' });
    expect(text(res)).toContain('현실이 답을 준 결정 1건');
    expect(text(res)).not.toContain('채용을 미룰까');
  });
});

// ── 범위 위임 (TWIN §4.5) ─────────────────────────────────────────────────
//
// 이 표면의 실패 형태는 "안 되는 것"이 아니라 **사용자가 말하지 않은 위임이
// 생기는 것**, 그리고 **위임을 꺼내 놓고도 그 사실이 성적에 반영되지 않는
// 것**이다. 둘 다 조용히 그럴듯하게 동작하므로 여기서 기계로 잡는다.
describe('argus_open — 위임 적용', () => {
  it('위임이 없으면 응답에 아무것도 붙지 않는다 (침묵이 기본값)', async () => {
    const res = await handleOpen(U, { utterance: '가격을 올릴까', lean: '올린다' });
    expect(text(res)).not.toContain('위임');
  });

  it('위임이 맞으면 정책 원문과 채택 시 보낼 id 를 함께 싣는다', async () => {
    delegationMatch = {
      delegation: { id: 'deleg-1', policy: '현금이 빠듯하면 고정비를 늘리지 않는다' },
      text: '\n\n---\n당신이 위임해 둔 정책이 이 조건에 해당합니다.',
    };
    const res = await handleOpen(U, { utterance: '사람을 더 뽑을까', lean: '뽑는다', userInvoked: true });
    expect(text(res)).toContain('위임해 둔 정책');
    expect(text(res)).toContain('deleg-1');
  });

  it('위임이 꺼내지면 서버가 직접 케이스에 남긴다 — 모델의 에코에 기대지 않는 결정론 백스톱', async () => {
    delegationMatch = {
      delegation: { id: 'deleg-1', policy: '현금이 빠듯하면 고정비를 늘리지 않는다' },
      text: '',
    };
    const res = await handleOpen(U, { utterance: '사람을 더 뽑을까', userInvoked: true });
    const id = /id: (case_[a-z0-9_]+)/.exec(text(res))?.[1];
    expect(offeredMarks).toEqual([{ caseId: id, delegationId: 'deleg-1' }]);
  });

  it('꺼내진 위임이 채택에서 확인되지 않았으면, 정산이 그 누락을 말한다 — 침묵이 아니라 정직한 공백', async () => {
    const id = await openCase();
    await handleAdopt(U, { caseId: id, choiceOrPolicy: '10% 인상' });
    await handlePlan(U, {
      caseId: id,
      steps: [{ what: '이탈률 확인', kind: 'investigate', byOrWhen: '2주', dueDate: '2026-09-01T00:00:00Z' }],
    });
    // 서버 기록(offered)은 있는데 모델이 appliedDelegationId 를 빼먹은 상황.
    offeredId = 'deleg-1';
    await handleReturn(U, { caseId: id, observation: '이탈률 3%였다' });
    const res = await handleReturn(U, { caseId: id, observation: '이탈률 3%였다', recall: '마진 때문' });
    expect(text(res)).toContain('채점하지 않았습니다');
    expect(text(res)).toContain('지어내지 않습니다');
  });

  it('위임이 꺼내지면 그림자는 그 정책을 기울기로 받는다 — choice 예측이 자명해지기 때문', async () => {
    delegationMatch = {
      delegation: { id: 'deleg-1', policy: '현금이 빠듯하면 고정비를 늘리지 않는다' },
      text: '',
    };
    await handleOpen(U, { utterance: '사람을 더 뽑을까', userInvoked: true });
    expect(sealed).toHaveLength(1);
    expect(sealed[0].lean).toBe('현금이 빠듯하면 고정비를 늘리지 않는다');
  });

  it('사용자가 말한 기울기가 있으면 그것이 우선한다 — 위임이 사용자 발화를 덮지 않는다', async () => {
    delegationMatch = { delegation: { id: 'deleg-1', policy: '정책 문장' }, text: '' };
    await handleOpen(U, { utterance: '사람을 더 뽑을까', lean: '정규직으로 뽑는다', userInvoked: true });
    expect(sealed[0].lean).toBe('정규직으로 뽑는다');
  });
});

describe('argus_adopt — 위임 생성·표시', () => {
  it('만들었으면 만료와 함께 밝히고, 결정을 대신하지 않는다고 적는다', async () => {
    const id = await openCase();
    const res = await handleAdopt(U, {
      caseId: id,
      choiceOrPolicy: '계약직으로 간다',
      delegation: {
        policy: '현금이 빠듯하면 계약직',
        scopeDomain: '채용',
        scopeCondition: '현금이 빠듯할 때',
        userWords: '앞으로는 늘 이렇게 하자',
      },
    });
    expect(text(res)).toContain('위임이 만들어졌습니다');
    expect(text(res)).toContain('결정을 대신하지는 않습니다');
  });

  it('거부되면 **왜 거부했는지** 응답에 그대로 적는다 (조용히 안 만들지 않는다)', async () => {
    delegationCreate = { ok: false, reason: '위임은 사용자가 직접 말한 문장으로만 생깁니다.' };
    const id = await openCase();
    const res = await handleAdopt(U, {
      caseId: id,
      choiceOrPolicy: '계약직으로 간다',
      delegation: { policy: 'p', scopeDomain: 'd', scopeCondition: 'c', userWords: '' },
    });
    expect(text(res)).toContain('위임은 만들지 않았습니다');
    expect(text(res)).toContain('사용자가 직접 말한 문장');
  });

  it('위임을 따른 채택은 케이스에 도장이 찍힌다 — 정산이 채점할 대상이 여기서 생긴다', async () => {
    const id = await openCase();
    await handleAdopt(U, { caseId: id, choiceOrPolicy: '계약직으로 간다', appliedDelegationId: 'deleg-1' });
    expect(marked).toEqual([{ caseId: id, delegationId: 'deleg-1' }]);
  });

  it('위임 인자가 없으면 위임 이야기를 꺼내지 않는다', async () => {
    const id = await openCase();
    const res = await handleAdopt(U, { caseId: id, choiceOrPolicy: '계약직으로 간다' });
    expect(text(res)).not.toContain('위임');
  });
});

// ── 한 번 열었으면 기계는 한 번만 말한다 (거울 조항) ─────────────────────
describe('argus_open — 발화는 한 건만', () => {
  it('위임이 발화하면 이탈 crux 는 부르지도 않는다', async () => {
    delegationMatch = { delegation: { id: 'deleg-1', policy: 'P' }, text: '\n\n---\n위임 문장' };
    cruxText = '\n\n---\n이탈 질문';
    const res = await handleOpen(U, { utterance: '사람을 더 뽑을까', userInvoked: true, lean: '뽑는다' });
    expect(cruxCalls).toBe(0);
    expect(text(res)).toContain('위임 문장');
    expect(text(res)).not.toContain('이탈 질문');
  });

  it('위임이 없으면 이탈 crux 가 그 자리를 쓴다', async () => {
    cruxText = '\n\n---\n이탈 질문';
    const res = await handleOpen(U, { utterance: '사람을 더 뽑을까', userInvoked: true, lean: '뽑는다' });
    expect(cruxCalls).toBe(1);
    expect(text(res)).toContain('이탈 질문');
  });
});

// ── 콜드스타트 인테이크 (handoff §6-A) — 자료는 증거로만 ─────────────────
describe('argus_open — 기존 자료 인테이크', () => {
  const MATERIALS = [
    { title: '2월 가격 회의록', kind: 'document', excerpt: '"인상 시 이탈 3% 추정" — 재무팀', whyRelevant: '이탈 추정의 근거' },
    { title: '작년 대화', kind: 'conversation', excerpt: '작년에는 인상을 미루기로 했었다' },
  ];

  it('자료가 external_source 이벤트로 원장에 남고, 응답이 건수를 말한다', async () => {
    const res = await handleOpen(U, { utterance: '가격을 올릴까 말까 고민이야', materials: MATERIALS });
    expect(isErr(res)).toBe(false);
    expect(text(res)).toContain('기존 자료 2건');
    const evs = [...events.values()][0];
    const sources = evs.filter((e) => e.type === 'external_source') as Array<{ description: string; sourceRef: string }>;
    expect(sources).toHaveLength(2);
    expect(sources[0].description).toContain('이탈 3% 추정'); // 인용이 그대로 남는다
    expect(sources[0].sourceRef).toBe('chat-material:document:2월 가격 회의록');
  });

  it('자료가 있어도 사용자가 말하지 않은 기울기는 생기지 않는다 (저자성 세탁 차단)', async () => {
    // 자료에 "인상한다"는 과거 문장이 있어도, lean 을 안 보냈으면 부재가 부재로 남는다.
    await handleOpen(U, {
      utterance: '가격을 올릴까 말까 고민이야',
      materials: [{ title: '작년 계획서', kind: 'document', excerpt: '올해는 인상한다' }],
    });
    const evs = [...events.values()][0];
    expect(evs.some((e) => e.type === 'baseline_not_captured')).toBe(true);
    expect(evs.some((e) => e.type === 'baseline_captured')).toBe(false);
  });

  it('상한을 넘는 인용은 자르지 않고 거절하며, 그 사실을 말한다', async () => {
    const res = await handleOpen(U, {
      utterance: '가격을 올릴까 말까 고민이야',
      materials: [
        { title: '통째 문서', excerpt: 'a'.repeat(MATERIAL_EXCERPT_MAX + 1) },
        { title: '정상 인용', excerpt: '마진 8%' },
      ],
    });
    expect(text(res)).toContain('기존 자료 1건');
    expect(text(res)).toContain('1건은 인용이');
    const evs = [...events.values()][0];
    const sources = evs.filter((e) => e.type === 'external_source') as Array<{ description: string }>;
    expect(sources).toHaveLength(1); // 잘린 인용이 몰래 들어가지 않았다
    expect(sources[0].description).toContain('마진 8%');
  });

  it('건수 상한을 넘으면 넘친 만큼 기록하지 않고 말한다', async () => {
    const many = Array.from({ length: MATERIAL_MAX_COUNT + 2 }, (_, i) => ({ title: `자료 ${i}`, excerpt: `대목 ${i}` }));
    const res = await handleOpen(U, { utterance: '가격을 올릴까 말까 고민이야', materials: many });
    expect(text(res)).toContain(`기존 자료 ${MATERIAL_MAX_COUNT}건`);
    expect(text(res)).toContain('2건은 한도');
    const evs = [...events.values()][0];
    expect(evs.filter((e) => e.type === 'external_source')).toHaveLength(MATERIAL_MAX_COUNT);
  });

  it('readMaterials — title/excerpt 없는 항목은 기록하지 않고 센다', () => {
    const r = readMaterials([
      { title: '', excerpt: '대목' },
      { title: '이름만' },
      { title: '정상', excerpt: '대목' },
      'garbage',
    ]);
    expect(r.accepted).toHaveLength(1);
    expect(r.droppedMalformed).toBe(3);
    expect(formatMaterialNote(r)).toContain('3건은 title/excerpt');
  });

  it('자료 없이 열면 인테이크 문안이 붙지 않는다 (조용한 기본값)', async () => {
    const res = await handleOpen(U, { utterance: '가격을 올릴까 말까 고민이야' });
    expect(text(res)).not.toContain('기존 자료');
    expect(text(res)).not.toContain('기록하지 않은 자료');
  });
});
