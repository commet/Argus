import { beforeEach, describe, expect, it, vi } from 'vitest';

// TWIN Phase 4 — 범위 위임. 이 파일의 테스트는 대부분 **거부 경로**다.
//
// 위임은 기계가 사람의 판단 자리에 가장 가까이 가는 표면이므로, 실패 형태는
// "안 만들어지는 것"이 아니라 **"사용자가 말하지 않은 위임이 생기는 것"**이다.
// 지키는 불변식:
//
// 1. userWords(사용자 원문) 없이는 위임이 생기지 않고, **왜 안 만들었는지 말한다**
// 2. 기간은 위로 닫히고, 잘랐으면 잘랐다고 말한다 (조용한 축소 금지)
// 3. 적용은 침묵이 기본값 — 위임 없음·범위 밖·애매함·실패 전부 null
// 4. 적용 문장에 인용되는 것은 **사용자가 쓴 정책 원문**뿐이다 (LLM 문장 아님)
// 5. 인용 없는 판정은 indeterminate 로 강등되고 성적 모수에서 빠진다
// 6. 어긋남이 임계를 넘고 맞음보다 많으면 위임이 **스스로 멈춘다**

const inserted: Array<Record<string, unknown>> = [];
const updates: Array<Record<string, unknown>> = [];
let llmResponse: Record<string, unknown> | null = null;
let delegationRows: Array<Record<string, unknown>> = [];
let singleRow: Record<string, unknown> | null = null;
let insertError: { message: string } | null = null;

vi.mock('@/lib/llm-server', () => ({
  callAnthropicJson: vi.fn(async () => llmResponse),
}));

// 목록 조회(await 체인)와 단건 조회(maybeSingle)는 **다른 결과**를 내야 한다.
// 하나로 합치면 "행이 없다"(null)와 "빈 목록"([])이 구분되지 않아, 없는 위임을
// 채점하는 경로가 테스트를 통과해 버린다.
function query(
  listResult: () => { data: unknown; error: unknown },
  singleResult: () => { data: unknown; error: unknown } = listResult,
) {
  const chain: Record<string, unknown> = {};
  for (const k of ['eq', 'or', 'not', 'order', 'limit', 'gte', 'gt', 'lt', 'in', 'is', 'select']) {
    chain[k] = () => chain;
  }
  chain.maybeSingle = () => Promise.resolve(singleResult());
  chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(listResult()).then(res, rej);
  return chain;
}

vi.mock('@/lib/share-guard', () => ({
  adminClient: () => ({
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        inserted.push(row);
        return query(() => ({ data: insertError ? null : { id: 'deleg-1' }, error: insertError }));
      },
      update: (values: Record<string, unknown>) => {
        updates.push({ table, ...values });
        return query(() => ({ data: null, error: null }));
      },
      select: () =>
        query(
          () => ({ data: delegationRows, error: null }),
          () => ({ data: singleRow, error: null }),
        ),
    }),
  }),
}));

import {
  applyDelegation,
  createDelegation,
  describeDelegationGrade,
  gradeDelegation,
  markCaseDelegation,
  DELEGATION_MAX_DAYS,
} from '../delegation';

function row(over: Record<string, unknown> = {}) {
  return {
    id: 'deleg-1',
    policy: '현금이 3개월치 아래면 고정비를 늘리지 않는다',
    scope_domain: '채용',
    scope_condition: '현금이 빠듯할 때의 인력 결정',
    user_words: '앞으로 현금 빠듯하면 무조건 계약직으로 가자',
    expires_at: '2026-12-31T00:00:00Z',
    status: 'active',
    applications: 0,
    supported: 0,
    contradicted: 0,
    ...over,
  };
}

const DRAFT = {
  policy: '현금이 3개월치 아래면 고정비를 늘리지 않는다',
  scopeDomain: '채용',
  scopeCondition: '현금이 빠듯할 때의 인력 결정',
  userWords: '앞으로 현금 빠듯하면 무조건 계약직으로 가자',
};

