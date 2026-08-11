/**
 * 묶음 예측 안내가 유혹의 지점에 남아 있는지 지킨다.
 *
 * 2026-08-11 첫 사용자 여정 시뮬레이션에서 4회 중 3회가 같은 자리에서 죽었다:
 * 사용자의 기대는 여러 개의 반증가능한 주장인데(대체로 순조롭고 · 엣지 케이스
 * 한둘 · 금요일 완료) 도구는 하나를 받는다. 어시스턴트는 그 불일치를 정확히
 * 진단하고("어느 부분이 맞았는지 흐려진다") 사용자에게 설명한 뒤 멈췄다 —
 * 쪼개자고 제안하지도, 하나를 고르지도 않아 기록이 0건이 됐다.
 * (근거: docs/receipts/2026-08-11-first-user-journey/)
 *
 * 수리는 M1의 위치 수리와 같은 형태다: 규칙을 전역 지침이 아니라 모델이
 * 호출문을 쓰는 바로 그 자리(predicate 설명)와 막혔을 때 읽는 자리(에러
 * 복구문)에 놓는다. 이 테스트는 그 두 자리를 지킨다.
 */
import { describe, it, expect } from 'vitest';
import { seal } from '../seal.js';

const predicateDescription = (): string => {
  const shape = seal.inputSchema as unknown as { shape?: Record<string, { description?: string }> };
  const d = shape.shape?.predicate?.description;
  expect(typeof d, 'predicate 필드의 설명이 사라지면 규칙이 놓일 자리가 없다').toBe('string');
  return d as string;
};

describe('묶음 예측 안내 (첫 사용자 여정 수리)', () => {
  it('predicate 설명이 "한 번에 하나"와 쪼개기 경로를 함께 말한다', () => {
    const d = predicateDescription();
    // 하나임을 말하는 것만으로는 부족하다 — 여러 개일 때 무엇을 하라는지가 없으면
    // 어시스턴트는 시뮬레이션에서 그랬듯 설명만 하고 멈춘다.
    expect(d, '한 호출에 한 주장이라는 규칙').toMatch(/one claim per call/i);
    expect(d, '여러 개일 때의 행동 지시(따로 봉인)').toMatch(/separate call/i);
    expect(d, '묶지 말라는 금지').toMatch(/do not bundle/i);
  });

  it('묶으면 왜 안 되는지의 이유가 함께 있다 — 이유 없는 금지는 무시된다', () => {
    const d = predicateDescription();
    expect(d).toMatch(/cannot be marked true or false/i);
  });

  it('나머지를 조용히 버리지 말라는 지시가 있다', () => {
    // 쪼개기만 가르치면 어시스턴트가 하나만 봉인하고 나머지를 말없이 버릴 수 있다.
    // 그건 사용자의 기대 일부가 소리 없이 사라지는 것이라 더 나쁘다.
    expect(predicateDescription()).toMatch(/not.{0,20}silently drop|name the ones/i);
  });

  it('길이 거부의 복구문이 "짧게 줄여라"가 아니라 "쪼개라"로 안내한다', async () => {
    // 짧게 줄이라는 안내는 예측을 모호하게 만들어 정산 자체를 무의미하게 한다.
    const { localizeToolResult } = await import('../../lib/localize-result.js');
    const probe = localizeToolResult({}, {
      content: [{ type: 'text' as const, text: '{}' }],
      structuredContent: {},
      isError: true,
    });
    void probe;
    const source = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('../../lib/localize-result.ts', import.meta.url), 'utf8'));
    expect(source, '복구문이 쪼개기를 안내해야 한다').toMatch(/split it and seal each separately/i);
    expect(source, '모호하게 줄이는 것을 막는 문구').toMatch(/rather than shortening it into vagueness/i);
  });
});
