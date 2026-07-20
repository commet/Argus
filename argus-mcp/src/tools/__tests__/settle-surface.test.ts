/**
 * 정산 surface 회귀 방지 (도그푸딩 발견 F1, 2026-07-12).
 *
 * 도그푸딩에서 읽어보니 정산 확인 문구가 held/missed/avoided/partial 전부
 * **동일한 제네릭 문장**이었다 — 제품의 감정적 절정(정산)이 밋밋했다
 * (창업자의 "임팩트 없네" 직감의 코드상 정체). 개선: outcome을 사실로
 * 명명하고 영수증(keepsake)을 가리킨다. 이 테스트가 그 개선을 고정한다 —
 * 의미-담지 surface가 조용히 제네릭으로 되돌아가지 못하게.
 *
 * 스파인 불변식도 같이 지킨다: outcome은 사용자가 기록한 사실이지 AI의
 * 평결이 아니다. "no grade / 평가는 없습니다"가 항상 붙고, 위로·훈계
 * 어휘는 절대 없다.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { tmpArgusDir, body } from '../../test-helpers.js';
import { configPath } from '../../lib/layout.js';
import { seal } from '../seal.js';
import { settle } from '../settle.js';
import type { McpToolResult } from '../../lib/envelope.js';

const surface = (r: McpToolResult): string => String(body(r)['surface']);
const pin = (dir: string, locale: 'ko' | 'en') =>
  fs.writeFileSync(configPath(dir), `schema_version: 5\nlocale: ${locale}\n`, 'utf8');

async function sealThenSettle(locale: 'ko' | 'en', outcome: 'held' | 'avoided' | 'partial' | 'missed') {
  const dir = tmpArgusDir(); pin(dir, locale);
  await seal.handler({
    argus_dir: dir, id: 'd', predicate: 'this is a long enough falsifiable prediction line',
    check_by: '2026-08-01', predicate_owner: 'user', today_override: '2026-07-12',
  });
  return surface(await settle.handler({
    argus_dir: dir, id: 'd', outcome, outcome_source: 'user_stated',
    what_happened: 'reality did its thing', today_override: '2026-08-01',
  }) as McpToolResult);
}

const OUTCOMES = ['held', 'avoided', 'partial', 'missed'] as const;
const KO_WORD = { held: '예측대로 됐다', avoided: '걱정한 일은 안 일어났다', partial: '일부만 맞았다', missed: '예측이 빗나갔다' };

describe('정산 surface는 outcome을 명명한다 (F1 회귀 방지)', () => {
  it('en: 네 outcome이 서로 다른 문구를 내고, 각자 그 결과를 명명한다', async () => {
    const seen = new Set<string>();
    for (const o of OUTCOMES) {
      const s = await sealThenSettle('en', o);
      expect(s.toLowerCase()).toContain(o);          // 결과를 사실로 명명
      expect(s).toContain('receipt');                 // keepsake 손잡이
      expect(s.toLowerCase()).toContain('no grade');  // 스파인: 평결 없음
      seen.add(s);
    }
    expect(seen.size).toBe(4); // 제네릭 단일 문구로 회귀하면 여기서 깨진다
  });

  it('ko: 네 outcome이 서로 다른 문구를 내고 한글로 결과를 명명한다', async () => {
    const seen = new Set<string>();
    for (const o of OUTCOMES) {
      const s = await sealThenSettle('ko', o);
      expect(s).toContain(KO_WORD[o]);
      expect(s).toContain('평가는 없습니다');
      seen.add(s);
    }
    expect(seen.size).toBe(4);
  });

  it('스파인: 위로·훈계·평결 어휘가 어떤 outcome에도 없다', async () => {
    for (const o of OUTCOMES) {
      const en = await sealThenSettle('en', o);
      const ko = await sealThenSettle('ko', o);
      expect(en + ko).not.toMatch(/(안타|아쉽|다음엔|반성|failed you|try again|better luck|잘했|못했|훌륭)/);
    }
  });
});
