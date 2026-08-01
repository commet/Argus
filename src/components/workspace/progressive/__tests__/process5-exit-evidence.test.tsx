/**
 * 공정 5 준공 증거 — exit "항로 카드 기본 상태 = 접힘 (테스트)".
 *
 * 왜 새로 쓰나 (2026-07-28 점검): 항목 4는 **이미 구현돼 있었다**
 * (ProgressiveFlow가 AnalysisCard에 defaultCollapsed를 넘긴다). 없던 것은 시공이
 * 아니라 **빨간불**이다. 기존 analysis-summary-content.test.tsx는 테스트가 직접
 * `defaultCollapsed`를 넘겨 렌더 결과만 보므로, ProgressiveFlow 쪽에서 그 prop을
 * 빼거나 false로 바꿔도 초록으로 남는다 — 즉 창업자가 지적한 그 현상("질문 답변
 * 후 전문이 전부 펼쳐진다")이 되돌아와도 CI가 못 본다.
 *
 * 그래서 두 겹으로 고정한다:
 *   (1) 거동 — 접힘은 실제로 전문을 감추고, 펼침은 되살린다.
 *   (2) 배선 — ProgressiveFlow의 모든 AnalysisCard 호출부가 defaultCollapsed를
 *       실어 보낸다 (누락·리터럴 false 금지).
 * (2)가 소스 스캔인 이유: ProgressiveFlow는 4천 줄 + 스토어 의존이라 통째 렌더가
 * 비현실적이다. 같은 리포의 schema-drift.test.ts가 쓰는 방식과 동일하다.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AnalysisCard } from '../shared/AnalysisCard';
import type { AnalysisSnapshot } from '@/stores/types';

const STEP_BODY = '국토부 실거래가에서 최근 추이를 직접 뽑아보세요';

const snapshot = {
  version: 2,
  real_question: '지금 동탄에서 막히는 건 타이밍인가, 여건인가?',
  insight: "'막혀 있다는 느낌'이라는 표현이 핵심이에요 — 이직 여부보다, 지금 회사의 성장 한계가 실제인지 먼저 확인해야 해요.",
  hidden_assumptions: ['동탄을 하나의 시장으로 보고 있다', '실거주와 투자의 기준이 같다고 보고 있다'],
  skeleton: [
    '먼저 — 내 목적부터 한 줄로 써보세요. 이게 없으면 이후 판단이 흔들려요.',
    `그다음 — ${STEP_BODY}. 호가가 아니라 실제 가격이 핵심이에요.`,
    '마지막으로 — 공인중개사 2~3곳을 직접 방문해 최근 거래 케이스를 물어보세요.',
  ],
} as unknown as AnalysisSnapshot;

const render = (defaultCollapsed: boolean) => renderToStaticMarkup(
  <AnalysisCard
    snapshot={snapshot}
    prevSnapshot={null}
    answerCount={2}
    defaultCollapsed={defaultCollapsed}
    locale="ko"
  />,
);

describe('공정 5 exit · 항로 카드 기본 상태 = 접힘', () => {
  it('접힘은 전문을 감추고 요약과 펼치기 손잡이만 남긴다', () => {
    const html = render(true);
    // 접힌 상태의 값: 무엇을 향해 가는지 + 펼칠 수 있다는 사실.
    expect(html).toContain('계획 3단계');
    expect(html).toContain('근거 보기');
    // 그리고 전문은 실제로 감춰져 있어야 한다 — 이게 "접힘"의 정의다.
    expect(html).not.toContain(STEP_BODY);
  });

  it('펼치면 전문이 돌아온다 (접힘이 내용을 삭제한 게 아니다)', () => {
    expect(render(false)).toContain(STEP_BODY);
  });
});

describe('공정 5 exit · 접힘 배선이 ProgressiveFlow에 살아 있다', () => {
  const SRC = readFileSync(
    join(process.cwd(), 'src/components/workspace/progressive/ProgressiveFlow.tsx'),
    'utf8',
  );

  /**
   * `<Comp … >` 여는 태그만 정확히 떼어낸다. prop 표현식 안에 들어앉은 JSX가
   * `/>`를 품고 있어 단순 indexOf는 태그를 중간에서 자른다 — 중괄호 깊이를 세어
   * depth 0에서 만난 '>'에서만 끊는다. (첫 시도가 정확히 이 함정에 빠졌고,
   * 아래 앵커 테스트가 그걸 잡았다.)
   */
  function openingTags(component: string): string[] {
    const tags: string[] = [];
    for (const match of SRC.matchAll(new RegExp(`<${component}\\b`, 'g'))) {
      let depth = 0;
      for (let i = match.index; i < SRC.length; i++) {
        const ch = SRC[i];
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
        else if (ch === '>' && depth === 0) { tags.push(SRC.slice(match.index, i + 1)); break; }
      }
    }
    return tags;
  }

  // '우리가 잡은 항로' = 질문 단계의 산출물 카드(AnalysisCard — 소스 주석 "② 산출물
  // = 우리가 잡은 항로"). FinalCard는 그 종착점인 최종 산출물이고 같은 성질(기본
  // 접힘)을 지켜야 하므로 함께 고정한다.
  const usages = () => [...openingTags('AnalysisCard'), ...openingTags('FinalCard')];

  it('호출부를 실제로 찾는다 (스캐너가 죽으면 아래가 공허하게 통과한다)', () => {
    expect(openingTags('AnalysisCard')).toHaveLength(2);
    expect(openingTags('FinalCard').length).toBeGreaterThanOrEqual(1);
    // 잘린 태그를 넘겨받고 있지 않은지 — 여는 태그는 반드시 '>'로 끝난다.
    for (const tag of usages()) expect(tag.endsWith('>')).toBe(true);
  });

  it('모든 산출물 카드 호출부가 defaultCollapsed를 넘긴다 — 누락도 리터럴 false도 금지', () => {
    const offenders = usages().filter(
      (usage) => !/defaultCollapsed/.test(usage) || /defaultCollapsed=\{false\}/.test(usage),
    );
    expect(
      offenders,
      '창업자 지적("질문 답변 후 전문이 전부 펼쳐진다")의 재발 경로다. '
      + `defaultCollapsed 없이 렌더되는 산출물 카드: ${offenders.length}건`,
    ).toEqual([]);
  });

  it('질문 단계(conversing)의 카드는 그 단계에서 접힌 채 시작한다', () => {
    const conversing = usages().filter((u) => /phase === 'conversing'/.test(u));
    expect(conversing.length).toBeGreaterThan(0);
    for (const usage of conversing) {
      // 접힘 조건식이 conversing을 참조해야 한다 — 상수 true/false로 굳으면 단계
      // 개념이 사라진 것이고, 그건 이 exit이 지키려는 바로 그 성질의 상실이다.
      expect(usage).toMatch(/defaultCollapsed=\{[^}]*conversing[^}]*\}|defaultCollapsed(?!=)/);
    }
  });
});

