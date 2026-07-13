/**
 * 공정 M1 · 당직 루프 — exit evidence (BLUEPRINT §9.5).
 *
 * Pins the second orbit's spine rulings (§9.2):
 *  1. the watch journey: anchor → capture → next session's check_in mirrors
 *     the anchor back as a question;
 *  2. an anchor is a NOTE, not a bet — it never enters ids/stats/track_record;
 *  3. the restraint cliff is resolved by recording quietly (기록과 의식 분리):
 *     a restrained decision is still kept, so no separate watch-note exit is offered;
 *  4. capture provenance is never forged (ai_surfaced requires ai_original);
 *  5. surface vocabulary: no directive/praise language on watch & recheck
 *     surfaces, and the recheck handle-return matches the web T2 vocabulary.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { tmpArgusDir, body, isError } from '../../test-helpers.js';
import { watch } from '../watch.js';
import { checkIn } from '../check-in.js';
import { openDecision } from '../open-decision.js';
import { seal } from '../seal.js';
import { recall } from '../recall.js';
import { replayLedger } from '../../lib/ledger-replay.js';
import { SURFACES } from '../../lib/surfaces.js';
import { SERVER_INSTRUCTIONS } from '../../lib/spine.js';

const D1 = '2026-07-08';
const D2 = '2026-07-09';

describe('M1 · the watch journey (anchor → capture → mirror)', () => {
  it('mirrors yesterday\'s anchor back as a question on the next check_in', async () => {
    const dir = tmpArgusDir();
    const anchored = body(await watch.handler({
      argus_dir: dir, op: 'anchor', today_override: D1,
      text: '오늘은 결제 모듈 MVP까지 간다 — 지금 구조로 충분하다고 본다',
    }));
    expect(anchored['ok']).toBe(true);

    const captured = body(await watch.handler({
      argus_dir: dir, op: 'capture', today_override: D1, kind: 'premise',
      text: '고객은 간편결제를 우선 원한다', source: 'user_stated',
    }));
    expect(captured['ok']).toBe(true);

    const next = body(await checkIn.handler({ argus_dir: dir, today_override: D2 }));
    expect(next['ok']).toBe(true);
    const surface = String(next['surface']);
    expect(surface).toContain('결제 모듈 MVP');
    expect(surface).toContain(D1);
    const data = next['data'] as Record<string, unknown>;
    const w = data['watch'] as Record<string, Record<string, unknown>>;
    expect(w['last_anchor']?.['text']).toContain('결제 모듈');
    // the mirror is a question, never a completion verdict
    expect(surface).not.toMatch(/달성|완료율|성공했|실패했/);
  });

  it('op=list reads back the day\'s anchor and captures', async () => {
    const dir = tmpArgusDir();
    await watch.handler({ argus_dir: dir, op: 'anchor', today_override: D1, text: 'ship the settlement screen today' });
    await watch.handler({ argus_dir: dir, op: 'capture', today_override: D1, kind: 'question', text: 'is the retry queue actually idempotent?', source: 'user_stated' });
    const listed = body(await watch.handler({ argus_dir: dir, op: 'list', today_override: D1 }));
    const data = listed['data'] as Record<string, unknown>;
    expect((data['anchors'] as unknown[]).length).toBe(1);
    expect((data['captures'] as unknown[]).length).toBe(1);
  });
});

describe('M1 · an anchor is a note, not a bet (§9.2-3 비산입)', () => {
  it('watch events create no decision, no stats, no track_record entry', async () => {
    const dir = tmpArgusDir();
    await watch.handler({ argus_dir: dir, op: 'anchor', today_override: D1, text: 'refactor the auth flow today' });
    await watch.handler({ argus_dir: dir, op: 'capture', today_override: D1, kind: 'claim', text: 'the session cache is already sharded', source: 'user_stated' });

    const ledger = replayLedger(dir, D2);
    expect(ledger.ids.size).toBe(0); // not a decision
    expect(ledger.contracts.size).toBe(0); // no contract entry
    expect(ledger.stats.total_sealed).toBe(0);
    expect(ledger.stats.total_settled).toBe(0);
    expect(ledger.integrity.dropped_lines).toBe(0); // well-formed, known events
    expect(ledger.integrity.skipped_unknown).toBe(0);

    // and a real seal alongside stays exactly ONE sealed
    await openDecision.handler({ argus_dir: dir, id: 'real-1', decision: 'migrate the primary db — fork', stakes: 'high', reversibility: 'one_way_door', status_quo: 'stay' });
    await seal.handler({ argus_dir: dir, id: 'real-1', predicate: 'cutover downtime stays under 5 minutes', check_by: '2027-01-01', predicate_owner: 'user' });
    const after = replayLedger(dir, D2);
    expect(after.stats.total_sealed).toBe(1);

    const track = body(await recall.handler({ argus_dir: dir, view: 'track_record' }));
    const t = JSON.stringify(track['data']);
    expect(t).not.toContain('refactor the auth flow'); // anchors never surface in the record
  });
});

describe('M1 · the restraint cliff is resolved by recording, not a watch note (§9.4 재설계)', () => {
  it('a restrained open_decision records the decision quietly — no ceremony, no watch-note exit', async () => {
    const dir = tmpArgusDir();
    const res = body(await openDecision.handler({
      argus_dir: dir, id: 'flat-1', decision: 'tabs or spaces for this new file',
      stakes: 'trivial', reversibility: 'easily_reversible', status_quo: 'keep current style',
    }));
    expect((res['over_fire_gate'] as Record<string, unknown>)['fired']).toBe(false);
    // 기록과 의식 분리: the cliff is gone because the decision is KEPT regardless
    // of stakes — no separate watch-note exit is needed (the record already exists).
    expect((res['data'] as Record<string, unknown>)['harvest_written']).toBe(true);
    expect(res['next_actions']).not.toContain('argus_watch');
    expect(res['next_actions']).not.toContain('argus_seal');
    expect(res['next_actions']).toContain('leave_as_is');
  });
});

describe('M1 · capture provenance is never forged', () => {
  it('ai_surfaced without ai_original is refused with a recovery', async () => {
    const dir = tmpArgusDir();
    const res = await watch.handler({ argus_dir: dir, op: 'capture', today_override: D1, kind: 'claim', text: 'users want SSO first', source: 'ai_surfaced' });
    expect(isError(res)).toBe(true);
    expect(body(res)['error_code']).toBe('PROVENANCE_REQUIRED');
  });
});

describe('M1 · surface vocabulary guard (해석 어휘 — 공정 3 상환 + watch)', () => {
  const FORBIDDEN = /권장|권해|추천|하는 게 좋|벌써 |놓치지 마|잘했|훌륭|달성률|연속 기록/;

  it('watch + mirror + recheck surfaces carry no directive/praise vocabulary (ko & en)', () => {
    for (const locale of ['ko', 'en'] as const) {
      const S = SURFACES[locale];
      const rendered = [
        S.tools.watch.anchored,
        S.tools.watch.captured('premise'),
        S.tools.watch.listed(1, 2),
        S.checkin.watch_mirror('2026-07-08', '오늘은 여기까지 간다'),
        S.tools.open_decision.watch_exit,
        S.tools.recheck.material(1, '3.5%', '4.0%', 'url'),
        S.tools.recheck.uncertain(1, 'threshold unset'),
        S.tools.recheck.unchanged(1, 'url'),
      ];
      for (const s of rendered) expect(s).not.toMatch(FORBIDDEN);
    }
  });

  it('recheck material returns the handle in the SAME vocabulary as the web T2 email', () => {
    const mcpKo = SURFACES.ko.tools.recheck.material(1, 'a', 'b', 'url');
    expect(mcpKo).toContain('다시 볼지는 당신의 몫');
    // cross-surface pin: the web T2 builder uses the same words (어휘 1벌).
    const webPath = path.resolve(process.cwd(), '../src/lib/companion-brief.ts');
    if (fs.existsSync(webPath)) {
      expect(fs.readFileSync(webPath, 'utf8')).toContain('다시 볼지는 당신의 몫');
    }
  });

  it('does not teach new clients the hidden daily-capture ritual', () => {
    expect(SERVER_INSTRUCTIONS).not.toContain('argus_watch');
    expect(SERVER_INSTRUCTIONS).not.toContain('volunteer captures');
    expect(SERVER_INSTRUCTIONS).toContain('argus_check_in');
  });
});
