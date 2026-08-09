// 케이스 시뮬레이션 — 도구 단위가 아니라 **여정 단위**로 부순다.
//
// handlers.test.ts 가 각 도구의 계약을 지키는지 본다면, 이 파일은 실제 사용
// 순서(그리고 실제로 일어나는 잘못된 순서)를 통째로 주행한다: 이중 채택, 계획
// 마일스톤 연쇄의 2·3사이클, 재계획, 정산 뒤 나중 사실, 투영 유실 복구, 알림
// 절삭. 2026-08-09 라운드 2 감사에서 이 여정들이 실제로 걸러낸 결함이 각
// 테스트에 주석으로 남아 있다 — 전부 "크게 실패하지 않고 그럴듯하게 동작"하던
// 형태였다 (CLAUDE.md LLM-glue 불변식이 겨냥하는 바로 그것).

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Ledger, restoreLedger } from '../../../../../../method-harness/ledger';
import { SessionEngine } from '../../../../../../method-harness/surfaces/engine';
import type { LedgerEvent } from '../../../../../../method-harness/types';

// ── 메모리 store — handlers.test.ts 와 같은 골격, 귀환 큐만 행 단위로 충실하게 ──
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
type ReturnRow = { case_id: string; kind: string; due_at: string; from_step?: string | null; status: string };
let returns: ReturnRow[] = [];

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
  updateLastObservation: async (_u: string, caseId: string, observation: string) => {
    const row = cases.get(caseId);
    if (row) cases.set(caseId, { ...row, last_observation: observation });
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
    if (target) {
      returns = returns.map((r) => (r === target ? { ...r, status: 'completed' } : r));
    }
  },
  dueReturns: async (_u: string, at: string, limit = 3) =>
    returns.filter((r) => ['armed', 'sent'].includes(r.status) && r.due_at <= at).slice(0, limit),
}));

// TWIN 표면 — 여정 검증에 필요 없는 것은 침묵으로 고정한다 (handlers.test.ts 와
// 같은 이유: mock 하지 않으면 try/catch 가 삼켜 조용히 지나간다).
vi.mock('@/lib/twin/shadow', () => ({
  runAfterResponse: (fn: () => Promise<unknown> | unknown) => {
    void fn();
  },
  generateAndSealShadow: async () => {},
  revealShadowsText: async () => ({ text: '', revealed: [] }),
  gradeRevealedShadows: async () => {},
}));
vi.mock('@/lib/twin/delegation', () => ({
  applyDelegation: async () => null,
  createDelegation: async () => ({ ok: false, reason: 'unused' }),
  markCaseDelegation: async () => {},
  markCaseDelegationOffered: async () => {},
  offeredDelegationId: async () => null,
  caseDelegationId: async () => null,
  gradeDelegation: async () => null,
  describeDelegationGrade: () => '',
  DELEGATION_DEFAULT_DAYS: 30,
  DELEGATION_MAX_DAYS: 90,
}));
vi.mock('@/lib/twin/divergence', () => ({ divergenceCrux: async () => '' }));
vi.mock('@/lib/twin/profile', () => ({
  profileLines: async () => [],
  recentlyRetiredLines: async () => [],
  extractProfileFromSettlement: async () => ({ inserted: 0, reinforced: 0, contradicted: 0, retired: 0 }),
}));
vi.mock('@/lib/twin/beliefs', () => ({
  beliefCalibration: async () => ({}),
  calibrationLines: () => '',
  gradeStatedBeliefs: async () => {},
}));
vi.mock('@/lib/twin/store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/twin/store')>()),
  twinScore: async () => ({
    matchRate: null,
    matchSample: 0,
    outcomeRate: null,
    outcomeSample: 0,
    matchCases: [],
    outcomeCases: [],
  }),
}));
vi.mock('@/lib/server-events', () => ({ persistServerEvent: async () => {} }));

const { handleAdopt, handleOpen, handlePlan, handleRecall, handleReturn, handleSharpen } = await import('../handlers');

