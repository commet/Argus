/**
 * 공정 M0 · 문과 언어 — exit evidence (BLUEPRINT §9.5).
 *
 * Pins the four repairs that make the first day survivable:
 *  - the Korean journey ends in a KOREAN receipt (FC-2's last renderer),
 *  - check_in output stays bounded after a long gap,
 *  - the reconsider-cadence alias is accepted (the misspelled field was a trap),
 *  - sync failure reasons reach the user as sentences, not enum tokens.
 * (The zero-config ~/.argus default and the unexpanded-${...} error are pinned
 * in resolve-tool-argus-dir.test.ts.)
 */
import { describe, it, expect } from 'vitest';
import { tmpArgusDir, body } from '../../test-helpers.js';
import { openDecision } from '../open-decision.js';
import { seal } from '../seal.js';
import { settle } from '../settle.js';
import { recall } from '../recall.js';
import { checkIn } from '../check-in.js';
import { premises } from '../premises.js';
import { humanizeSyncReason } from '../../lib/surfaces.js';

const FUTURE = '2027-01-01';

// NOTE deliberately no argus_init in the locale tests: init seeds config.yaml
// with the MACHINE's locale (env/Intl), and an explicit config always wins —
// which would make these tests pass or fail depending on the CI machine's
// language. With no config, the response voice follows the user's own text
// (the detection chain's design), which is what FC-2 is actually about.
async function sealOne(dir: string, id: string, predicate: string, checkBy = FUTURE) {
  await openDecision.handler({
    argus_dir: dir, id, decision: `${id} — 갈림길`, stakes: 'high',
    reversibility: 'one_way_door', status_quo: '현상 유지',
  });
  return body(await seal.handler({ argus_dir: dir, id, predicate, check_by: checkBy, predicate_owner: 'user' }));
}

describe('M0 · the Korean journey ends in a Korean receipt (FC-2)', () => {
  it('settle with Korean what_happened renders receipt_text in Korean, brand line intact', async () => {
    const dir = tmpArgusDir();
    await sealOne(dir, 'job-offer', '이직 후 6개월 안에 담당 제품이 정식 출시된다');

    const settled = body(await settle.handler({
      argus_dir: dir, id: 'job-offer', outcome: 'missed', outcome_source: 'user_stated',
      what_happened: '제품 출시가 3개월 밀렸다. 아직 미출시.',
    }));
    expect(settled['ok']).toBe(true);
    const text = String((settled['data'] as Record<string, unknown>)['receipt_text']);
    expect(text).toContain('판단 영수증');
    expect(text).toContain('당신의 예측');
    expect(text).toContain('실제로 일어난 일');
    expect(text).toContain('확인일');
    expect(text).not.toContain('YOU PREDICTED');
    expect(text).not.toContain('you skipped naming this');
    // Brand DNA stays English in every locale (§9.3) — the OG centerpiece line.
    expect(text).toContain('AI VERDICT ON THIS DECISION');
    expect(text).toContain('NONE');
  });

  it('recall view=receipt follows the sealed predicate language', async () => {
    const dir = tmpArgusDir();
    await sealOne(dir, 'ko-recall', '다음 분기 안에 첫 유료 고객이 생긴다');
    await settle.handler({
      argus_dir: dir, id: 'ko-recall', outcome: 'held', outcome_source: 'user_stated',
      what_happened: '유료 고객 2명 생김',
    });
    const recalled = body(await recall.handler({ argus_dir: dir, view: 'receipt', id: 'ko-recall' }));
    expect(recalled['ok']).toBe(true);
    const text = String((recalled['data'] as Record<string, unknown>)['receipt_text']);
    expect(text).toContain('판단 영수증');
    expect(text).toContain('모델은 당신을 채점하지 않았습니다');
  });

  it('the English journey still gets the byte-familiar English receipt', async () => {
    const dir = tmpArgusDir();
    await sealOne(dir, 'en-loop', 'Cutover downtime is under 5 minutes');
    const settled = body(await settle.handler({
      argus_dir: dir, id: 'en-loop', outcome: 'held', outcome_source: 'user_stated',
      what_happened: 'Cutover took 3 minutes, no customer reports',
    }));
    const text = String((settled['data'] as Record<string, unknown>)['receipt_text']);
    expect(text).toContain('ARGUS · JUDGMENT RECEIPT');
    expect(text).toContain('YOU PREDICTED');
    expect(text).toContain('The model never graded you. Reality did.');
  });
});

describe('M0 · check_in stays bounded after a long gap (§9.4 경계 수리)', () => {
  it('caps data.due at 20, keeps the TRUE total in due_count, and discloses the cut', async () => {
    const dir = tmpArgusDir();
    for (let i = 0; i < 25; i++) {
      await sealOne(dir, `d-${String(i).padStart(2, '0')}`, `prediction number ${i} comes true`);
    }
    const res = body(await checkIn.handler({ argus_dir: dir, today_override: '2027-02-01' }));
    expect(res['ok']).toBe(true);
    const data = res['data'] as Record<string, unknown>;
    expect((data['due'] as unknown[]).length).toBe(20);
    expect(data['due_count']).toBe(25);
    expect(String(data['due_truncated'])).toContain('25');
    // The surface tells the truth about the full count, not the visible slice.
    expect(String(res['surface'])).toContain('25');
  });
});

describe('M0 · reconsider_cadence_days alias (the reponder trap)', () => {
  it('accepts the correctly-spelled alias on op=add for an open question', async () => {
    const dir = tmpArgusDir();
    await openDecision.handler({
      argus_dir: dir, id: 'alias-q', decision: '핵심 채용을 지금 할까 — 갈림길', stakes: 'high',
      reversibility: 'one_way_door', status_quo: '보류',
    });
    const added = body(await premises.handler({
      argus_dir: dir, id: 'alias-q', op: 'add',
      premises: [{
        text: '이 역할이 6개월 뒤에도 필요한가', kind: 'open_question',
        source: 'user_stated', reconsider_cadence_days: 30,
      }],
    }));
    expect(added['ok']).toBe(true);
  });
});

describe('M0 · sync failure reasons are sentences, not enum tokens', () => {
  it('translates the known machine reasons in both locales and passes unknowns through', () => {
    expect(humanizeSyncReason('bad_token_format', 'en')).toContain('argus_pat_');
    expect(humanizeSyncReason('bad_token_format', 'ko')).toContain('토큰');
    expect(humanizeSyncReason('http_401', 'en')).toContain('expired');
    expect(humanizeSyncReason('http_401', 'ko')).toContain('새 토큰');
    expect(humanizeSyncReason('network', 'ko')).toContain('네트워크');
    expect(humanizeSyncReason('weird_reason', 'en')).toBe('weird_reason');
  });
});
