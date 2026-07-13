/**
 * 연결 시뮬레이션 (정본 §8-§11) — 사용자 데이터가 없어도 연결 엔진을 구축·검증하는
 * 방법: 정답표(ground truth)를 붙인 합성 결정 히스토리를 잔뜩 만들고, 엔진을 거기
 * 돌려 정밀도(surfaced 중 진짜)·재현율(진짜 중 surfaced)을 측정한다. 시뮬레이션이
 * 곧 eval set이다.
 *
 * 정책(문서 §17): **정밀도 우선.** 정확한 연결을 놓치는 것(재현율 손실)은 초기에
 * 허용, 틀린 연결을 자신 있게 보여주는 것(정밀도 손실)은 금지. 그래서 이 파일의
 * 계약은:
 *   1. 하드 네거티브 corpus에서 오연결(FP) = 0 (정밀도 1.0)을 **CI가 강제**.
 *   2. 기계식 양성(같은 전제/URL/날짜)은 재현율 1.0.
 *   3. 의미 양성(다른 말로 쓴 같은 제약)은 **현재 놓친다** — 이 사각을 테스트로
 *      명시(문서화된 재현율 갭). 나중에 검증 층이 이걸 닫으면 이 기대가 바뀐다.
 *      갭을 조용히 두지 않는다(LLM-glue: 놓친 것을 표면화).
 */
import { describe, expect, it } from 'vitest';
import type { DecisionRecord, LedgerState, PremiseRecord } from './reducer.js';
import { emptyState } from './reducer.js';
import { relatedOpenDecisions } from './connection.js';

function decision(id: string, state: DecisionRecord['state'] = 'sealed'): DecisionRecord {
  return { id, state, snooze_count: 0 };
}
function premise(id: string, decision_id: string, text: string, over: Partial<PremiseRecord> = {}): PremiseRecord {
  return { id, decision_id, kind: 'premise', text: { value: text, provenance: 'user_stated' }, load_bearing: true, resolved: false, ...over };
}
function stateOf(decisions: DecisionRecord[], premises: PremiseRecord[]): LedgerState {
  const s = emptyState();
  for (const d of decisions) s.decisions.set(d.id, d);
  for (const p of premises) s.premises.set(p.id, p);
  return s;
}

type Category = 'same_premise' | 'shared_url' | 'shared_date' | 'hard_negative' | 'semantic_gap';
interface SimCase {
  name: string;
  category: Category;
  decisions: DecisionRecord[];
  premises: PremiseRecord[];
  settle: string;        // 정산되는 결정 (연결의 앵커)
  brokenText: string;    // 그 결정에서 깨진 전제 텍스트
  expected: string[];    // 정답: 연결돼야 할 열린 결정 id들
}

