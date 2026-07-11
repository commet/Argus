/**
 * R4-A property 테스트 2종 — 예시가 아니라 **성질**을 고정한다.
 *
 *  P1 (재시도 멱등의 성질): 임의의 유효 이벤트에 대해, envelope 필드만 바뀐
 *     재시도(다른 event_id·시각·세션·날짜·worktree)는 항상 duplicate다 —
 *     절대 IDEMPOTENCY_CONFLICT가 아니다. (근본 수리 3의 영구 고정: 이 성질이
 *     깨지는 payloadHash 변경은 여기서 죽는다.)
 *
 *  P2 (provenance 불가침의 성질): 사용자-소유 가능 필드는 출처 없이 스키마를
 *     통과할 수 없고, 4계층 밖의 출처 어휘도 통과할 수 없다 — 어떤 값이든.
 *
 * 난수: 시드 고정 PRNG(mulberry32) — 실패가 재현 가능해야 property 테스트다.
 * (Math.random은 실패를 복원 불가능하게 만든다.)
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ArgusEventSchema } from './events.js';
import { registerRepository } from './ledger.js';
import { appendEventGuarded } from './reducer.js';
import { ulid } from './bridge.js';

// ── 시드 고정 PRNG ────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 20260711; // 착공일 — 실패 재현용 고정 시드
const rnd = mulberry32(SEED);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
const int = (max: number) => Math.floor(rnd() * max);

const KO_WORDS = ['세션', '저장은', 'postgres로', '가기로', '했다', '전제', '현실이', '정산한다', '원장', '봉인'];
const EN_WORDS = ['cutover', 'downtime', 'under', 'five', 'minutes', 'queue', 'sqlite', 'holds', 'ledger', 'seals'];
function sentence(minWords = 3): string {
  const words = rnd() < 0.5 ? KO_WORDS : EN_WORDS;
  return Array.from({ length: minWords + int(6) }, () => pick(words)).join(' ');
}
const dateStr = () => `20${27 + int(3)}-${String(1 + int(12)).padStart(2, '0')}-${String(1 + int(28)).padStart(2, '0')}`;
const PROVENANCES = ['elicited_user', 'direct_user_command', 'host_reported', 'ai_surfaced'] as const;
const prov = () => ({ value: sentence(), provenance: pick(PROVENANCES) });

function envelopeFor(repositoryId: string, i: number) {
  return {
    event_id: ulid(), v: 2 as const, producer_version: '2.0.0-prop',
    repository_id: repositoryId, workspace_id: '9b2fd3a1-6c7e-4a2b-8d1f-2e3a4b5c6d7e',
    session_id: `s-${i}`, occurred_at: '2026-07-11T10:00:00.000Z', logical_date: '2026-07-11',
    tz: 'Asia/Seoul', idempotency_key: `prop:${i}:${ulid()}`,
  };
}

/** 자립형(선행 상태 불요) 이벤트 생성기 — 전이 가드에 걸리지 않는 것만. */
function randomStandaloneEvent(repositoryId: string, i: number): Record<string, unknown> {
  const base = envelopeFor(repositoryId, i);
  switch (int(4)) {
    case 0:
      return { ...base, event: 'harvest', decision_id: `d-${i}`, text: prov() };
    case 1:
      return { ...base, event: 'seal', decision_id: `d-${i}`, predicate: { ...prov(), value: sentence(4) }, check_by: { value: dateStr(), provenance: pick(PROVENANCES) } };
    case 2:
      return { ...base, event: 'premise_add', premise_id: `p-${i}`, kind: pick(['premise', 'fact', 'question'] as const), text: prov(), load_bearing: rnd() < 0.5 };
    default:
      return { ...base, event: 'gate_result', gate: pick(['capture', 'overfire'] as const), fired: rnd() < 0.5, reason: sentence(2) };
  }
}

describe('P1 property — envelope-만 변조된 재시도는 항상 duplicate (절대 CONFLICT 아님)', () => {
  it('holds across 60 random events (seed 고정 — 실패는 재현된다)', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-prop-home-'));
    const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-prop-repo-'));
    fs.mkdirSync(path.join(repoDir, '.git'), { recursive: true });
    try {
      const repoId = registerRepository(home, path.join(repoDir, '.git'));
      for (let i = 0; i < 60; i++) {
        const ev = randomStandaloneEvent(repoId, i);
        const first = appendEventGuarded(home, repoId, ev);
        expect(first.appended, `iter ${i}: first append`).toBe(true);
        // 재시도: 도메인 내용은 그대로, envelope만 전부 다르게.
        const retry = appendEventGuarded(home, repoId, {
          ...ev,
          event_id: ulid(),
          occurred_at: '2026-08-01T23:59:59.000Z',
          session_id: `retry-session-${i}`,
          logical_date: '2026-08-01',
          tz: 'America/New_York',
          workspace_id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
          producer_version: '9.9.9',
        });
        expect(retry.appended, `iter ${i}: retry must be duplicate, event=${String(ev['event'])}`).toBe(false);
      }
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
      fs.rmSync(repoDir, { recursive: true, force: true });
    }
  });
});

