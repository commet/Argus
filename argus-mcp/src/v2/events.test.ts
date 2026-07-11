/**
 * v2 이벤트 스키마 테스트 — 세 가지를 지킨다:
 *
 *  1. 스펙-코드 drift 가드: 정본 II-A의 이벤트 인벤토리와 이 union의 이름
 *     집합이 어긋나면 CI red. "문서 따로 코드 따로"를 구조적으로 금지한다
 *     (리포 밖에서 실행되는 published 패키지에서는 스펙 파일이 없으므로 skip —
 *     정직한 skip이지 조용한 통과가 아니다: 로그로 남긴다).
 *  2. exhaustive 샘플: 모든 이벤트 이름마다 유효 샘플이 파싱된다 — 새 이벤트를
 *     union에 추가하고 샘플을 안 만들면 여기서 죽는다.
 *  3. 루드 거절: 미지 이벤트·미지 키·출처 없는 사용자-소유 필드·등급 사칭
 *     (byte_verified without evidence)·깨진 byte 범위는 전부 명시 거절.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ArgusEventSchema, EVENT_NAMES } from './events.js';

const here = path.dirname(fileURLToPath(import.meta.url));

// ── 1. 스펙 drift 가드 ────────────────────────────────────

/** 정본 II-A 인벤토리 파서: 백틱 블록의 `a · b · c(…) · d|e|f` 표기를 이름
 *  목록으로 편다. 파서가 스펙 문구에 결합되는 건 의도다 — 인벤토리 표기를
 *  바꾸면 이 테스트가 같은 커밋에서 갱신을 강제한다. */
