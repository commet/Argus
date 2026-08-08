import { beforeEach, describe, expect, it, vi } from 'vitest';

// TWIN 판단 프로필 — 추출·보강·반례·은퇴의 기계 확인.
//
// 프로필이 지키는 불변식:
// 1. 증거 케이스가 실제로 정산돼 있지 않으면 **아무것도** 바꾸지 않는다 (fail-closed).
//    새 항목뿐 아니라 보강·반례도 그 증거를 근거로 쓰기 때문이다.
// 2. 정체성 판정 언어는 프로필이 될 수 없다 (zero-judgment)
// 3. 확신도는 **계산값**이다 — LLM 이 매긴 숫자가 저장되는 경로가 없다.
//    현실이 반대로 답해도 첫인상이 그대로 남는 것이 이 제품의 가장 큰 거짓말이다.
// 4. 모델이 같은 번호를 보강과 반례 양쪽에 넣으면 **양쪽에서 다 뺀다**
// 5. 반례가 임계를 넘고 확신도가 무너지면 항목은 은퇴한다 (조용히 삭제하지 않는다)

const inserted: Array<Record<string, unknown>> = [];
const updates: Array<Record<string, unknown>> = [];
let llmResponse: Record<string, unknown> | null = null;
let settledRow: { id: string; settled_at: string } | null = { id: 'case-1', settled_at: '2026-08-06T00:00:00Z' };
let profileRows: Array<Record<string, unknown>> = [];
let retiredRows: Array<Record<string, unknown>> = [];
// argus_cases 는 두 가지로 읽힌다: 단건(정산 확인, maybeSingle)과 목록(백스톱
// 후보 조회). 하나로 합치면 "행이 없다"와 "빈 목록"이 구분되지 않는다.
let caseRows: Array<Record<string, unknown>> = [];
const caseUpdates: Array<Record<string, unknown>> = [];

vi.mock('@/lib/llm-server', () => ({
  callAnthropicJson: vi.fn(async () => llmResponse),
}));

// 체이닝 가능한 최소 fake — .eq().or().order().limit() 처럼 길이가 자주 바뀌는
// 쿼리를 흉내내되, 마지막에 await 되면 정해진 결과를 낸다. 체인 길이를 고정한
// mock 은 쿼리에 조건 하나만 붙어도 무너지고, 그때 깨지는 것은 **테스트지
// 코드가 아니다** — 그런 mock 은 가드가 아니라 유지보수 부채다.
function query(
  listResult: () => { data: unknown; error: unknown },
  singleResult: () => { data: unknown; error: unknown } = listResult,
) {
  const chain: Record<string, unknown> = {};
  for (const k of ['eq', 'or', 'not', 'order', 'limit', 'gte', 'lt', 'in', 'is', 'select']) {
    chain[k] = () => chain;
  }
  chain.maybeSingle = () => Promise.resolve(singleResult());
  chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(listResult()).then(res, rej);
  return chain;
}

// 프로필 조회는 이제 상태별로 두 번 온다 (활성 + 은퇴 — 부활 비대칭 수리).
// .eq('status', …) 를 캡처해 각각 다른 픽스처를 돌려준다.
function profileQuery() {
  let status: string | null = null;
  const chain: Record<string, unknown> = {};
  for (const k of ['or', 'not', 'order', 'limit', 'gte', 'lt', 'in', 'is', 'select']) {
    chain[k] = () => chain;
  }
  chain.eq = (col: string, v: unknown) => {
    if (col === 'status') status = String(v);
    return chain;
  };
  chain.maybeSingle = () => Promise.resolve({ data: null, error: null });
  chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve({ data: status === 'retired' ? retiredRows : profileRows, error: null }).then(res, rej);
  return chain;
}

