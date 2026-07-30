import { describe, it, expect } from 'vitest';
import { derivePremiseTexts } from '../derive-premise-texts';
import type { ProgressiveSession } from '@/stores/types';

// Minimal session shapes — the function only reads final_mix/mix.key_assumptions
// and falsification.real_bet. Cast through unknown to avoid building the full type.
function session(s: Record<string, unknown>): ProgressiveSession {
  return s as unknown as ProgressiveSession;
}

describe('derivePremiseTexts', () => {
  it('primary: a sealed voyage populates from final_mix.key_assumptions (the bug fix)', () => {
    const s = session({ final_mix: { key_assumptions: ['금리가 올해 동결된다', '통근 40분 이내'] } });
    expect(derivePremiseTexts(s, [])).toEqual(['금리가 올해 동결된다', '통근 40분 이내']);
  });

  it('final_mix is preferred over mix when both exist', () => {
    const s = session({
      mix: { key_assumptions: ['old draft'] },
      final_mix: { key_assumptions: ['final assumption'] },
    });
    expect(derivePremiseTexts(s, [])).toEqual(['final assumption']);
  });

  it('falls back to mix when there is no final_mix', () => {
    const s = session({ mix: { key_assumptions: ['from mix'] } });
    expect(derivePremiseTexts(s, [])).toEqual(['from mix']);
  });

  it("the user's flinch bet leads, ahead of the AI key assumptions", () => {
    const s = session({
      falsification: { real_bet: '내 진짜 베팅' },
      final_mix: { key_assumptions: ['ai assumption'] },
    });
    expect(derivePremiseTexts(s, [])).toEqual(['내 진짜 베팅', 'ai assumption']);
  });

  it('falls back to reframe hidden_assumptions only when the session has none', () => {
    // 픽스처는 실제 문장 모양이어야 한다 — 'reframe a'/'reframe b' 같은 토막은
    // 근사중복 판정(sameClaim)에서 낱말이 하나만 남아 서로 같은 주장으로 합쳐진다
    // (2026-07-30, '전제 둘/전제 셋'과 같은 퇴화 사례).
    // session present but empty → still fall back
    expect(derivePremiseTexts(session({ final_mix: { key_assumptions: [] } }), ['온보딩 기간은 3~6개월로 잡는다.']))
      .toEqual(['온보딩 기간은 3~6개월로 잡는다.']);
    // no session at all
    expect(derivePremiseTexts(null, ['온보딩 기간은 3~6개월로 잡는다.', '핵심 인력 이탈은 이번 분기에 없다.']))
      .toEqual(['온보딩 기간은 3~6개월로 잡는다.', '핵심 인력 이탈은 이번 분기에 없다.']);
  });

  it('dedupes and drops empty/whitespace entries', () => {
    const s = session({ final_mix: { key_assumptions: ['x', '  x ', '', '   ', 'y'] } });
    expect(derivePremiseTexts(s, [])).toEqual(['x', 'y']);
  });

  it('returns [] when there is nothing anywhere', () => {
    expect(derivePremiseTexts(null, [])).toEqual([]);
    expect(derivePremiseTexts(session({}), [undefined, ''])).toEqual([]);
  });
});