describe('P2 property — 사용자-소유 필드는 출처 없이 존재할 수 없다', () => {
  /** (이벤트 샘플 생성, 벗겨낼 provenanced 필드 경로) 쌍 — 스키마의 모든
   *  provenanced 지점을 커버한다. 새 provenanced 필드를 추가하면 여기도
   *  추가해야 P2가 그 필드를 지킨다. */
  const SPOTS: Array<{ name: string; make: () => Record<string, unknown>; strip: (e: Record<string, unknown>) => void }> = [
    { name: 'harvest.text', make: () => ({ ...envelopeFor('3f2504e0-4f89-41d3-9a0c-0305e82c3301', 0), event: 'harvest', decision_id: 'd', text: prov() }), strip: (e) => { e['text'] = (e['text'] as { value: string }).value; } },
    { name: 'seal.predicate', make: () => ({ ...envelopeFor('3f2504e0-4f89-41d3-9a0c-0305e82c3301', 1), event: 'seal', decision_id: 'd', predicate: { ...prov(), value: sentence(4) }, check_by: { value: dateStr(), provenance: pick(PROVENANCES) } }), strip: (e) => { e['predicate'] = 'bare string predicate'; } },
    { name: 'seal.check_by', make: () => ({ ...envelopeFor('3f2504e0-4f89-41d3-9a0c-0305e82c3301', 2), event: 'seal', decision_id: 'd', predicate: { ...prov(), value: sentence(4) }, check_by: { value: '2027-01-01', provenance: 'elicited_user' } }), strip: (e) => { e['check_by'] = '2027-01-01'; } },
    { name: 'settle.outcome', make: () => ({ ...envelopeFor('3f2504e0-4f89-41d3-9a0c-0305e82c3301', 3), event: 'settle', decision_id: 'd', outcome: { value: 'held', provenance: 'elicited_user' } }), strip: (e) => { e['outcome'] = 'held'; } },
    { name: 'premise_add.text', make: () => ({ ...envelopeFor('3f2504e0-4f89-41d3-9a0c-0305e82c3301', 4), event: 'premise_add', premise_id: 'p', kind: 'premise', text: prov() }), strip: (e) => { e['text'] = 'bare'; } },
    { name: 'premise_resolve.resolution', make: () => ({ ...envelopeFor('3f2504e0-4f89-41d3-9a0c-0305e82c3301', 5), event: 'premise_resolve', premise_id: 'p', resolution: prov() }), strip: (e) => { e['resolution'] = 'bare'; } },
    { name: 'bearing_set.heading', make: () => ({ ...envelopeFor('3f2504e0-4f89-41d3-9a0c-0305e82c3301', 6), event: 'bearing_set', bearing_id: 'b', heading: prov(), remaining: [prov()] }), strip: (e) => { e['heading'] = 'bare'; } },
    { name: 'bearing_set.remaining[0]', make: () => ({ ...envelopeFor('3f2504e0-4f89-41d3-9a0c-0305e82c3301', 7), event: 'bearing_set', bearing_id: 'b', heading: prov(), remaining: [prov()] }), strip: (e) => { e['remaining'] = ['bare string item']; } },
  ];

  for (const spot of SPOTS) {
    it(`${spot.name}: 값만 남기고 출처를 벗기면 거절된다`, () => {
      const valid = spot.make();
      expect(ArgusEventSchema.safeParse(valid).success, 'sanity: 원본은 유효').toBe(true);
      spot.strip(valid);
      expect(ArgusEventSchema.safeParse(valid).success).toBe(false);
    });
  }

  it('4계층 밖의 출처 어휘는 어떤 랜덤 값이어도 거절된다 (20 iterations)', () => {
    const BAD = ['user', 'model', 'system', 'assistant', 'verified', 'human', '', 'ELICITED_USER'];
    for (let i = 0; i < 20; i++) {
      const e = {
        ...envelopeFor('3f2504e0-4f89-41d3-9a0c-0305e82c3301', 100 + i),
        event: 'harvest', decision_id: `d-${i}`,
        text: { value: sentence(), provenance: pick(BAD) },
      };
      expect(ArgusEventSchema.safeParse(e).success, `iter ${i}`).toBe(false);
    }
  });
});
