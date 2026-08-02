import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sharedPremiseGroups, openQuestions, sealedWithoutPremises, judgmentPatternFacts } from '../judgment-patterns';
import { createItem, type DecisionItem } from '../decision-items';

/**
 * 판단 패턴 가드 (2026-07-30) — 세되, 판정하지 않는다.
 *
 * 빨간불 조건:
 *   · 연결(같은 전제 위의 결정들)을 못 세는 것 — 표기만 다른 같은 주장 포함
 *   · 한 결정 안의 중복을 연결로 부풀리는 것
 *   · 평결 어휘가 이 모듈에 들어오는 것 (스파인 2항 — 기계가 감시)
 */

const NOW = Date.parse('2026-07-30T04:00:00.000Z');
const DAY = 86_400_000;

function item(decisionId: string, text: string, over: Partial<DecisionItem> = {}): DecisionItem {
  const base = createItem({
    decision_id: decisionId, type: 'premise', text,
    source: 'ai', external: false, load_bearing: false, ai_original: text,
  }, NOW - 10 * DAY);
  return { ...base, ...over };
}

describe('같은 전제 위에 선 결정들', () => {
  it('결정 두 건이 같은 전제를 공유하면 그룹이 된다', () => {
    const g = sharedPremiseGroups([
      item('d1', '다음 분기 매출이 지금 수준을 유지한다.'),
      item('d2', '다음 분기 매출이 지금 수준을 유지한다.'),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].decisionIds.sort()).toEqual(['d1', 'd2']);
  });

  it('표기만 다른 같은 주장도 잇는다 (조사 차이가 연결을 끊지 않는다)', () => {
    const g = sharedPremiseGroups([
      item('d1', '다음 분기 매출이 지금 수준을 유지한다.'),
      item('d2', '다음 분기 매출은 지금 수준을 그대로 유지한다.'),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].decisionIds).toHaveLength(2);
  });

  it('한 결정 안의 중복은 연결이 아니다', () => {
    expect(sharedPremiseGroups([
      item('d1', '핵심 인력 이탈은 이번 분기에 없다.'),
      item('d1', '핵심 인력 이탈은 이번 분기에 없다고 본다.'),
    ])).toHaveLength(0);
  });

  it('은퇴한 항목은 세지 않는다', () => {
    expect(sharedPremiseGroups([
      item('d1', '온보딩 기간은 3~6개월로 잡는다.'),
      item('d2', '온보딩 기간은 3~6개월로 잡는다.', { status: 'retired' }),
    ])).toHaveLength(0);
  });

  it('큰 그룹이 먼저 온다', () => {
    const g = sharedPremiseGroups([
      item('d1', '가정 에이 문장이다.'), item('d2', '가정 에이 문장이다.'),
      item('d3', '예산 승인은 이미 끝났다.'), item('d4', '예산 승인은 이미 끝났다.'), item('d5', '예산 승인은 이미 끝났다.'),
    ]);
    expect(g[0].decisionIds).toHaveLength(3);
  });
});

describe('미결 질문 잔량', () => {
  it('오래 열린 것이 먼저, 날수는 사실대로', () => {
    const q = openQuestions([
      { ...item('d1', '지분을 어떻게 나눌 것인가?'), type: 'open_question', created_at: new Date(NOW - 30 * DAY).toISOString() },
      { ...item('d2', '리드는 누가 맡나?'), type: 'open_question', created_at: new Date(NOW - 3 * DAY).toISOString() },
    ], NOW);
    expect(q.map((x) => x.openForDays)).toEqual([30, 3]);
  });
});

describe('전제 없이 봉인된 결정', () => {
  it('봉인됐고 활성 전제가 0인 결정만 센다', () => {
    const bare = sealedWithoutPremises(
      [
        { id: 'd1', name: '채용', sealed: true },
        { id: 'd2', name: '이직', sealed: true },
        { id: 'd3', name: '미봉인', sealed: false },
      ],
      [item('d1', '다음 분기 매출이 지금 수준을 유지한다.')],
    );
    expect(bare.map((d) => d.id)).toEqual(['d2']);
  });

  it('열린 질문이나 메모를 전제로 잘못 세지 않는다', () => {
    const question = { ...item('d1', '누가 최종 승인하는가?'), type: 'open_question' as const };
    const bare = sealedWithoutPremises(
      [{ id: 'd1', name: '출시', sealed: true }],
      [question],
    );
    expect(bare.map((decision) => decision.id)).toEqual(['d1']);
  });
});

describe('스파인 2항 — 이 모듈은 판정하지 않는다', () => {
  it('평결·성향 어휘가 코드에 없다 (문구가 아니라 기계가 지킨다)', () => {
    // 주석은 뺀다 — 반례("이렇게 쓰면 안 된다")로 가르치는 주석은 정당하고,
    // 이 리포의 금지패턴 가드 선례도 주석 뺀 코드만 검사한다 (2026-07-29,
    // 왼쪽 악센트 바 가드에서 확립). 코드에 들어오는 순간만 빨간불이다.
    const raw = readFileSync(join(process.cwd(), 'src/lib/judgment-patterns.ts'), 'utf8');
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const banned = [/낙관적/, /비관적/, /성향/, /점수/, /등급/, /잘하/, /못하/, /경고/, /위험한 습관/];
    const hits = banned.filter((re) => re.test(src)).map((re) => re.source);
    expect(hits, `판정 어휘가 코드에 들어왔다: ${hits.join(', ')}`).toEqual([]);
  });

  it('묶음 결과에 사실 필드만 있다', () => {
    const facts = judgmentPatternFacts([], [], NOW);
    expect(Object.keys(facts).sort()).toEqual(['bare', 'premiseCount', 'questions', 'shared']);
  });
});