vi.mock('@/lib/share-guard', () => ({
  adminClient: () => ({
    from: (table: string) => ({
      insert: (rows: Array<Record<string, unknown>>) => {
        if (table === 'argus_profile_items') inserted.push(...rows);
        return Promise.resolve({ error: null });
      },
      update: (values: Record<string, unknown>) => {
        if (table === 'argus_profile_items') updates.push(values);
        if (table === 'argus_cases') caseUpdates.push(values);
        return query(() => ({ data: null, error: null }));
      },
      select: () =>
        table === 'argus_cases'
          ? query(
              () => ({ data: caseRows, error: null }),
              () => ({ data: settledRow, error: null }),
            )
          : profileQuery(),
    }),
  }),
}));

import {
  deriveConfidence,
  settledCasesMissingProfile,
  extractProfileFromSettlement,
  profileLines,
  recentlyRetiredLines,
  resolveIndexFeedback,
  RETIRE_CONFIDENCE,
  violatesJudgmentLanguage,
} from '../profile';

const FACTS = {
  caseId: 'case-1',
  question: '직원을 뽑을 것인가',
  choice: '3개월 계약직',
  statedReasons: ['일이 넘친다'],
  observation: '두 달 만에 퇴사했다',
  recall: '리스크를 줄이려 했다',
};

function existingItem(over: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    layer: 'L3',
    domain: '채용',
    content: '현금이 빠듯할 때 계약직을 먼저 본다',
    evidence_case_ids: ['case-0'],
    counterexamples: [],
    ...over,
  };
}

beforeEach(() => {
  inserted.length = 0;
  updates.length = 0;
  caseUpdates.length = 0;
  profileRows = [];
  retiredRows = [];
  caseRows = [];
  settledRow = { id: 'case-1', settled_at: '2026-08-06T00:00:00Z' };
  llmResponse = {
    items: [{ layer: 'L1', domain: '채용', content: '이 결정에서 가역성을 비용보다 무겁게 쳤다' }],
    reinforces: [],
    contradicts: [],
  };
});

describe('deriveConfidence — 확신도는 세어서 나온다', () => {
  it('근거 1건짜리 항목은 1.0 을 갖지 못한다 (Laplace 평활)', () => {
    expect(deriveConfidence(1, 0)).toBeCloseTo(2 / 3, 5);
  });

  it('근거가 쌓일수록 오르고, 반례가 쌓일수록 내린다', () => {
    expect(deriveConfidence(5, 0)).toBeGreaterThan(deriveConfidence(1, 0));
    expect(deriveConfidence(1, 3)).toBeLessThan(deriveConfidence(1, 0));
  });

  it('반례가 근거를 넘으면 은퇴 임계 아래로 내려간다', () => {
    expect(deriveConfidence(1, 3)).toBeLessThan(RETIRE_CONFIDENCE);
    expect(deriveConfidence(3, 1)).toBeGreaterThan(RETIRE_CONFIDENCE);
  });
});

describe('resolveIndexFeedback — 모델이 돌려준 번호를 좁힌다', () => {
  it('범위 밖·정수 아님·중복을 버린다', () => {
    const r = resolveIndexFeedback({ reinforces: [0, 0, 5, -1, 1.5, 1], contradicts: [] }, 2);
    expect(r.reinforces).toEqual([0, 1]);
  });

  it('보강과 반례에 같은 번호가 오면 양쪽에서 다 뺀다 — 모델이 스스로 모순한 것', () => {
    const r = resolveIndexFeedback({ reinforces: [0, 1], contradicts: [1] }, 2);
    expect(r.reinforces).toEqual([0]);
    expect(r.contradicts).toEqual([]);
  });

  it('배열이 아니면 빈 배열 — 모양이 틀린 응답을 추측으로 메우지 않는다', () => {
    expect(resolveIndexFeedback({ reinforces: 'all', contradicts: null }, 3)).toEqual({
      reinforces: [],
      contradicts: [],
    });
  });
});