const U = 'user-sim';
const text = (r: { content: Array<{ text: string }> }) => r.content.map((c) => c.text).join('\n');
const isErr = (r: { isError?: boolean }) => r.isError === true;
const caseIdOf = (r: { content: Array<{ text: string }> }) => /id: (case_[a-z0-9_]+)/.exec(text(r))![1];

const futureIso = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

async function openAdopted(utterance = '이번 분기 가격을 올릴지 결정해야 한다'): Promise<string> {
  const opened = await handleOpen(U, { utterance, userInvoked: true, lean: '올리는 쪽' });
  const caseId = caseIdOf(opened);
  const adopted = await handleAdopt(U, {
    caseId,
    choiceOrPolicy: '10% 인상, 기존 고객은 6개월 유예',
    stakes: { weight: 'significant', reversibility: 'costly' },
  });
  expect(isErr(adopted)).toBe(false);
  return caseId;
}

// 3단계 마일스톤 계획 — 셋 다 미래 기한이라 귀환 계약 3건이 걸린다.
async function planThree(caseId: string) {
  const r = await handlePlan(U, {
    caseId,
    steps: [
      { what: '가격 페이지 갱신', kind: 'execute', byOrWhen: '이번 주', dueDate: futureIso(3) },
      { what: '기존 고객 공지 발송', kind: 'execute', byOrWhen: '다음 주', dueDate: futureIso(10) },
      { what: '이탈률 확인', kind: 'investigate', byOrWhen: '한 달 뒤', dueDate: futureIso(30) },
    ],
  });
  expect(isErr(r)).toBe(false);
  return r;
}

const armedRows = (caseId: string) => returns.filter((r) => r.case_id === caseId && r.status === 'armed');
const completedRows = (caseId: string) => returns.filter((r) => r.case_id === caseId && r.status === 'completed');

beforeEach(() => {
  events.clear();
  cases.clear();
  returns = [];
});

// ── 여정 1 · 이중 채택 ────────────────────────────────────────────────────
//
// 모델의 재시도, 사용자의 "다시 말하지만 이대로 할게" — 채택이 두 번 오는 경로는
// 현실에 흔하다. 라운드 2 감사 전에는 두 번째 card_adopted 가 append-only 원장에
// **들어간 뒤에** fold 가 던졌다: 이후 그 케이스의 모든 읽기가 영구히 실패했다
// (지울 수 없으므로). 지금은 엔진이 append 전에 막고, 표면은 정중히 거절한다.
describe('여정: 이중 채택은 케이스를 죽이지 못한다', () => {
  it('두 번째 채택은 정직한 거절이고, 케이스는 그 뒤로도 멀쩡히 동작한다', async () => {
    const caseId = await openAdopted();

    const second = await handleAdopt(U, { caseId, choiceOrPolicy: '15% 인상으로 변경' });
    expect(isErr(second)).toBe(true);
    expect(text(second)).toContain('이미');

    // 원장에는 card_adopted 가 정확히 한 번만 있다 — 오염 이벤트가 없다.
    const adoptedEvents = (events.get(caseId) ?? []).filter((e) => e.type === 'card_adopted');
    expect(adoptedEvents).toHaveLength(1);

    // 케이스가 죽지 않았다: 이후 도구 호출이 전부 정상 동작한다.
    const sharpen = await handleSharpen(U, { caseId });
    expect(isErr(sharpen)).toBe(false);
    const plan = await planThree(caseId);
    expect(isErr(plan)).toBe(false);
  });
});