/**
 * 공정 5 exit — "seal 직후 화면의 각 블록 정체가 라벨 한 줄로 읽힘 (30초 룰)".
 *
 * 경계를 먼저 밝힌다: **"30초 안에 읽힌다"는 육안 판정이고 이 테스트는 그걸
 * 대신하지 못한다.** 기계가 지킬 수 있는 것은 그 아래 깔린 전제뿐이다 —
 * 블록마다 라벨이 있고, 그 라벨이 한 줄로 짧고, 기준점과 최종 판단이 서로 다른
 * 말로 불린다. 셋 중 하나라도 깨지면 30초 룰은 자동으로 깨지므로, 이건 필요조건의
 * 고정이다(충분조건이 아니다 — 그건 exit1의 재실사 몫).
 *
 * 왜 이 세 가지인가: 구현 보고서 §2.2가 기록한 원래 결함이 "첫 단계와 마지막
 * 단계가 모두 사실상 봉인처럼 보였다"였다. 두 라벨이 같아지거나 사라지는 것이
 * 그 결함의 재발 경로다. 소스 텍스트 단언 방식은 같은 컴포넌트를 다루는
 * seal-ceremony.test.ts의 방식을 그대로 따랐다 (스토어 3개 의존 → 통째 렌더 불가).
 */
describe('공정 5 exit · seal 직후 화면의 블록 라벨', () => {
  const SEAL_SRC = readFileSync(
    join(process.cwd(), 'src/components/workspace/progressive/SealMoment.tsx'),
    'utf8',
  );

  /** 화면이 저장 직후 장면임을 알리는 라벨부터, 각 블록의 정체까지. */
  const REQUIRED_BLOCK_LABELS: Array<[ko: string, en: string]> = [
    ['판단 기록 · 저장됨', 'Decision record · saved'],
    ['검토 전 기준점', 'Before the review'],
    ['검토 뒤 내가 확정한 판단', 'My judgment after the review'],
    ['AI가 대신 적어둔 확인 질문', 'A check question Argus drafted for you'],
  ];

  it('블록마다 라벨이 있다 — 한국어와 영어 양쪽으로', () => {
    for (const [ko, en] of REQUIRED_BLOCK_LABELS) {
      expect(SEAL_SRC, `블록 라벨(ko)이 사라졌다: ${ko}`).toContain(ko);
      expect(SEAL_SRC, `블록 라벨(en)이 사라졌다: ${en}`).toContain(en);
    }
  });

  it('라벨은 한 줄이다 — 설명 문단으로 자라지 않았다', () => {
    for (const [ko, en] of REQUIRED_BLOCK_LABELS) {
      expect(ko.length, `ko 라벨이 한 줄을 넘었다: ${ko}`).toBeLessThanOrEqual(24);
      expect(en.length, `en 라벨이 한 줄을 넘었다: ${en}`).toBeLessThanOrEqual(42);
      expect(ko, `라벨에 줄바꿈: ${ko}`).not.toContain('\n');
    }
  });

  it('기준점이 최종 판단보다 먼저 놓인다 — 여정의 순서가 화면의 순서다', () => {
    // 주의: 위 상수끼리 비교하면 자기순환이라 절대 실패하지 않는다. 실패할 수
    // 있으려면 **소스에서의 위치**를 봐야 한다. 구현 보고서 §2.2가 고친 결함이
    // "첫 단계와 마지막 단계가 모두 봉인처럼 보였다"이므로, 두 블록이 뒤집히거나
    // 한쪽이 사라지는 것이 그 결함의 재발이다.
    const baselineAt = SEAL_SRC.indexOf('검토 전 기준점');
    const verdictAt = SEAL_SRC.indexOf('검토 뒤 내가 확정한 판단');
    expect(baselineAt, '기준점 라벨이 소스에 없다').toBeGreaterThan(-1);
    expect(verdictAt, '최종 판단 라벨이 소스에 없다').toBeGreaterThan(-1);
    expect(
      baselineAt,
      '검토 전 기준점이 최종 판단보다 뒤에 놓였다 — 화면이 여정의 순서를 잃었다',
    ).toBeLessThan(verdictAt);
  });

  it('AI가 적은 문장은 사용자 판단으로 승격되지 않는다 (스파인)', () => {
    // 라벨 자체가 출처를 말한다 — provenance 세탁 금지의 화면 표현.
    expect(SEAL_SRC).toContain('AI가 대신 적어둔 확인 질문');
  });
});