describe('extractProfileFromSettlement', () => {
  it('새 항목은 증거 케이스 id 와 **계산된** 확신도로 저장된다', async () => {
    const u = await extractProfileFromSettlement('user-1', FACTS);
    expect(u.inserted).toBe(1);
    expect(inserted[0]).toMatchObject({
      layer: 'L1',
      evidence_case_ids: ['case-1'],
      provenance: 'ai_extracted',
    });
    expect(inserted[0].confidence).toBeCloseTo(deriveConfidence(1, 0), 5);
    // 만료 시각이 반드시 붙는다 — 없으면 그 항목은 영원히 살아남는다.
    expect(typeof inserted[0].expires_at).toBe('string');
  });

  it('LLM 이 매긴 confidence 는 저장 경로가 없다', async () => {
    llmResponse = {
      items: [{ layer: 'L1', domain: '채용', content: '관찰 문장', confidence: 0.99 }],
      reinforces: [],
      contradicts: [],
    };
    await extractProfileFromSettlement('user-1', FACTS);
    expect(inserted[0].confidence).toBeCloseTo(deriveConfidence(1, 0), 5);
  });

  it('증거 케이스가 정산돼 있지 않으면 새 항목도 보강도 하지 않는다 (fail-closed)', async () => {
    settledRow = null;
    profileRows = [existingItem()];
    llmResponse = { items: [], reinforces: [0], contradicts: [] };
    const u = await extractProfileFromSettlement('user-1', FACTS);
    expect(u).toMatchObject({ inserted: 0, reinforced: 0, contradicted: 0 });
    expect(inserted).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });

  it('보강되면 근거가 늘고 확신도가 오르며 만료가 미뤄진다', async () => {
    profileRows = [existingItem()];
    llmResponse = { items: [], reinforces: [0], contradicts: [] };
    const u = await extractProfileFromSettlement('user-1', FACTS);
    expect(u.reinforced).toBe(1);
    expect(updates[0].evidence_case_ids).toEqual(['case-0', 'case-1']);
    expect(updates[0].confidence).toBeCloseTo(deriveConfidence(2, 0), 5);
    expect(typeof updates[0].expires_at).toBe('string');
  });

  it('같은 케이스로 두 번 보강되지 않는다', async () => {
    profileRows = [existingItem({ evidence_case_ids: ['case-1'] })];
    llmResponse = { items: [], reinforces: [0], contradicts: [] };
    const u = await extractProfileFromSettlement('user-1', FACTS);
    expect(u.reinforced).toBe(0);
    expect(updates).toHaveLength(0);
  });

  it('반례 1건으로는 은퇴하지 않는다 — 한 번 어긋났다고 패턴이 없어지지 않는다', async () => {
    profileRows = [existingItem({ evidence_case_ids: ['case-0', 'case-9'] })];
    llmResponse = { items: [], reinforces: [], contradicts: [0] };
    const u = await extractProfileFromSettlement('user-1', FACTS);
    expect(u.contradicted).toBe(1);
    expect(u.retired).toBe(0);
    expect(updates[0].counterexamples).toEqual(['case-1']);
    expect(updates[0].status).toBeUndefined();
  });

  it('반례가 임계를 넘고 확신도가 무너지면 은퇴한다', async () => {
    profileRows = [existingItem({ evidence_case_ids: ['case-0'], counterexamples: ['case-8', 'case-9'] })];
    llmResponse = { items: [], reinforces: [], contradicts: [0] };
    const u = await extractProfileFromSettlement('user-1', FACTS);
    expect(u.retired).toBe(1);
    expect(updates[0].status).toBe('retired');
    expect(Number(updates[0].confidence)).toBeLessThan(RETIRE_CONFIDENCE);
  });

  it('판정 언어 항목은 버려진다 — 프로필은 사람에 대한 진단이 아니다', async () => {
    llmResponse = {
      items: [
        { layer: 'L1', domain: '채용', content: '당신은 리스크 회피 성향이 강한 사람이다' },
        { layer: 'L3', domain: '채용', content: '현금이 빠듯할 때 정규직 대신 계약직을 골랐다' },
      ],
      reinforces: [],
      contradicts: [],
    };
    const u = await extractProfileFromSettlement('user-1', FACTS);
    expect(u.inserted).toBe(1);
    expect(String(inserted[0].content)).toContain('계약직');
  });

  it('아무 변화도 없으면 정산 조회조차 하지 않고 0 을 낸다', async () => {
    llmResponse = { items: [], reinforces: [], contradicts: [] };
    const u = await extractProfileFromSettlement('user-1', FACTS);
    expect(u).toMatchObject({ inserted: 0, reinforced: 0, contradicted: 0, retired: 0 });
  });

  it('LLM 실패 시 던지지 않는다 — 정산 응답을 막으면 안 된다', async () => {
    llmResponse = null;
    await expect(extractProfileFromSettlement('user-1', FACTS)).resolves.toMatchObject({ inserted: 0 });
  });

  it('스키마 밖 항목(잘못된 layer)은 파싱에서 걸러진다', async () => {
    llmResponse = {
      items: [{ layer: 'L9', domain: '채용', content: '유효하지 않은 층' }],
      reinforces: [],
      contradicts: [],
    };
    expect((await extractProfileFromSettlement('user-1', FACTS)).inserted).toBe(0);
  });
});