// ── 여정 2 · 마일스톤 연쇄 — 첫 정산이 나머지 약속을 죽이지 않는다 ─────────
//
// 라운드 2 감사 전: 1사이클 정산이 completeReturns(전건)를 불러 **아직 오지 않은
// 마일스톤 2건의 큐 행까지 완료**로 닫았다. 엔진의 연쇄는 다음 귀환을 승격했는데
// 스케줄러 큐는 비어 있었다 — 이메일도 채팅 알림도 영영 오지 않는, 소리 없는
// 전선 단선이다.
describe('여정: 계획 3건 마일스톤의 연쇄 정산', () => {
  it('1사이클 정산은 큐 행 하나만 닫고, 남은 마일스톤 2건은 armed 로 남는다', async () => {
    const caseId = await openAdopted();
    await planThree(caseId);
    expect(armedRows(caseId)).toHaveLength(3);

    // 1사이클: 관찰 → 회상 → 기록 공개.
    const obs = await handleReturn(U, { caseId, observation: '가격 페이지를 올렸고 문의가 2건 왔다' });
    expect(isErr(obs)).toBe(false);
    const settled = await handleReturn(U, { caseId, recall: '경쟁사보다 쌌기 때문' });
    expect(isErr(settled)).toBe(false);
    expect(text(settled)).toContain('그때의 기록');

    expect(completedRows(caseId)).toHaveLength(1);
    expect(armedRows(caseId)).toHaveLength(2);
  });

  it('2사이클은 지난 사이클의 관찰을 재사용하지 않는다 — 관찰 우선은 사이클마다 다시 선다', async () => {
    const caseId = await openAdopted();
    await planThree(caseId);
    await handleReturn(U, { caseId, observation: '가격 페이지를 올렸다' });
    await handleReturn(U, { caseId, recall: '경쟁사보다 쌌기 때문' });

    // 2사이클을 회상만 들고 열면, 1사이클의 관찰로 기록을 열어버리면 안 된다.
    const r = await handleReturn(U, { caseId, recall: '공지 문안은 내가 직접 썼지' });
    expect(isErr(r)).toBe(true);
    expect(text(r)).toContain('무슨 일이 있었는지');

    // 새 관찰이 오면 2사이클이 정상 완주된다.
    const obs2 = await handleReturn(U, { caseId, observation: '공지를 보냈고 해지 문의는 없었다' });
    expect(isErr(obs2)).toBe(false);
    const settled2 = await handleReturn(U, { caseId, recall: '유예를 뒀으니 반발이 적을 거라 봤다' });
    expect(isErr(settled2)).toBe(false);
    expect(text(settled2)).toContain('공지를 보냈고 해지 문의는 없었다');

    expect(completedRows(caseId)).toHaveLength(2);
    expect(armedRows(caseId)).toHaveLength(1);
  });

  it('마지막 사이클이 끝나면 큐가 전부 닫히고 케이스는 REVIEWED 다', async () => {
    const caseId = await openAdopted();
    await planThree(caseId);
    for (const [obs, rec] of [
      ['페이지를 올렸다', '쌌기 때문'],
      ['공지를 보냈다', '반발이 적을 거라 봤다'],
      ['이탈률 1% — 예상보다 낮다', '유예 덕분이라 생각했다'],
    ]) {
      await handleReturn(U, { caseId, observation: obs });
      const r = await handleReturn(U, { caseId, recall: rec });
      expect(isErr(r)).toBe(false);
    }
    expect(armedRows(caseId)).toHaveLength(0);
    expect(completedRows(caseId)).toHaveLength(3);
    expect(cases.get(caseId)?.state).toBe('REVIEWED');
  });
});

// ── 여정 3 · 재계획은 귀환을 쌓지 않는다 ─────────────────────────────────
//
// 계획을 두 번 보내면 (모델 재시도·계획 수정 시도) 귀환 계약이 3+3 으로 쌓여
// 전역 예산(3)을 혼자 다 먹고, 연쇄 큐에는 낡은 계약이 남는다 — 과발화 제조기다.
// 수정 지원 전까지는 정직하게 거절한다.
describe('여정: 재계획', () => {
  it('계획이 이미 있으면 거절하고 이유를 말한다 — 귀환 행이 늘지 않는다', async () => {
    const caseId = await openAdopted();
    await planThree(caseId);
    const before = armedRows(caseId).length;

    const again = await handlePlan(U, {
      caseId,
      steps: [{ what: '전면 재검토', kind: 'investigate', byOrWhen: '내일', dueDate: futureIso(1) }],
    });
    expect(isErr(again)).toBe(true);
    expect(text(again)).toContain('이미');
    expect(armedRows(caseId)).toHaveLength(before);
  });
});

