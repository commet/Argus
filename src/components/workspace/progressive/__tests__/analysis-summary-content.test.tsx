/**
 * 공정 5 — 요약은 내용을 실어야 한다 (창업자 실사용 지적 2026-07-08).
 *
 * 스켈레톤 단계는 대개 "먼저 — …"처럼 접속사로 시작한다. 요약 모드가 접두어만
 * 잘라 보여주면 화면엔 "1 먼저 / 2 그다음 / 3 그리고"라는 빈 목록이 남는다 —
 * 요약의 시체. 이 테스트는 요약 행이 반드시 본문의 첫 문장을 싣는 것을 고정한다.
 * UpdateSummaryChip도 같은 원칙: "+5 −5" 암호가 아니라 사람의 문장.
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AnalysisCard } from '../shared/AnalysisCard';
import { UpdateSummaryChip } from '../shared/UpdateSummaryChip';
import type { AnalysisSnapshot } from '@/stores/types';

const snapshot = {
  version: 2,
  real_question: '지금 동탄에서 막히는 건 타이밍인가, 여건인가?',
  insight: '타이밍보다 먼저 정해야 할 건 보유 기간이에요.',
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

describe('UpdateSummaryChip — 암호가 아니라 문장', () => {
  it('무엇이 움직였는지 사람의 말로 말한다', () => {
    const prev = { ...snapshot, version: 1, skeleton: snapshot.skeleton.slice(0, 1), hidden_assumptions: snapshot.hidden_assumptions.slice(0, 1) } as unknown as AnalysisSnapshot;
    const html = renderToStaticMarkup(
      <UpdateSummaryChip snapshot={snapshot} prevSnapshot={prev} locale="ko" />,
    );
    expect(html).toContain('방금 답이 반영됐어요');
    expect(html).toContain('단계 2개 다시 짜임');
    expect(html).toContain('가정 1개 새로 세움');
  });
});