describe('violatesJudgmentLanguage', () => {
  it.each([
    '당신은 신중한 타입이다',
    '결정 점수 85점',
    '위험 회피 성향이 강하다',
  ])('판정 언어를 잡는다: %s', (s) => {
    expect(violatesJudgmentLanguage(s)).toBe(true);
  });

  it('관찰 문장은 통과한다', () => {
    expect(violatesJudgmentLanguage('이 결정에서 가역성을 비용보다 무겁게 쳤다')).toBe(false);
  });
});

describe('profileLines', () => {
  it('활성 항목을 근거 케이스 id 와 함께 돌려준다', async () => {
    profileRows = [
      { layer: 'L1', domain: '채용', content: '가역성 우선', evidence_case_ids: ['case-1'], counterexamples: [] },
    ];
    const lines = await profileLines('user-1');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('[L1·채용]');
    expect(lines[0]).toContain('case-1');
    expect(lines[0]).not.toContain('반례');
  });

  it('반례가 있으면 개수를 함께 싣는다 — 흔들린 규칙을 굳은 규칙으로 읽히면 안 된다', async () => {
    profileRows = [
      {
        layer: 'L3',
        domain: '채용',
        content: '계약직을 먼저 본다',
        evidence_case_ids: ['case-1', 'case-2'],
        counterexamples: ['case-3'],
      },
    ];
    expect((await profileLines('user-1'))[0]).toContain('반례 1건');
  });

  it('항목이 없으면 빈 배열', async () => {
    expect(await profileLines('user-1')).toEqual([]);
  });
});

describe('recentlyRetiredLines', () => {
  it('물러난 항목을 반례 수와 함께 말한다 — 조용히 사라지지 않는다', async () => {
    retiredRows = [
      {
        layer: 'L3',
        domain: '채용',
        content: '계약직을 먼저 본다',
        evidence_case_ids: ['case-1'],
        counterexamples: ['case-2', 'case-3'],
      },
    ];
    const lines = await recentlyRetiredLines('user-1');
    expect(lines[0]).toContain('반례 2건으로 물러남');
  });
});