// ── 여정 4 · 정산 뒤 나중 사실 ────────────────────────────────────────────
//
// "나중 사실은 덧붙는다"고 응답하면서 투영(argus_cases.last_observation)은 정산
// 시점 값에 머물러 있었다 — recall 이 보여주는 "실제로 일어난 일"이 낡은 채로
// 남으니, 덧붙었다는 말이 화면에서는 거짓이 된다.
describe('여정: 정산이 끝난 결정에 나중 사실이 오면', () => {
  async function settleSimple(): Promise<string> {
    const caseId = await openAdopted();
    await handleReturn(U, { caseId, observation: '첫 달 이탈률 3%' });
    const r = await handleReturn(U, { caseId, recall: '가격 민감도가 낮다고 봤다' });
    expect(isErr(r)).toBe(false);
    return caseId;
  }

  it('원장에 덧붙고, recall 의 "실제로 일어난 일"도 새 사실로 갱신된다', async () => {
    const caseId = await settleSimple();
    const later = await handleReturn(U, { caseId, observation: '두 달째 이탈률 7% — 첫 달의 배 이상' });
    expect(isErr(later)).toBe(false);
    expect(text(later)).toContain('덧붙였습니다');

    const recall = await handleRecall(U, { caseId });
    expect(text(recall)).toContain('두 달째 이탈률 7%');
    // 정산 시점의 회상 격차는 그대로 보존된다 — 갱신되는 것은 현실 쪽뿐이다.
    expect(text(recall)).toContain('가격 민감도가 낮다고 봤다');
  });

  it('투영이 유실됐어도 (정산 직후 서버가 죽는 등) 다음 접촉에서 스스로 복구한다', async () => {
    const caseId = await settleSimple();
    // 투영 유실 시뮬레이션: 원장에는 record_revealed 가 있는데 행에는 정산 흔적이 없다.
    const row = cases.get(caseId)!;
    cases.set(caseId, { ...row, settled_at: null, last_observation: null, recall_gap: null, choice: null });

    const touch = await handleReturn(U, { caseId });
    expect(text(touch)).toContain('정산이 끝났습니다');

    // 접촉 한 번으로 투영이 원장에서 재생됐다 — recall 과 return 이 다시 같은 사실을 말한다.
    const healed = cases.get(caseId)!;
    expect(healed.settled_at).toBeTruthy();
    expect(healed.last_observation).toContain('이탈률 3%');
    expect(healed.recall_gap).toContain('가격 민감도');
    const recall = await handleRecall(U, { caseId });
    expect(text(recall)).not.toContain('아직 정산되지 않았습니다');
  });
});

// ── 여정 5 · 채팅 알림의 조용한 절삭 금지 ────────────────────────────────
describe('여정: 돌아올 것이 상한보다 많을 때', () => {
  it('두 건만 보여주되, 더 있다는 사실을 숨기지 않는다', async () => {
    // 기한 지난 귀환 3건 (서로 다른 케이스).
    for (let i = 0; i < 3; i += 1) {
      returns.push({
        case_id: `case_due_${i}`,
        kind: 'outcome',
        due_at: new Date(Date.now() - (i + 1) * 60_000).toISOString(),
        from_step: `확인 ${i}`,
        status: 'armed',
      });
    }
    const opened = await handleOpen(U, { utterance: '새 결정을 하나 열어야겠다', userInvoked: true });
    const body = text(opened);
    // 표시는 2건까지 — 그러나 "2건 있습니다"라고 말하면 세 번째가 조용히 사라진다.
    expect(body).toContain('돌아볼 때가 된 결정');
    expect(body).not.toMatch(/돌아볼 때가 된 결정이 2건 있습니다/);
    expect(body).toMatch(/더 있|외에도/);
  });
});

