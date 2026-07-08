/**
 * CheckpointRail — 실단계 정거장 상태바 (창업자 3차 지적의 시공, 공정 5).
 * 은유 3분할 대신 실제 선택 단계 노드 + 지나온 노드 클릭 회항을 고정한다.
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CheckpointRail, type RailCheckpoint } from '../CheckpointRail';

const HULL_PATH = 'M2 11 L18 11 L15.5 15 L4.5 15 Z';

const cps: RailCheckpoint[] = [
  { key: 'situation', label: '상황', state: 'done', group: '묶기', groupEn: 'Bind' },
  { key: 'rope', label: '밧줄', state: 'done', group: '묶기', groupEn: 'Bind' },
  { key: 'q0', label: '질문1', state: 'done', group: '묶기', groupEn: 'Bind' },
  { key: 'q1', label: '질문2', state: 'current', group: '묶기', groupEn: 'Bind' },
  { key: 'draft', label: '초안', state: 'future', group: '듣기', groupEn: 'Listen' },
  { key: 'seal', label: '봉인', state: 'future', group: '닿기', groupEn: 'Land' },
];

describe('CheckpointRail — 정거장 상태바', () => {
  const html = renderToStaticMarkup(<CheckpointRail checkpoints={cps} onJump={() => {}} />);

  it('실단계 노드들이 전부 보인다 (은유 뭉뚱그림 아님)', () => {
    for (const label of ['상황', '밧줄', '질문1', '질문2', '초안', '봉인']) {
      expect(html).toContain(label);
    }
    expect(html).toContain(HULL_PATH); // 배는 현재 정거장 위
  });

  it('지나온 정거장만 버튼(회항 손잡이)이다 — 미래는 가짜 어포던스 없음', () => {
    // done 3개(상황·밧줄·질문1) = button, 미래(초안·봉인)는 button 아님
    const jumpButtons = html.match(/돌아가 보기|Look back at/g) || [];
    expect(jumpButtons.length).toBe(3);
  });

  it('eyebrow가 현재 위치와 다음 정거장을 말한다', () => {
    expect(html).toContain('질문2');
    expect(html).toContain('4/6');
    expect(html).toMatch(/다음: 초안|Next: 초안/);
  });
});