const CORPUS: SimCase[] = [
  // ── 기계식 양성: 같은 전제(문장) ──────────────────────────
  {
    name: 'P1 같은 전제, 표기만 다름(대소문자·공백·구두점)',
    category: 'same_premise',
    decisions: [decision('events-db', 'settled'), decision('rate-limit')],
    premises: [premise('a', 'events-db', 'write volume stays under 200/sec'),
               premise('b', 'rate-limit', '  Write Volume stays under 200/sec.  ')],
    settle: 'events-db', brokenText: 'write volume stays under 200/sec', expected: ['rate-limit'],
  },
  {
    name: 'P2 같은 전제, 셋이 공유',
    category: 'same_premise',
    decisions: [decision('d0', 'settled'), decision('d1'), decision('d2')],
    premises: [premise('p0', 'd0', 'the vendor SLA holds at 99.9 percent'),
               premise('p1', 'd1', 'The vendor SLA holds at 99.9 percent'),
               premise('p2', 'd2', 'the vendor sla holds at 99.9 percent')],
    settle: 'd0', brokenText: 'the vendor SLA holds at 99.9 percent', expected: ['d1', 'd2'],
  },
  // ── 기계식 양성: 같은 근거(URL) ── (표면 문장은 다름, §9 1층) ─
  {
    name: 'P3 같은 URL, 문장은 완전히 다름',
    category: 'shared_url',
    decisions: [decision('launch', 'settled'), decision('cost-plan')],
    premises: [premise('a', 'launch', 'the free deal at https://partner.com/pricing holds through launch'),
               premise('b', 'cost-plan', 'our margin math assumes https://partner.com/pricing stays free')],
    settle: 'launch', brokenText: 'the free deal at https://partner.com/pricing holds through launch', expected: ['cost-plan'],
  },
  // ── 기계식 양성: 같은 날짜 ─────────────────────────────
  {
    name: 'P4 같은 마감일(ISO), 문장은 다름',
    category: 'shared_date',
    decisions: [decision('migrate', 'settled'), decision('marketing')],
    premises: [premise('a', 'migrate', 'partner certification completes by 2026-12-01'),
               premise('b', 'marketing', 'campaign can start once cert lands on 2026-12-01')],
    settle: 'migrate', brokenText: 'partner certification completes by 2026-12-01', expected: ['marketing'],
  },

  // ── 하드 네거티브: 오연결이면 정밀도가 깨진다 (§10-4) ───────
  {
    name: 'N1 같은 숫자 다른 단위 (200/sec vs 200ms) — 잇지 마라',
    category: 'hard_negative',
    decisions: [decision('a', 'settled'), decision('b')],
    premises: [premise('pa', 'a', 'write volume stays under 200/sec'),
               premise('pb', 'b', 'p95 latency stays under 200ms')],
    settle: 'a', brokenText: 'write volume stays under 200/sec', expected: [],
  },
  {
    name: 'N2 맨숫자·금액 우연 일치 (budget $5000 vs revenue $5000) — 잇지 마라',
    category: 'hard_negative',
    decisions: [decision('a', 'settled'), decision('b')],
    premises: [premise('pa', 'a', 'the launch budget is $5000'),
               premise('pb', 'b', 'first month revenue hits $5000')],
    settle: 'a', brokenText: 'the launch budget is $5000', expected: [],
  },
  {
    name: 'N3 같은 단어 다른 대상 (growth in two unrelated sentences) — 잇지 마라',
    category: 'hard_negative',
    decisions: [decision('a', 'settled'), decision('b')],
    premises: [premise('pa', 'a', 'user growth continues through Q3'),
               premise('pb', 'b', 'the team can handle headcount growth')],
    settle: 'a', brokenText: 'user growth continues through Q3', expected: [],
  },
  {
    name: 'N4 같은 전제지만 상대가 이미 정산/기각된 결정 — 되살리지 마라',
    category: 'hard_negative',
    decisions: [decision('a', 'settled'), decision('b', 'settled'), decision('c', 'dismissed')],
    premises: [premise('pa', 'a', 'the vendor SLA holds at 99.9 percent'),
               premise('pb', 'b', 'the vendor SLA holds at 99.9 percent'),
               premise('pc', 'c', 'the vendor SLA holds at 99.9 percent')],
    settle: 'a', brokenText: 'the vendor SLA holds at 99.9 percent', expected: [],
  },
  {
    name: 'N5 같은 URL이지만 상대 전제가 이미 resolved — 죽은 전제는 무시',
    category: 'hard_negative',
    decisions: [decision('a', 'settled'), decision('b')],
    premises: [premise('pa', 'a', 'depends on https://partner.com/pricing'),
               premise('pb', 'b', 'depended on https://partner.com/pricing', { resolved: true })],
    settle: 'a', brokenText: 'depends on https://partner.com/pricing', expected: [],
  },
  {
    name: 'N6 다른 URL (호스트 같아도 경로 다름) — 잇지 마라',
    category: 'hard_negative',
    decisions: [decision('a', 'settled'), decision('b')],
    premises: [premise('pa', 'a', 'https://partner.com/pricing stays free'),
               premise('pb', 'b', 'https://partner.com/status is green')],
    settle: 'a', brokenText: 'https://partner.com/pricing stays free', expected: [],
  },

  // ── 의미 양성: 다른 말로 쓴 같은 제약 (§9 3층) ──────────────
  // 현재 기계식 엔진은 이걸 '놓친다'. 재현율 갭을 명시(문서화된 사각).
  {
    name: 'S1 같은 숨은 제약, 완전히 다른 말 (가격 vs 채용, 둘 다 온보딩 처리량)',
    category: 'semantic_gap',
    decisions: [decision('pricing', 'settled'), decision('hiring')],
    premises: [premise('a', 'pricing', 'we cap sales volume to protect onboarding throughput'),
               premise('b', 'hiring', 'we delayed the sales hire because ops cannot onboard more customers')],
    settle: 'pricing', brokenText: 'we cap sales volume to protect onboarding throughput', expected: ['hiring'],
  },
  {
    name: 'S2 같은 사실 다른 표현 (무료 API 12월까지)',
    category: 'semantic_gap',
    decisions: [decision('launch', 'settled'), decision('budget')],
    premises: [premise('a', 'launch', 'the payment partner gives us free API through December'),
               premise('b', 'budget', 'no API costs until year end per the partner deal')],
    settle: 'launch', brokenText: 'the payment partner gives us free API through December', expected: ['budget'],
  },
];

