/**
 * 공정 5 — 요약은 내용을 실어야 한다 (창업자 실사용 지적 2026-07-08).
 *
 * 스켈레톤 단계는 대개 "먼저 — …"처럼 접속사로 시작한다. 요약 모드가 접두어만
 * 잘라 보여주면 화면엔 "1 먼저 / 2 그다음 / 3 그리고"라는 빈 목록이 남는다 —
 * 요약의 시체. 이 테스트는 요약 행이 반드시 본문의 첫 문장을 싣는 것을 고정한다.
 * 접힌 항로는 라벨 조각을 흩뿌리지 않고 결론 → 이유 → 근거 CTA를 한 흐름으로
 * 보여준다. 저장된 예전 인사이트의 메타 서문도 사용자에게 다시 노출하지 않는다.
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AnalysisCard } from '../shared/AnalysisCard';
import type { AnalysisSnapshot } from '@/stores/types';

const snapshot = {
  version: 2,
  real_question: '지금 동탄에서 막히는 건 타이밍인가, 여건인가?',
  insight: "'막혀 있다는 느낌'이라는 표현이 핵심이에요 — 이직 여부보다, 지금 회사의 성장 한계가 실제인지 먼저 확인해야 해요. 막힘이 구조적 한계인지, 아직 기회를 제대로 요청해보지 않은 상태인지에 따라 결론이 달라집니다.",
  hidden_assumptions: ['동탄을 하나의 시장으로 보고 있다', '실거주와 투자의 기준이 같다고 보고 있다'],
  skeleton: [
    '먼저 — 내 목적부터 한 줄로 써보세요. 이게 없으면 이후 판단이 흔들려요.',
    '그다음 — 국토부 실거래가에서 최근 추이를 직접 뽑아보세요. 호가가 아니라 실제 가격이 핵심이에요.',
    '마지막으로 — 공인중개사 2~3곳을 직접 방문해 최근 거래 케이스를 물어보세요.',
  ],
} as unknown as AnalysisSnapshot;

describe('AnalysisCard 요약 — 접속사가 아니라 내용', () => {
  it('요약 모드의 각 단계 행이 본문 첫 문장을 싣는다', () => {
    const html = renderToStaticMarkup(
      <AnalysisCard snapshot={snapshot} prevSnapshot={null} locale="ko" />,
    );
    // 접두어(먼저/그다음)만 덜렁 남지 않고 첫 문장이 따라붙는다.
    expect(html).toContain('내 목적부터 한 줄로 써보세요.');
    expect(html).toContain('국토부 실거래가에서 최근 추이를 직접 뽑아보세요.');
    expect(html).toContain('공인중개사 2~3곳을 직접 방문해 최근 거래 케이스를 물어보세요.');
  });
});

describe('AnalysisCard 접힌 항로 — 결론, 이유, 근거가 한 흐름', () => {
  it('답변 상태와 읽을거리를 편집형 계층으로 묶는다', () => {
    const html = renderToStaticMarkup(
      <AnalysisCard
        snapshot={snapshot}
        prevSnapshot={null}
        answerCount={2}
        defaultCollapsed
        locale="ko"
      />,
    );
    expect(html).toContain('지금 살펴볼 것');
    expect(html).toContain('2개 답변 반영 · 계속 조정 중');
    expect(html).toContain('이직 여부보다, 지금 회사의 성장 한계가 실제인지 먼저 확인해야 해요.');
    expect(html).toContain('막힘이 구조적 한계인지, 아직 기회를 제대로 요청해보지 않은 상태인지에 따라 결론이 달라집니다.');
    expect(html).not.toContain('표현이 핵심이에요');
    expect(html).toContain('계획 3단계');
    expect(html).toContain('확인할 가정 2개');
    expect(html).toContain('근거 보기');
  });

  it('초안 이후에는 더 조정 중인 것처럼 말하지 않는다', () => {
    const html = renderToStaticMarkup(
      <AnalysisCard
        snapshot={snapshot}
        prevSnapshot={null}
        isActive={false}
        answerCount={2}
        defaultCollapsed
        locale="ko"
      />,
    );
    expect(html).toContain('2개 답변 반영 · 방향 정리됨');
    expect(html).not.toContain('계속 조정 중');
  });
});
