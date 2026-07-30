import { describe, it, expect } from 'vitest';
import { buildAutoTrackedPremiseItems } from '../auto-track-premises';
import type { ProgressiveSession } from '@/stores/types';

const NOW = Date.parse('2026-07-06T00:00:00Z');

function session(assumptions: string[], realBet?: string): ProgressiveSession {
  return {
    final_mix: { key_assumptions: assumptions },
    ...(realBet ? { falsification: { real_bet: realBet } } : {}),
  } as unknown as ProgressiveSession;
}

describe('buildAutoTrackedPremiseItems — §3.4 premises tracked at seal', () => {
  it('creates tracked premise items — premise 는 기본 종 켬 (2026-07-30 결정)', () => {
    const items = buildAutoTrackedPremiseItems('projA', session(['경쟁사가 이 기능을 아직 안 냈다', '팀이 2주 안에 만들 수 있다']), NOW);
    expect(items).toHaveLength(2);
    for (const it of items) {
      expect(it.type).toBe('premise');
      expect(it.source).toBe('ai');
      // 숨은 opt-in(실측 22건 중 켜짐 0건)을 보이는 opt-out 으로 — 서버 감시가
      // 지켜볼 대상을 갖는 유일한 길이다. 끄는 스위치는 봉인 서랍에 보인다.
      expect(it.external).toBe(true);
      expect(it.alert?.mode).toBe('on_change');
      expect(it.load_bearing).toBe(false);
      expect(it.status).toBe('active');
      expect(it.decision_id).toBe('projA');
    }
  });

  it('서랍에서 종을 끈 문장은 조용히 추적만 한다 (external:false, 표기 차이도 매칭)', () => {
    const items = buildAutoTrackedPremiseItems('projA', session([
      '다음 분기 매출이 지금 수준을 유지한다.',
      '핵심 인력 이탈은 이번 분기에 없다.',
    ]), NOW, { bellOffTexts: ['다음 분기 매출은 지금 수준을 그대로 유지한다.'] });
    expect(items).toHaveLength(2); // 종 끔은 deny 가 아니다 — 목록에는 남는다
    const muted = items.find((i) => i.text.includes('매출'))!;
    const watched = items.find((i) => i.text.includes('인력'))!;
    expect(muted.external).toBe(false);
    expect(muted.alert?.mode).not.toBe('on_change');
    expect(watched.external).toBe(true);
    expect(watched.alert?.mode).toBe('on_change');
  });

  it('미결 질문(open_question)은 종 대상이 아니다 — 현실이 답해주지 않는다', () => {
    const items = buildAutoTrackedPremiseItems('projA', session(['이 일정이 현실적으로 가능한가요?']), NOW);
    expect(items[0].type).toBe('open_question');
    expect(items[0].external).toBe(false);
    expect(items[0].alert?.mode).not.toBe('on_change');
  });

  it("includes the user's flinch bet first when present", () => {
    const items = buildAutoTrackedPremiseItems('projA', session(['가정 A'], '내 진짜 베팅'), NOW);
    expect(items[0].text).toBe('내 진짜 베팅');
  });

  it('caps the auto-tracked set at 5 (a decision is not a wiki)', () => {
    const many = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
    expect(buildAutoTrackedPremiseItems('projA', session(many), NOW)).toHaveLength(5);
  });

  it('is idempotent — same texts → same stable ids (addItems dedupes on re-seal)', () => {
    const a = buildAutoTrackedPremiseItems('projA', session(['같은 전제']), NOW);
    const b = buildAutoTrackedPremiseItems('projA', session(['같은 전제']), NOW + 1000);
    expect(a[0].id).toBe(b[0].id);
  });

  it('no session / no assumptions → nothing to track (honest empty)', () => {
    expect(buildAutoTrackedPremiseItems('projA', null, NOW)).toEqual([]);
    expect(buildAutoTrackedPremiseItems('projA', session([]), NOW)).toEqual([]);
  });
});