beforeEach(() => {
  inserted.length = 0;
  updates.length = 0;
  delegationRows = [];
  singleRow = null;
  insertError = null;
  llmResponse = { matching_index: 0 };
});

describe('createDelegation — 거부가 기본값이다', () => {
  it('사용자 원문(userWords)이 없으면 만들지 않고 이유를 말한다', async () => {
    const r = await createDelegation('user-1', { ...DRAFT, userWords: '  ' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('사용자가 직접 말한 문장');
    expect(inserted).toHaveLength(0);
  });

  it('정책·영역·조건 중 하나라도 비면 만들지 않는다', async () => {
    const r = await createDelegation('user-1', { ...DRAFT, scopeCondition: '' });
    expect(r.ok).toBe(false);
    expect(inserted).toHaveLength(0);
  });

  it('정상 입력이면 만료와 함께 저장된다', async () => {
    const r = await createDelegation('user-1', DRAFT);
    expect(r.ok).toBe(true);
    expect(inserted[0]).toMatchObject({ user_id: 'user-1', scope_domain: '채용' });
    expect(typeof inserted[0].expires_at).toBe('string');
  });

  it('기간은 최대치로 잘린다 — 영원한 위임은 만들 수 없다', async () => {
    await createDelegation('user-1', { ...DRAFT, days: 3650 });
    const expires = new Date(String(inserted[0].expires_at)).getTime();
    const cap = Date.now() + (DELEGATION_MAX_DAYS + 1) * 86400_000;
    expect(expires).toBeLessThan(cap);
  });

  it('저장 실패는 성공으로 위장하지 않는다', async () => {
    insertError = { message: 'relation does not exist' };
    const r = await createDelegation('user-1', DRAFT);
    expect(r.ok).toBe(false);
  });
});

describe('applyDelegation — 침묵이 기본값이다', () => {
  it('위임이 없으면 null 이고 LLM 도 부르지 않는다', async () => {
    delegationRows = [];
    expect(await applyDelegation('user-1', '사람을 뽑을까')).toBeNull();
  });

  it('범위 밖(-1)이면 null — 억지로 맞추지 않는다', async () => {
    delegationRows = [row()];
    llmResponse = { matching_index: -1 };
    expect(await applyDelegation('user-1', '사무실을 옮길까')).toBeNull();
  });

  it('범위 밖 인덱스가 오면 null', async () => {
    delegationRows = [row()];
    llmResponse = { matching_index: 7 };
    expect(await applyDelegation('user-1', '무엇이든')).toBeNull();
  });

  it('LLM 이 답을 못 내면 null — 지어내지 않는다', async () => {
    delegationRows = [row()];
    llmResponse = null;
    expect(await applyDelegation('user-1', '무엇이든')).toBeNull();
  });

  it('맞으면 **사용자가 쓴 정책 원문**과 그때 한 말을 그대로 꺼낸다', async () => {
    delegationRows = [row()];
    const m = await applyDelegation('user-1', '현금이 빠듯한데 사람을 뽑을까');
    expect(m).not.toBeNull();
    expect(m!.text).toContain('앞으로 현금 빠듯하면 무조건 계약직으로 가자');
    expect(m!.text).toContain('현금이 3개월치 아래면 고정비를 늘리지 않는다');
  });

  it('결정을 대신하지 않는다고 문장 안에서 밝힌다', async () => {
    delegationRows = [row()];
    const m = await applyDelegation('user-1', '현금이 빠듯한데 사람을 뽑을까');
    expect(m!.text).toContain('결정을 대신하지 않습니다');
    expect(m!.text).toContain('철회');
  });

  it('아직 정산된 적용이 없으면 성적을 지어내지 않는다', async () => {
    delegationRows = [row({ applications: 0 })];
    const m = await applyDelegation('user-1', '현금이 빠듯한데 사람을 뽑을까');
    expect(m!.text).toContain('아직 정산된 적용이 없습니다');
    expect(m!.text).not.toMatch(/\d+%/);
  });
});

describe('gradeDelegation — 사람이 아니라 정책을 채점한다', () => {
  it('인용 없는 supported 는 indeterminate 로 강등되고 성적에 안 들어간다', async () => {
    singleRow = row();
    llmResponse = { verdict: 'supported', quote: '   ' };
    const g = await gradeDelegation('user-1', 'deleg-1', '그럭저럭 굴러갔다');
    expect(g!.verdict).toBe('indeterminate');
    expect(updates[0].supported).toBe(0);
    expect(updates[0].contradicted).toBe(0);
  });

  it('어긋남 1건으로는 멈추지 않는다 — 한 번 틀렸다고 위임이 죽지 않는다', async () => {
    singleRow = row({ supported: 1, contradicted: 0 });
    llmResponse = { verdict: 'contradicted', quote: '두 달 만에 퇴사했다' };
    const g = await gradeDelegation('user-1', 'deleg-1', '두 달 만에 퇴사했다');
    expect(g!.suspended).toBe(false);
    expect(updates[0].status).toBeUndefined();
  });

  it('어긋남이 임계를 넘고 맞음보다 많으면 스스로 멈춘다', async () => {
    singleRow = row({ supported: 0, contradicted: 1 });
    llmResponse = { verdict: 'contradicted', quote: '또 어긋났다' };
    const g = await gradeDelegation('user-1', 'deleg-1', '또 어긋났다');
    expect(g!.suspended).toBe(true);
    expect(updates[0].status).toBe('suspended');
    expect(String(updates[0].suspended_reason)).toContain('자동으로 멈췄습니다');
  });

  it('맞음이 어긋남보다 많으면 멈추지 않는다', async () => {
    singleRow = row({ supported: 5, contradicted: 1 });
    llmResponse = { verdict: 'contradicted', quote: '이번엔 어긋났다' };
    const g = await gradeDelegation('user-1', 'deleg-1', '이번엔 어긋났다');
    expect(g!.suspended).toBe(false);
  });

  it('없는 위임은 null — 없는 것을 채점하지 않는다', async () => {
    singleRow = null;
    delegationRows = [];
    const g = await gradeDelegation('user-1', 'nope', '관찰');
    expect(g).toBeNull();
  });
});

describe('describeDelegationGrade', () => {
  it('채점하지 못했으면 빈 문자열 — 없는 일을 말하지 않는다', () => {
    expect(describeDelegationGrade(null)).toBe('');
  });

  it('indeterminate 는 성적에 넣지 않았다고 밝힌다', () => {
    const t = describeDelegationGrade({ verdict: 'indeterminate', suspended: false, policy: 'P' });
    expect(t).toContain('판정할 수 없었습니다');
    expect(t).toContain('성적에 넣지 않았습니다');
  });

  it('자동 정지는 사용자에게 즉시 말하고 되돌리는 곳을 알려준다', () => {
    const t = describeDelegationGrade({ verdict: 'contradicted', suspended: true, policy: 'P' });
    expect(t).toContain('자동으로 멈췄습니다');
    expect(t).toContain('설정');
  });
});

describe('markCaseDelegation — 소유 확인이 먼저다', () => {
  it('남의 위임 id 면 케이스에 도장을 찍지 않는다', async () => {
    singleRow = null; // 이 사용자 소유가 아님
    await markCaseDelegation('user-1', 'case-1', 'someone-elses');
    expect(updates).toHaveLength(0);
  });

  it('내 위임이면 케이스에 찍고 적용 횟수를 올린다', async () => {
    singleRow = { applications: 2 };
    await markCaseDelegation('user-1', 'case-1', 'deleg-1');
    expect(updates.some((u) => u.table === 'argus_cases' && u.delegation_id === 'deleg-1')).toBe(true);
    expect(updates.some((u) => u.table === 'argus_delegations' && u.applications === 3)).toBe(true);
  });
});