interface Metrics { tp: number; fp: number; fn: number; }
function run(cases: SimCase[]): { overall: Metrics; byCat: Map<Category, Metrics>; fps: string[] } {
  const overall: Metrics = { tp: 0, fp: 0, fn: 0 };
  const byCat = new Map<Category, Metrics>();
  const fps: string[] = [];
  for (const c of cases) {
    const got = new Set(relatedOpenDecisions(stateOf(c.decisions, c.premises), c.brokenText, c.settle).map((r) => r.decision_id));
    const exp = new Set(c.expected);
    const m = byCat.get(c.category) ?? { tp: 0, fp: 0, fn: 0 };
    for (const id of got) {
      if (exp.has(id)) { m.tp++; overall.tp++; }
      else { m.fp++; overall.fp++; fps.push(`${c.name} → 오연결 ${id}`); }
    }
    for (const id of exp) if (!got.has(id)) { m.fn++; overall.fn++; }
    byCat.set(c.category, m);
  }
  return { overall, byCat, fps };
}
const prec = (m: Metrics) => (m.tp + m.fp === 0 ? 1 : m.tp / (m.tp + m.fp));
const rec = (m: Metrics) => (m.tp + m.fn === 0 ? 1 : m.tp / (m.tp + m.fn));

describe('연결 시뮬레이션 — 정밀도 우선 기준선', () => {
  const { overall, byCat, fps } = run(CORPUS);

  it('정밀도 1.0 — corpus 전체에서 오연결(FP) 0 (정밀도-우선 게이트)', () => {
    expect(fps, `오연결 발생:\n${fps.join('\n')}`).toEqual([]);
    expect(prec(overall)).toBe(1);
  });

  it('기계식 양성(같은 전제/URL/날짜)은 재현율 1.0', () => {
    for (const cat of ['same_premise', 'shared_url', 'shared_date'] as const) {
      expect(rec(byCat.get(cat)!), `${cat} 재현율`).toBe(1);
    }
  });

  it('의미 양성(다른 말로 쓴 같은 제약)은 현재 전부 놓친다 — 문서화된 재현율 갭', () => {
    // 이 기대가 '통과'한다는 것 자체가 사각의 크기다. 검증 층이 이걸 닫으면
    // recall > 0이 되고 이 단언을 바꾼다. 그 전까지 갭은 조용하지 않다.
    expect(rec(byCat.get('semantic_gap')!)).toBe(0);
  });

  it('기준선 메트릭 출력 (구축 방향 판단용)', () => {
    const line = (label: string, m: Metrics) =>
      `  ${label.padEnd(14)} P=${prec(m).toFixed(2)} R=${rec(m).toFixed(2)}  (tp=${m.tp} fp=${m.fp} fn=${m.fn})`;
    const rows = [...byCat.entries()].map(([cat, m]) => line(cat, m)).join('\n');
    // eslint-disable-next-line no-console
    console.log(`\n[연결 시뮬레이션 기준선]\n${line('OVERALL', overall)}\n${rows}\n`);
    expect(overall.tp).toBeGreaterThan(0);
  });
});