function specInventory(): string[] | null {
  const specPath = path.resolve(here, '..', '..', '..', 'docs', 'ARGUS-MCP-V2-SPEC.md');
  if (!fs.existsSync(specPath)) return null; // published 패키지 밖 실행 등
  const md = fs.readFileSync(specPath, 'utf8');
  const m = md.match(/이벤트 전수 인벤토리[^`]*`([^`]+)`/);
  if (!m) throw new Error('스펙에서 이벤트 인벤토리 블록을 찾지 못함 — II-A 표기가 바뀌었나?');
  const names: string[] = [];
  for (const item of m[1].split('·')) {
    const cleaned = item.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
    if (!cleaned) continue;
    if (cleaned.includes('|')) {
      // "bearing_set|updated|arrived|abandoned" → 접두사 전개
      const parts = cleaned.split('|').map((s) => s.trim());
      const prefix = parts[0].slice(0, parts[0].lastIndexOf('_') + 1);
      names.push(parts[0], ...parts.slice(1).map((s) => (s.includes('_') ? s : prefix + s)));
    } else {
      names.push(cleaned);
    }
  }
  return names;
}

describe('spec II-A inventory ↔ code union drift guard', () => {
  const inv = specInventory();
  if (inv === null) {
    it.skip('spec file not present (published package?) — drift guard skipped, NOT passed', () => {});
  } else {
    it('every spec event has a schema, every schema is in the spec', () => {
      expect([...EVENT_NAMES].sort()).toEqual([...inv].sort());
    });
  }
});

// ── 2. exhaustive 샘플 ────────────────────────────────────

const envelope = {
  event_id: '01JZXK5N8Q2W4E6R8T0Y2Z4A6B',
  v: 2 as const,
  producer_version: '2.0.0-p1',
  repository_id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  workspace_id: '9b2fd3a1-6c7e-4a2b-8d1f-2e3a4b5c6d7e',
  session_id: 'f1c70000-ko00-4000-8000-000000000001',
  occurred_at: '2026-07-11T10:30:00.000Z',
  logical_date: '2026-07-11',
  tz: 'Asia/Seoul',
  idempotency_key: 'seal:v2-rebuild-schedule:1',
};

const user = <T>(value: T) => ({ value, provenance: 'elicited_user' as const });
const ai = <T>(value: T) => ({ value, provenance: 'ai_surfaced' as const });

const evidence = {
  host_schema_version: 'claude-code-2.1.207',
  source_ref: 'session-f1c7.jsonl',
  source_prefix_length: 2048,
  source_prefix_sha256: 'a'.repeat(64),
  role: 'user' as const,
  quote_byte_start: 1024,
  quote_byte_end: 1100,
  raw_quote: '세션 저장은 postgres로 가기로 했다',
  raw_quote_sha256: 'b'.repeat(64),
  normalization_version: 'norm-1',
};

/** 이벤트 이름 → 유효 payload. EVENT_NAMES 전수를 강제하므로, union에 이벤트를
 *  추가하고 여기 샘플을 빠뜨리면 exhaustive 테스트가 죽는다. */
const SAMPLES: Record<string, Record<string, unknown>> = {
  harvest: { decision_id: 'q3-cutover', text: user('세션 저장은 postgres로 간다') },
  seal: { decision_id: 'q3-cutover', predicate: user('cutover downtime < 5 min'), check_by: user('2026-08-01'),
    basis: 'judgment', human_judgment: user('이건 내 판단이다') },
  amend: { decision_id: 'q3-cutover', check_by: user('2026-08-15') },
  dismiss: { decision_id: 'q3-cutover', reason: 'superseded' },
  settle: { decision_id: 'q3-cutover', outcome: user('held' as const), note: 'downtime 3m 40s' },
  snooze: { decision_id: 'q3-cutover', until: '2026-08-03' },
  premise_add: { premise_id: 'p-utc-ttl', decision_id: 'q3-cutover', kind: 'premise',
    text: user('TTL 계산은 UTC 기준이어야 한다'), load_bearing: true, recheck_cadence_days: 14 },
  premise_amend: { premise_id: 'p-utc-ttl', recheck_cadence_days: 30 },
  premise_recheck: { premise_id: 'p-utc-ttl', result: 'holds' },
  premise_resolve: { premise_id: 'p-utc-ttl', resolution: user('마이그레이션으로 무관해짐') },
  candidate_created: { candidate_id: 'c-0001', kind: 'decision', quote: '세션 저장은 postgres로 가기로 했다',
    quote_speaker: 'user', verification: 'byte_verified', evidence, source: 'harvest_sweep' },
  candidate_surfaced: { candidate_id: 'c-0001', surface: 'brief' },
  candidate_action: { candidate_id: 'c-0001', action: 'promote',
    promoted_to: { kind: 'decision', id: 'q3-cutover' } },
  bearing_set: { bearing_id: 'b-0711', heading: user('오늘은 세션 스토어 마이그레이션까지'),
    remaining: [user('마이그레이션 초안'), ai('롤백 스크립트')] },
  bearing_updated: { bearing_id: 'b-0711', remaining: [user('롤백 스크립트')] },
  bearing_arrived: { bearing_id: 'b-0711', note: '도착' },
  bearing_abandoned: { bearing_id: 'b-0711' },
  waypoint: { waypoint_id: 'w-0001', decision_id: 'q3-cutover',
    git_common_dir: '/home/dev/acme-api/.git', sha: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678', branch: 'feat/session-store' },
  gate_result: { gate: 'capture', fired: false, reason: 'flat utterance' },
  sync_pending: { source_event_id: '01JZXK5N8Q2W4E6R8T0Y2Z4A6B' },
  sync_attempted: { source_event_id: '01JZXK5N8Q2W4E6R8T0Y2Z4A6B', attempt: 1,
    next_retry_at: '2026-07-11T11:00:00Z', last_error: 'ECONNRESET' },
  sync_succeeded: { source_event_id: '01JZXK5N8Q2W4E6R8T0Y2Z4A6B' },
  sync_abandoned: { source_event_id: '01JZXK5N8Q2W4E6R8T0Y2Z4A6B', reason: 'gave up after 5 attempts' },
};

describe('exhaustive valid samples', () => {
  it('has a sample for every event in the union (and no orphan samples)', () => {
    expect(Object.keys(SAMPLES).sort()).toEqual([...EVENT_NAMES].sort());
  });

  for (const name of EVENT_NAMES) {
    it(`parses a valid ${name}`, () => {
      const r = ArgusEventSchema.safeParse({ ...envelope, event: name, ...SAMPLES[name] });
      if (!r.success) throw new Error(JSON.stringify(r.error.issues, null, 2));
    });
  }
});

// ── 3. 루드 거절 ──────────────────────────────────────────

describe('loud rejections (LLM-glue invariant: broken wires must turn red)', () => {
  it('rejects an unknown event name', () => {
    expect(ArgusEventSchema.safeParse({ ...envelope, event: 'totally_new', decision_id: 'x' }).success).toBe(false);
  });

  it('rejects unknown extra keys (strict envelope — no silent field drops)', () => {
    expect(ArgusEventSchema.safeParse({
      ...envelope, event: 'dismiss', decision_id: 'q3-cutover', extra_field: 'oops',
    }).success).toBe(false);
  });

  it('rejects a user-ownable field without provenance (bare string predicate)', () => {
    expect(ArgusEventSchema.safeParse({
      ...envelope, event: 'seal', decision_id: 'd', predicate: 'cutover downtime < 5 min', check_by: user('2026-08-01'),
    }).success).toBe(false);
  });

  it('rejects an invalid provenance vocabulary word', () => {
    expect(ArgusEventSchema.safeParse({
      ...envelope, event: 'harvest', decision_id: 'd',
      text: { value: 'x', provenance: 'user' }, // v1 어휘 — v2에서는 4계층만
    }).success).toBe(false);
  });

  it('rejects byte_verified without an evidence pointer (등급 사칭 금지)', () => {
    const { evidence: _drop, ...rest } = SAMPLES['candidate_created'] as { evidence: unknown } & Record<string, unknown>;
    expect(ArgusEventSchema.safeParse({ ...envelope, event: 'candidate_created', ...rest }).success).toBe(false);
  });

  it('rejects an evidence pointer whose prefix does not cover the quote', () => {
    const bad = { ...evidence, source_prefix_length: 1050 }; // < quote_byte_end 1100
    expect(ArgusEventSchema.safeParse({
      ...envelope, event: 'candidate_created', ...SAMPLES['candidate_created'], evidence: bad,
    }).success).toBe(false);
  });

  it('rejects candidate snooze without snooze_until and promote without promoted_to', () => {
    expect(ArgusEventSchema.safeParse({
      ...envelope, event: 'candidate_action', candidate_id: 'c-1', action: 'snooze',
    }).success).toBe(false);
    expect(ArgusEventSchema.safeParse({
      ...envelope, event: 'candidate_action', candidate_id: 'c-1', action: 'promote',
    }).success).toBe(false);
  });

  it('rejects an empty amend (must change at least one field)', () => {
    expect(ArgusEventSchema.safeParse({ ...envelope, event: 'amend', decision_id: 'd' }).success).toBe(false);
  });

  it('rejects a settle outcome outside the closed enum', () => {
    expect(ArgusEventSchema.safeParse({
      ...envelope, event: 'settle', decision_id: 'd', outcome: user('great_success'),
    }).success).toBe(false);
  });

  it('rejects a v1-style envelope (v:1) — 과거 버전은 버전별 리더가 읽는다, 이 스키마가 아니라', () => {
    expect(ArgusEventSchema.safeParse({
      ...envelope, v: 1, event: 'dismiss', decision_id: 'd',
    }).success).toBe(false);
  });
});