// ── 여정 6 · 정산된 결정은 최근성에 밀려나지 않는다 ──────────────────────
//
// 목록은 "정산된 것 먼저"를 약속하는데, 라운드 3 전에는 **최근 갱신순 상위
// limit 건을 먼저 뽑은 뒤에** 정산/미정산을 나눴다 — 열린 결정이 limit 개를
// 넘는 순간 정산된 결정(이 제품이 범용 AI와 구분되는 유일한 것)이 목록에서
// 통째로 사라졌다.
describe('여정: 열린 결정이 많아도 정산 기록은 보인다', () => {
  it('open 케이스 12건 뒤에서도 정산된 케이스가 목록에 나온다', async () => {
    // 정산된 케이스 하나를 먼저 만든다.
    const settled = await openAdopted('작년 가격 인상 결정');
    await handleReturn(U, { caseId: settled, observation: '이탈 없이 매출 12% 증가' });
    await handleReturn(U, { caseId: settled, recall: '수요가 비탄력적이라 봤다' });

    // 그 위에 열린 결정 12건을 쌓는다 (전부 더 최근).
    for (let i = 0; i < 12; i += 1) {
      await handleOpen(U, { utterance: `신규 검토 ${i} — 채용을 할지 말지`, userInvoked: true });
    }

    const list = await handleRecall(U, {}); // 기본 limit 10
    expect(text(list)).toContain('현실이 답을 준 결정');
    expect(text(list)).toContain('이탈 없이 매출 12% 증가');
  });
});

// ── 여정 7 · 입력 상한 — 자르지 않고 거절한다 ────────────────────────────
//
// MCP 입력은 폼이 아니라 모델이 만든다: maxLength 를 강제할 브라우저가 없다.
// 상한 없는 자유 텍스트는 원장(payload jsonb)을 무한히 불릴 수 있다. 자료
// 인테이크와 같은 규율로: 자르면 기록이 왜곡되므로 자르지 않고 거절하고 말한다.
describe('여정: 비대한 입력', () => {
  it('상한을 넘는 utterance 는 기록 전에 거절되고, 그 사실을 말한다', async () => {
    const r = await handleOpen(U, { utterance: 'ㅁ'.repeat(20_000), userInvoked: true });
    expect(isErr(r)).toBe(true);
    expect(text(r)).toMatch(/자|길이|넘/);
    expect(events.size).toBe(0); // 원장에 아무것도 남지 않았다
  });

  it('상한을 넘는 observation 도 같은 규율을 따른다', async () => {
    const caseId = await openAdopted();
    const before = (events.get(caseId) ?? []).length;
    const r = await handleReturn(U, { caseId, observation: 'ㅇ'.repeat(20_000) });
    expect(isErr(r)).toBe(true);
    expect((events.get(caseId) ?? []).length).toBe(before);
  });

  it('목록 입력도 상한이 있다 — 25건짜리 values 는 거절되고 케이스는 멀쩡하다', async () => {
    const opened = await handleOpen(U, { utterance: '가격을 올릴까', userInvoked: true });
    const caseId = caseIdOf(opened);
    const r = await handleAdopt(U, {
      caseId,
      choiceOrPolicy: '올린다',
      values: Array.from({ length: 25 }, (_, i) => `가치 ${i}`),
    });
    expect(isErr(r)).toBe(true);
    expect(text(r)).toContain('상한');
    // 거절 뒤 정상 채택은 그대로 된다.
    const retry = await handleAdopt(U, { caseId, choiceOrPolicy: '올린다', values: ['지속가능성'] });
    expect(isErr(retry)).toBe(false);
  });

  it('계획 단계 문장도 상한이 있다 — 귀환 큐와 이메일까지 흐르기 때문', async () => {
    const caseId = await openAdopted();
    const r = await handlePlan(U, {
      caseId,
      steps: [{ what: 'ㅎ'.repeat(2_000), kind: 'execute', byOrWhen: '내일' }],
    });
    expect(isErr(r)).toBe(true);
    expect(text(r)).toContain('상한');
  });

  it('음수 horizonDays 는 조용히 저장되지 않고 이유가 돌아온다', async () => {
    const caseId = await openAdopted();
    const r = await handlePlan(U, {
      caseId,
      horizonDays: -5,
      steps: [{ what: '페이지 갱신', kind: 'execute', byOrWhen: '내일' }],
    });
    expect(isErr(r)).toBe(true);
    expect(text(r)).toContain('양수');
  });
});
