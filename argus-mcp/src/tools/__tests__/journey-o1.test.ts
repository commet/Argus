import { describe, it, expect, afterEach } from 'vitest';
import { tmpArgusDir, body } from '../../test-helpers.js';
import { init } from '../init-config.js';
import { seal, resetSealSession } from '../seal.js';
import { checkIn } from '../check-in.js';
import { settle } from '../settle.js';
import { readResource } from '../../resources.js';

/**
 * §9.7 O1 exit — 설치→봉인→재시작→귀환→정산 통합 여정 (ko/en).
 *
 * The five rooms were each proven in isolation; this fixture proves the LOOP:
 * a fresh install seals a prediction, the process "restarts" (all in-memory
 * session state reset — everything the return leg knows must come from disk),
 * the return surfaces (check_in AND the passive argus://attention resource)
 * both see the due decision, and the settle pays off with the first
 * then-vs-now receipt in the user's own language. Dates are all
 * today_override-driven (deterministic on any machine, any day).
 */

const ORIG = process.env.ARGUS_DIR;
afterEach(() => {
  if (ORIG === undefined) delete process.env.ARGUS_DIR;
  else process.env.ARGUS_DIR = ORIG;
});

const T0 = '2026-01-01'; // seal day
const T1 = '2026-02-02'; // past check_by — the return day
const CHECK_BY = '2026-02-01';

async function runJourney(opts: { id: string; predicate: string; whatHappened: string }) {
  const dir = tmpArgusDir();

  // 설치 — first contact creates the home (config, dirs).
  const initialized = body(await init.handler({ argus_dir: dir }));
  expect(initialized['ok']).toBe(true);

  // 봉인 — the user's own words, locked.
  const sealed = body(await seal.handler({
    argus_dir: dir, id: opts.id, predicate: opts.predicate,
    check_by: CHECK_BY, predicate_owner: 'user', today_override: T0,
  }));
  expect((sealed['data'] as Record<string, unknown>)['status']).toBe('sealed');

  // 재시작 — wipe every in-memory session state this process accumulated;
  // from here on, the return leg may know nothing that is not on disk.
  resetSealSession();

  // 귀환 ① — the active surface: check_in reports the due decision.
  const returned = body(await checkIn.handler({ argus_dir: dir, today_override: T1 }));
  expect(returned['ok']).toBe(true);
  expect(JSON.stringify(returned)).toContain(opts.id);

  // 귀환 ② — the passive surface: argus://attention (zero-arg resource) sees
  // the SAME ledger via the env channel, exactly like a host would read it.
  process.env.ARGUS_DIR = dir;
  const attention = JSON.parse(readResource('argus://attention').contents[0]!.text) as Record<string, unknown>;
  expect(attention['unbound']).toBeUndefined();
  expect(JSON.stringify(attention['decisions'])).toContain(opts.id);

  // 정산 — reality answers; the FIRST receipt rides in the surface itself.
  const settled = body(await settle.handler({
    argus_dir: dir, id: opts.id, outcome: 'held', outcome_source: 'user_stated',
    what_happened: opts.whatHappened, today_override: T1,
  }));
  expect((settled['data'] as Record<string, unknown>)['first_receipt']).toBe(true);
  expect((settled['data'] as Record<string, unknown>)['ai_verdict']).toBeNull();

  // 영수증이 자원으로도 열린다 (재방문 손잡이).
  const receipt = JSON.parse(readResource(`argus://receipts/${opts.id}`).contents[0]!.text) as Record<string, unknown>;
  expect(receipt['ai_verdict']).toBeNull();
  expect(receipt['outcome']).toBe('held');

  return String(settled['surface']);
}

describe('O1 통합 여정 — 설치→봉인→재시작→귀환→정산', () => {
  it('en: the whole loop closes and the first receipt speaks English (then vs now on one screen)', async () => {
    const surface = await runJourney({
      id: 'journey-en',
      predicate: 'the report ships before the deadline',
      whatHappened: 'it shipped two days early',
    });
    expect(surface).toContain('What I predicted');
    expect(surface).toContain('it shipped two days early');
    expect(surface).toContain('AI VERDICT');
    expect(surface).toContain('NONE');
  });

  it('ko: 같은 루프가 한국어로 닫힌다 (내가 예측한 것 · 실제 결과 · AI 판정 없음)', async () => {
    const surface = await runJourney({
      id: 'journey-ko',
      predicate: '보고서가 마감 전에 발송된다',
      whatHappened: '이틀 먼저 발송됐다',
    });
    expect(surface).toContain('내가 예측한 것');
    expect(surface).toContain('이틀 먼저 발송됐다');
    expect(surface).toContain('NONE');
  });
});
