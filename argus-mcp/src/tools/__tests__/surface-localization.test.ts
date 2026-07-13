import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { tmpArgusDir, body, isError } from '../../test-helpers.js';
import { configPath } from '../../lib/layout.js';
import { openDecision } from '../open-decision.js';
import { seal } from '../seal.js';
import { settle } from '../settle.js';
import { recheck } from '../recheck.js';
import { premises } from '../premises.js';
import { amend, dismiss } from '../amend-dismiss.js';
import type { McpToolResult } from '../../lib/envelope.js';

const TODAY = '2026-07-02';
const surface = (r: McpToolResult): string => String(body(r)['surface']);

function pin(dir: string, locale: 'ko' | 'en'): void {
  fs.writeFileSync(configPath(dir), `schema_version: 5\nlocale: ${locale}\n`, 'utf8');
}

/**
 * M4 — the 6 tools that had English happy-path one-liners regardless of locale
 * now speak ko/en. en byte-preserves the pre-M4 strings; ko is the new half.
 * Each tool is proven both ways by pinning config (config wins the chain).
 */
describe('M4 surface localization — the 6 dogfood tools', () => {
  it('open_decision (FIRE) — ko vs en', async () => {
    const dirEn = tmpArgusDir(); pin(dirEn, 'en');
    const rEn = await openDecision.handler({
      argus_dir: dirEn, id: 'd1', decision: 'ship the redesign now or wait',
      stakes: 'high', reversibility: 'one_way_door', status_quo: 'keep the current design', today_override: TODAY,
    });
    expect(isError(rEn)).toBe(false);
    expect(surface(rEn)).toContain('Opened.');

    const dirKo = tmpArgusDir(); pin(dirKo, 'ko');
    const rKo = await openDecision.handler({
      argus_dir: dirKo, id: 'd1', decision: '리디자인을 지금 낼지 기다릴지',
      stakes: 'high', reversibility: 'one_way_door', status_quo: '현재 디자인 유지', today_override: TODAY,
    });
    expect(surface(rKo)).toContain('열었습니다');
  });

  it('open_decision (RESTRAINT) — ko reason + coda', async () => {
    const dir = tmpArgusDir(); pin(dir, 'ko');
    const r = await openDecision.handler({
      argus_dir: dir, id: 'd2', decision: '점심 뭐 먹을지',
      stakes: 'trivial', reversibility: 'easily_reversible', status_quo: '그냥 아무거나', today_override: TODAY,
    });
    expect(isError(r)).toBe(false);
    expect(surface(r)).toContain('진짜 선택지'); // the leave-coda
  });

  it('seal — ko vs en, and seal_text follows the same locale', async () => {
    const dirEn = tmpArgusDir(); pin(dirEn, 'en');
    const rEn = await seal.handler({ argus_dir: dirEn, id: 's1', predicate: 'cutover downtime under 5 min', check_by: '2027-01-01', predicate_owner: 'user', today_override: TODAY });
    expect(surface(rEn)).toContain('Prediction saved.');
    expect(String((body(rEn)['data'] as Record<string, unknown>)['seal_text'])).toContain('PREDICTION SAVED');

    const dirKo = tmpArgusDir(); pin(dirKo, 'ko');
    const rKo = await seal.handler({ argus_dir: dirKo, id: 's1', predicate: '컷오버 다운타임 5분 미만', check_by: '2027-01-01', predicate_owner: 'user', today_override: TODAY });
    expect(surface(rKo)).toContain('예측을 저장했습니다');
    expect(String((body(rKo)['data'] as Record<string, unknown>)['seal_text'])).toContain('예측 저장');
  });

  it('settle — ko vs en', async () => {
    const dirEn = tmpArgusDir(); pin(dirEn, 'en');
    await seal.handler({ argus_dir: dirEn, id: 'x', predicate: 'cutover downtime under 5 min', check_by: '2026-08-01', predicate_owner: 'user', today_override: TODAY });
    const rEn = await settle.handler({ argus_dir: dirEn, id: 'x', outcome: 'held', outcome_source: 'user_stated', what_happened: 'downtime was 4 minutes', today_override: '2026-08-02' });
    expect(surface(rEn)).toContain('Result recorded:');

    const dirKo = tmpArgusDir(); pin(dirKo, 'ko');
    await seal.handler({ argus_dir: dirKo, id: 'x', predicate: '컷오버 다운타임 5분 미만', check_by: '2026-08-01', predicate_owner: 'user', today_override: TODAY });
    const rKo = await settle.handler({ argus_dir: dirKo, id: 'x', outcome: 'held', outcome_source: 'user_stated', what_happened: '다운타임은 4분이었다', today_override: '2026-08-02' });
    expect(surface(rKo)).toContain('실제 결과를 기록했습니다');
  });

  it('recheck (baseline + material) — ko vs en', async () => {
    const mk = async (dir: string, locale: 'ko' | 'en') => {
      pin(dir, locale);
      await seal.handler({ argus_dir: dir, id: 'd1', predicate: 'we migrate with under 5 minutes of downtime', check_by: '2026-09-01', predicate_owner: 'user', today_override: TODAY });
      await premises.handler({ argus_dir: dir, id: 'd1', op: 'add', today_override: TODAY, premises: [{ text: 'base rate 3.5%', kind: 'premise', external: true, load_bearing: true, source: 'ai', ai_original: 'base rate 3.5%' }] });
    };
    const dirEn = tmpArgusDir(); await mk(dirEn, 'en');
    const bEn = await recheck.handler({ argus_dir: dirEn, id: 'd1', ref: 'P1', finding: 'base rate 3.5%', numeric_value: 3.5, source: 'url', today_override: TODAY });
    expect(surface(bEn)).toContain('Baseline recorded');
    const mEn = await recheck.handler({ argus_dir: dirEn, id: 'd1', ref: 'P1', finding: 'base rate 4.0%', numeric_value: 4.0, source: 'url', today_override: TODAY });
    expect(surface(mEn)).toContain('your call');

    const dirKo = tmpArgusDir(); await mk(dirKo, 'ko');
    const bKo = await recheck.handler({ argus_dir: dirKo, id: 'd1', ref: 'P1', finding: '기준금리 3.5%', numeric_value: 3.5, source: 'url', today_override: TODAY });
    expect(surface(bKo)).toContain('기준값을 기록');
    const mKo = await recheck.handler({ argus_dir: dirKo, id: 'd1', ref: 'P1', finding: '기준금리 4.0%', numeric_value: 4.0, source: 'url', today_override: TODAY });
    // 어휘 1벌 (공정 3 상환): 웹 T2와 같은 어휘 — "다시 볼지는 당신의 몫"
    expect(surface(mKo)).toContain('다시 볼지는 당신의 몫');
  });

  it('amend — ko vs en', async () => {
    const dirEn = tmpArgusDir(); pin(dirEn, 'en');
    await seal.handler({ argus_dir: dirEn, id: 'a', predicate: 'cutover downtime under 5 min', check_by: '2027-01-01', predicate_owner: 'user', today_override: TODAY });
    const rEn = await amend.handler({ argus_dir: dirEn, id: 'a', check_by: '2027-02-01', today_override: TODAY });
    expect(surface(rEn)).toContain('Amended.');

    const dirKo = tmpArgusDir(); pin(dirKo, 'ko');
    await seal.handler({ argus_dir: dirKo, id: 'a', predicate: '컷오버 다운타임 5분 미만', check_by: '2027-01-01', predicate_owner: 'user', today_override: TODAY });
    const rKo = await amend.handler({ argus_dir: dirKo, id: 'a', check_by: '2027-02-01', today_override: TODAY });
    expect(surface(rKo)).toContain('수정했습니다');
  });

  it('dismiss — ko vs en', async () => {
    const dirEn = tmpArgusDir(); pin(dirEn, 'en');
    await seal.handler({ argus_dir: dirEn, id: 'z', predicate: 'cutover downtime under 5 min', check_by: '2027-01-01', predicate_owner: 'user', today_override: TODAY });
    const rEn = await dismiss.handler({ argus_dir: dirEn, id: 'z', dismiss_reason: 'became_irrelevant', today_override: TODAY });
    expect(surface(rEn)).toContain('Dismissed.');

    const dirKo = tmpArgusDir(); pin(dirKo, 'ko');
    await seal.handler({ argus_dir: dirKo, id: 'z', predicate: '컷오버 다운타임 5분 미만', check_by: '2027-01-01', predicate_owner: 'user', today_override: TODAY });
    const rKo = await dismiss.handler({ argus_dir: dirKo, id: 'z', dismiss_reason: 'became_irrelevant', today_override: TODAY });
    expect(surface(rKo)).toContain('접었습니다');
  });

  it('config-less: input text drives locale (no pin)', async () => {
    const dir = tmpArgusDir(); // no config.yaml
    const rKo = await seal.handler({ argus_dir: dir, id: 'nc', predicate: '컷오버 다운타임 5분 미만', check_by: '2027-01-01', predicate_owner: 'user', today_override: TODAY });
    expect(surface(rKo)).toContain('예측을 저장했습니다'); // Korean predicate ⇒ Korean surface
  });
});
