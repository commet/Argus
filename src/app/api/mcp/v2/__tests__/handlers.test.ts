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
const cases = new Map<string, { id: string; title: string; state: string; updated_at: string }>();
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
    cases.set(caseId, { id: caseId, title, state, updated_at: new Date().toISOString() });
  },
  listCases: async () => [...cases.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
  armReturns: async (_u: string, caseId: string, rs: Array<{ kind: string; dueAt: string; fromStep?: string }>) => {
    for (const r of rs) returns.push({ case_id: caseId, kind: r.kind, due_at: r.dueAt, from_step: r.fromStep, status: 'armed' });
  },
  completeReturns: async (_u: string, caseId: string) => {
    returns = returns.map((r) => (r.case_id === caseId ? { ...r, status: 'completed' } : r));
  },
  dueReturns: async (_u: string, at: string) =>
    returns.filter((r) => ['armed', 'sent'].includes(r.status) && r.due_at <= at),
}));

const {
  handleAdopt,
  handleOpen,
  handlePlan,
  handleRecall,
  handleReturn,
  handleSharpen,
  formatDueNotice,
  MAX_INLINE_NOTICES,
} = await import('../handlers');

const U = 'user-1';
const text = (r: { content: Array<{ text: string }> }) => r.content[0].text;
const isErr = (r: { isError?: boolean }) => r.isError === true;

beforeEach(() => {
  events.clear();
  cases.clear();
  returns = [];
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

  it('관찰만 왔을 때는 회상을 묻고, 여전히 기록을 열지 않는다', async () => {
    const id = await plannedCase();
    const res = await handleReturn(U, { caseId: id, observation: '이탈률 3%였다' });
    expect(text(res)).toContain('왜 그렇게 정했는지');
    expect(text(res)).not.toContain('10% 인상');
    expect(events.get(id)!.some((e) => e.type === 'record_revealed')).toBe(false);
  });

  it('관찰과 회상이 다 오면 그때 기록을 열고, 귀환을 닫는다', async () => {
    const id = await plannedCase();
    await handleReturn(U, { caseId: id, observation: '이탈률 3%였다' });
    const res = await handleReturn(U, { caseId: id, observation: '이탈률 3%였다', recall: '마진 때문이었던 듯' });
    expect(text(res)).toContain('10% 인상');
    expect(text(res)).toContain('마진 때문이었던 듯');
    expect(returns.every((r) => r.status === 'completed')).toBe(true);
    expect(events.get(id)!.some((e) => e.type === 'return_closed')).toBe(true);
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
    expect(text(res)).toContain('1/2건');
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