describe('은퇴 항목의 부활 — 이력을 승계한다 (비대칭 수리)', () => {
  it('은퇴 항목이 보강돼 임계를 넘으면 반례 이력을 지닌 채 활성으로 돌아온다', async () => {
    // 근거 2 + 반례 2 로 은퇴해 있던 항목. 새 보강 1건 → 근거 3 / 반례 2
    // → 4/7 ≈ 0.571 > 0.5 → 부활. 반례는 update 에 없다 = 그대로 남는다.
    retiredRows = [existingItem({
      id: 'item-r', status: 'retired',
      evidence_case_ids: ['case-0', 'case-8'], counterexamples: ['case-2', 'case-3'],
    })];
    llmResponse = { items: [], reinforces: [0], contradicts: [] };
    const u = await extractProfileFromSettlement('user-1', FACTS);
    expect(u.reinforced).toBe(1);
    expect(updates[0].status).toBe('active');
    expect(updates[0].evidence_case_ids).toEqual(['case-0', 'case-8', 'case-1']);
    expect(Number(updates[0].confidence)).toBeCloseTo(4 / 7);
    expect('counterexamples' in updates[0]).toBe(false); // 이력은 지워지지 않는다
  });

  it('보강돼도 임계를 못 넘으면 은퇴로 남는다 — 은퇴 2건, 부활 1건의 비대칭을 만들지 않는다', async () => {
    // 근거 1 + 반례 2 → 보강 후 근거 2 / 반례 2 → 정확히 0.5 → 부활 아님.
    retiredRows = [existingItem({
      id: 'item-r', status: 'retired',
      evidence_case_ids: ['case-0'], counterexamples: ['case-2', 'case-3'],
    })];
    llmResponse = { items: [], reinforces: [0], contradicts: [] };
    await extractProfileFromSettlement('user-1', FACTS);
    expect(updates[0].evidence_case_ids).toEqual(['case-0', 'case-1']);
    expect(updates[0].status).toBeUndefined(); // 여전히 retired
  });

  it('이미 있는 문장(은퇴 포함)과 같은 새 항목은 만들지 않는다 — 새 행으로 태어나면 반례가 지워진다', async () => {
    retiredRows = [existingItem({ id: 'item-r', status: 'retired', counterexamples: ['case-2', 'case-3'] })];
    llmResponse = {
      items: [{ layer: 'L3', domain: '채용', content: '현금이 빠듯할 때 계약직을 먼저 본다' }],
      reinforces: [], contradicts: [],
    };
    const u = await extractProfileFromSettlement('user-1', FACTS);
    expect(u.inserted).toBe(0);
    expect(inserted).toHaveLength(0);
  });

  it('근거와 반례가 동률(0.5)이면 은퇴한다 — 반례가 근거만큼 쌓인 관찰은 패턴이 아니다', async () => {
    profileRows = [existingItem({ evidence_case_ids: ['case-0', 'case-8'], counterexamples: ['case-9'] })];
    llmResponse = { items: [], reinforces: [], contradicts: [0] };
    const u = await extractProfileFromSettlement('user-1', FACTS);
    // 근거 2 / 반례 2 → 정확히 0.5 → <= 경계에 걸려 은퇴.
    expect(u.retired).toBe(1);
    expect(updates[0].status).toBe('retired');
  });
});

describe('백스톱 — 정산은 됐는데 추출을 시도한 적 없는 케이스', () => {
  it('시도 표식은 모델이 답한 순간 찍힌다 — 0건도 시도다', async () => {
    // 결과가 0건인 것은 흔한 정상이다. 그것을 미시도로 남기면 크론이 같은
    // 케이스를 48시간 동안 매시간 다시 집는다.
    llmResponse = { items: [], reinforces: [], contradicts: [] };
    await extractProfileFromSettlement('user-1', FACTS);
    expect(caseUpdates.some((u) => typeof u.profile_extracted_at === 'string')).toBe(true);
  });

  it('LLM 이 답을 못 내면 표식을 찍지 않는다 — 그것만 다시 집혀야 한다', async () => {
    llmResponse = null;
    await extractProfileFromSettlement('user-1', FACTS);
    expect(caseUpdates).toHaveLength(0);
  });

  it('관찰이 없는 케이스는 후보에서 빠진다 — 추출할 재료가 없다', async () => {
    caseRows = [
      { id: 'c1', user_id: 'u1', title: '질문', choice: '선택', last_observation: null, recall_gap: null },
      { id: 'c2', user_id: 'u1', title: '질문2', choice: '선택2', last_observation: '실제로 이랬다', recall_gap: '기억' },
    ];
    const out = await settledCasesMissingProfile();
    expect(out.map((o) => o.facts.caseId)).toEqual(['c2']);
    // 원장에만 있는 값은 지어내지 않고 비운다.
    expect(out[0].facts.statedReasons).toEqual([]);
  });
});