/**
 * 프로토타입: 포착-시점 엔티티 태그로 의미 갭을 닫는다 (§9 3층). 읽을 때 퍼지
 * 매칭(그럴듯한 쓰레기의 근원)을 하지 않는다. 대신 모델이 전제를 기록할 때
 * 정규화된 엔티티/제약 키를 달아두면(맥락 풍부한 그 순간에, 출처 표시하고 한 번),
 * 연결은 '키가 같은가'만 보는 기계식으로 남는다. 여기서는 그 키를 손으로
 * 시뮬레이션해 이 설계의 천장과 실패 모드를 측정한다.
 *
 * 이 프로토타입은 connection.ts를 아직 건드리지 않는다 (스키마 커밋 전 설계 증명).
 * 위험은 '읽을 때 퍼지매치'에서 '포착할 때 태그 일관성'으로 옮겨간다 — 투명하고
 * 출처가 있고 테스트 가능한 자리로. 그 태그 일관성 자체가 다음 검증 가설이다.
 */
interface EntPremise { id: string; decision_id: string; entities: string[]; resolved?: boolean; }
interface EntCase { name: string; open: Record<string, DecisionRecord['state']>; premises: EntPremise[]; brokenId: string; expected: string[]; }

function relatedByEntity(c: EntCase): string[] {
  const broken = c.premises.find((p) => p.id === c.brokenId)!;
  const keys = new Set(broken.entities);
  const out = new Set<string>();
  for (const p of c.premises) {
    if (p.resolved || p.decision_id === broken.decision_id) continue;
    if (c.open[p.decision_id] !== 'sealed') continue;
    if (p.entities.some((e) => keys.has(e))) out.add(p.decision_id);
  }
  return [...out].sort();
}

describe('연결 프로토타입 — 포착-시점 엔티티 태그가 의미 갭을 닫는가', () => {
  it('모델이 잘 태깅하면: 다른 말로 쓴 같은 제약을 잡고(R=1), 함정은 여전히 안 잇는다(P=1)', () => {
    // 양성: 표면 문장은 전혀 다르지만 모델이 같은 제약 키를 달았다.
    const S1: EntCase = {
      name: '가격 vs 채용 (온보딩 처리량)', open: { pricing: 'settled', hiring: 'sealed' },
      premises: [
        { id: 'a', decision_id: 'pricing', entities: ['constraint:onboarding-throughput'] },
        { id: 'b', decision_id: 'hiring', entities: ['constraint:onboarding-throughput'] },
      ], brokenId: 'a', expected: ['hiring'],
    };
    expect(relatedByEntity(S1)).toEqual(['hiring']); // 갭 닫힘

    // 하드 네거티브: 같은 $5000이지만 모델이 대상을 구분해 태깅(budget≠revenue).
    const N: EntCase = {
      name: '$5000 예산 vs $5000 매출', open: { a: 'settled', b: 'sealed' },
      premises: [
        { id: 'pa', decision_id: 'a', entities: ['metric:launch-budget'] },
        { id: 'pb', decision_id: 'b', entities: ['metric:first-month-revenue'] },
      ], brokenId: 'pa', expected: [],
    };
    expect(relatedByEntity(N)).toEqual([]); // 정밀도 유지 — 대상이 다르면 키가 다르다
  });

  it('시뮬레이션이 나쁜 태거를 잡아낸다: 모델이 대상을 뭉개면(over-generalize) 오연결이 뜬다', () => {
    // 같은 실패 corpus지만 모델이 둘 다 뭉뚱그려 'amount:5k'로 태깅했다면 —
    // 이건 FP다. 이 케이스가 실패로 뜬다는 것 자체가 eval이 태거 품질을 잰다는 증거.
    const bad: EntCase = {
      name: '나쁜 태거: $5000을 대상 무시하고 뭉갬', open: { a: 'settled', b: 'sealed' },
      premises: [
        { id: 'pa', decision_id: 'a', entities: ['amount:5k'] },
        { id: 'pb', decision_id: 'b', entities: ['amount:5k'] },
      ], brokenId: 'pa', expected: [],
    };
    // 정답은 [] (연결 아님)인데 나쁜 태거는 b를 잇는다 → eval이 FP로 잡는다.
    expect(relatedByEntity(bad)).toEqual(['b']);
    // 즉 이 설계의 정밀도는 '모델이 대상을 얼마나 잘 구분해 태깅하나'에 달렸다 —
    // 그게 다음에 front-door로 재야 할 태그-일관성 가설이다.
  });
});
