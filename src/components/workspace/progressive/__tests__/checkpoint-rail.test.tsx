/**
 * CheckpointRail — 3그룹 밴드 + 활성 그룹만 펼치는 정거장 상태바.
 * 순수 3은유(무의미)도, 평면 N노드(너무 많음)도 아닌 중간을 고정한다:
 * 그룹으로 묶되 지금 있는 그룹의 실단계 + 질문 카운터는 보이고, 지나온
 * 밴드만 손잡이(회항 버튼)로 접힌다.
 *
 * 주: 정적 렌더는 기본 EN 로케일 — 그룹명은 Frame/Writing/Check, 질문은 Q&A로
 * 나온다. 노드 라벨(상황·처음 생각·정리·봉인)은 cps가 준 문자열이라 로케일 불변.
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CheckpointRail, type RailCheckpoint } from '../CheckpointRail';

const HULL_PATH = 'M2 11 L18 11 L15.5 15 L4.5 15 Z';

// 상황·처음 생각·질문1·질문2(현재)·정리·봉인.
const cps: RailCheckpoint[] = [
  { key: 'situation', label: '상황', state: 'done', group: '짚어보기', groupEn: 'Frame' },
  { key: 'rope', label: '처음 생각', state: 'done', group: '짚어보기', groupEn: 'Frame' },
  { key: 'q0', label: '질문1', state: 'done', group: '짚어보기', groupEn: 'Frame' },
  { key: 'q1', label: '질문2', state: 'current', group: '짚어보기', groupEn: 'Frame' },
  { key: 'draft', label: '정리', state: 'future', group: '작성', groupEn: 'Writing' },
  { key: 'seal', label: '봉인', state: 'future', group: '확인', groupEn: 'Check' },
];

describe('CheckpointRail — 3밴드 정거장 상태바', () => {
  const html = renderToStaticMarkup(<CheckpointRail checkpoints={cps} onJump={() => {}} />);

  it('exposes the rail as navigation and marks the current stop', () => {
    expect(html).toContain('role="navigation"');
    expect(html).toContain('aria-current="step"');
  });

  it('세 그룹(Frame/Writing/Check)이 밴드로 보인다', () => {
    for (const group of ['Frame', 'Writing', 'Check']) {
      expect(html).toContain(group);
    }
  });

  it('활성 그룹의 실단계 + 질문이 개별 노드로 전부 펼쳐진다 (카운터 뭉치기 아님)', () => {
    // 활성 밴드의 실단계 노드는 노출.
    expect(html).toContain('상황');
    expect(html).toContain('처음 생각');
    // 중요: 질문1·질문2가 각각 개별 노드로 남아야 다 넘어갈 수 있다.
    expect(html).toContain('질문1');
    expect(html).toContain('질문2');
    expect(html).toContain(HULL_PATH); // 배는 현재 노드(질문2) 위
  });

  it('지나온 질문(질문1)은 개별 회항 손잡이(버튼)다', () => {
    // done 질문 노드는 "질문1(으)로 돌아가 보기" 버튼으로 렌더.
    expect(html).toMatch(/질문1\(으\)로 돌아가 보기|Look back at 질문1/);
  });

  it('미래 밴드(Writing/Check)는 실단계를 미리보기로 접어 보여준다', () => {
    // 정리/봉인은 미래 밴드의 서브라벨로만 남는다(개별 클릭 노드 아님).
    expect(html).toContain('정리');
    expect(html).toContain('봉인');
  });

  it('지나온 손잡이만 회항 버튼이다 — 미래는 가짜 어포던스 없음', () => {
    // 회항 버튼: 활성 밴드의 done 노드(상황·밧줄) + 진행 중 질문(답한 게 있음).
    const jumpTitles = html.match(/돌아가 보기|Look back at/g) || [];
    expect(jumpTitles.length).toBeGreaterThanOrEqual(2);
    // 미래 밴드 칩은 회항 어포던스로 렌더되지 않는다.
    expect(html).not.toMatch(/Look back at Writing|Look back at Check/);
  });

  it('eyebrow가 현재 그룹·다음 정거장을 말한다', () => {
    expect(html).toContain('Frame');
    expect(html).toMatch(/다음: 정리|Next: 정리/);
  });

  it('회항 기능이 없으면 지나온 밴드를 가짜 버튼으로 만들지 않는다', () => {
    const pastBand: RailCheckpoint[] = cps.map((checkpoint) => {
      if (checkpoint.group === '정리') return { ...checkpoint, state: 'done' };
      if (checkpoint.key === 'draft') return { ...checkpoint, state: 'current' };
      return checkpoint;
    });
    const withoutJump = renderToStaticMarkup(<CheckpointRail checkpoints={pastBand} />);
    expect(withoutJump).not.toContain('<button');
    expect(withoutJump).not.toMatch(/Look back at the Frame stage|정리 단계로 돌아가 보기/);
  });
});
