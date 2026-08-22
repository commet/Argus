import fs from 'fs';
import fsP from 'fs/promises';
import { randomUUID } from 'crypto';
import { ledgerPath, ledgerDir } from './layout.js';
import { SCHEMA_VERSION } from './spine.js';
import type { LedgerEventType } from './state-machine.js';
import { mirrorV1Events, type MirrorHints, type MirrorOutcome } from '../v2/mirror.js';

/**
 * The one internal writer for the append-only ledger. Tools call this; it is
 * never exposed as an MCP tool. True atomic append via O_APPEND, each event
 * stamped with schema version and an ISO timestamp.
 */

export interface LedgerEventInput {
  id: string;
  /** watch_anchor / watch_capture are 당직-loop events (BLUEPRINT §9): outside
   *  the decision state machine, so they bypass guardTransition by design. */
  event: LedgerEventType | 'gate_input' | 'watch_anchor' | 'watch_capture'
    /** 결정 장부(기획 v5)의 사건 셋. 옛 예측 상태기계 밖이라 guardTransition 을
     *  거치지 않는다 — `gate_input`·`watch_*` 와 같은 자리다. 접는 것은
     *  `src/dec/fold.ts` 이고, 옛 replay 는 알면서 건너뛴다. */
    | 'dec_signed' | 'dec_amended' | 'dec_repealed' | 'dec_fired' | 'dec_misfire' | 'dec_reviewed'
    | 'dec_paused';
  predicate?: string;
  check_by?: string;
  decision?: string;
  outcome?: string;
  basis?: string;
  /** Honest provenance of the sealed line, recorded ON the append-only event so
   *  it survives every downstream reader — including the webapp bridge, which
   *  previously had no way to tell an Argus draft from a line the user dictated
   *  and therefore displayed both as the user's own. Absent on pre-2026-07 rows;
   *  readers must treat absence as unknown, never as 'user'. */
  predicate_owner?: 'user' | 'ai_surfaced';
  dismiss_reason?: string;
  /** gate audit (over-fire inputs) — meta event, ignored by replay (N3 counts unknowns; gate_input is known-meta) */
  gate?: Record<string, unknown>;
  /** 결정 장부의 짐 — 한 칸에 중첩해 싣는다(`materiality_rule` 과 같은 선례).
   *  스키마를 넓히지 않으므로 옛 판이 읽어도 깨지지 않는다. 모양은
   *  `src/dec/types.ts` 의 DecPayload. */
  dec?: unknown;
  // ── living premises (plan v5 §6.1) ──
  premise_id?: string;
  ordinal?: number;
  kind?: string;
  text?: string;
  external?: boolean;
  load_bearing?: boolean;
  monitoring_enabled?: boolean;
  source?: string;
  ai_original?: string;
  /** The user's own words a premise rests on (premise_add) — persisted so the
   *  terminal can show its lineage the way the browser card does. */
  anchor_quote?: string;
  /** 이 전제가 틀리면 결정에서 무엇이 달라지는지 한 줄 (premise_add).
   *  공개 스키마가 이것을 받아 "나중에 이걸 다시 확인한다"고 약속해 놓고
   *  내부에 칸이 없어 버리고 있었다 — 재확인 순간이 대조할 것을 갖게 한다. */
  if_false_changes?: string;
  /** 확인창 직접 입력 표식 (premise_add, 입력 깊이 사이클 3): 이 문장이 모델을
   *  거치지 않고 elicit 채널로 도착했다는 사실 — 저자성이 구조로 확보된 경로. */
  elicited?: boolean;
  /** M2 materiality rule (jsonb-nested on premise_add) — no schema migration. */
  materiality_rule?: unknown;
  /** M1 re-check cadence in days (jsonb-nested on premise_add/amend) — no migration. */
  recheck_cadence_days?: number;
  /** M3 open_question reconsider cadence in days (jsonb-nested on premise_add/amend/
   *  reconsider) — no migration. */
  reponder_cadence_days?: number;
  /** M3 — the logical `today` (YYYY-MM-DD) the reconsider clock anchors from, on
   *  premise_add (open_question) and premise_reconsider. Distinct from the wall-
   *  clock event `ts` so the reconsider timeline is deterministic (honors
   *  today_override) instead of drifting with real time. */
  anchor_date?: string;
  // ── cognitive capture on harvest (입력 깊이 사이클 1) ──
  question?: string;
  values?: string[];
  rejected_alternative?: { alternative: string; reason: string };
  load_bearing_assumption?: string;
  confidence?: string;
  /** 귀환이 남기는 규칙 한 줄 (settle) — 사용자가 확인창에 직접 타이핑한
   *  문장 그대로. CONTEXT.md 의 `Lesson` 이고 새 어휘가 아니다: 웹은 이미
   *  ContractSettlement.lesson 으로 갖고 있었고 MCP 쪽만 비어 있었다.
   *
   *  WHY IT RIDES ON `settle` INSTEAD OF ITS OWN EVENT. settled 는 종결
   *  상태이고 상태기계가 그 뒤의 append 를 전부 막는다(거울 조항: 닫힌 결정을
   *  다시 열지 않는다). 그래서 규칙은 정산 **직전에** 묻고 같은 이벤트에
   *  실린다 — 새 이벤트 이름 0, 종결 규율 무손상. 창을 거절·무응답·빈 제출로
   *  지나가면 정산은 그대로 저장된다(창이 정산을 실패시킬 수 없다). */
  lesson?: string;
  /** 그 문장이 elicit 채널로 도착했다는 표식 — premise_add 의 `elicited` 와
   *  같은 의미이고, 모델이 대신 쓴 요약과 구조적으로 구분된다. */
  lesson_elicited?: boolean;
  // ── execution plan (plan_adopt / plan_check) ──
  // plan_check reuses `ordinal` (1-based step) and `note` (the user's words).
  steps?: Array<{ what: string; due?: string }>;
  open_questions?: string[];
  plan_owner?: 'user' | 'ai_surfaced';
  action?: string;
  from?: string;
  to?: string;
  note?: string;
  finding?: string;
  numeric_value?: number;
  drifted?: boolean;
  baseline_only?: boolean;
  source_detail?: string;
  /** settle-time, user-attributed broken premise (plan v5 P2) */
  broken_premise_id?: string;
  /** watch_capture: the capture's stable id. On premise_add: the capture this
   *  premise was PROMOTED from (§9.3 승격 — a reference, never a move). */
  capture_id?: string;
  ts?: string;
}

/**
 * Cross-process critical section for read-check-append sequences (§9.4 두 기기
 * 안전). The in-process dispatcher already serializes calls WITHIN one stdio
 * server; this lockfile extends that to two concurrent sessions on one dir —
 * without it, two settles could both replay 'sealed' and both append, double-
 * counting the calibration record. O_EXCL create is the atomic primitive;
 * a lock older than STALE_MS is treated as a crash leftover and stolen.
 */
const LOCK_WAIT_MS = 25;
const LOCK_TRIES = 120; // ~3s worst case before failing OPEN (availability > strictness)
// A normal critical section is milliseconds. 10 min = a zombie / reused pid, or a
// lock synced in from a now-offline machine — the only cases old enough to steal
// when we can't prove the holder is dead by pid.
const LOCK_HELD_TOO_LONG_MS = 10 * 60_000;

interface LockBody { nonce: string; pid: number; started_at: string }

function pidAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (e) { return (e as NodeJS.ErrnoException).code === 'EPERM'; } // EPERM = alive but not ours; ESRCH = dead
}

/**
 * A held lock is stealable ONLY if its holder is provably gone: the pid is dead
 * (same machine) or it has been held absurdly long. The old code stole any lock
 * older than 5s by mtime, which let a LIVE holder inside a slow critical section
 * (large ledger fsync, network FS) be robbed — two writers then both believed
 * they held the lock and both appended, double-counting the calibration record.
 */
function lockStealable(lockPath: string): boolean {
  try {
    let body: unknown = null;
    try { body = JSON.parse(fs.readFileSync(lockPath, 'utf8')); } catch { /* legacy/torn — fall to mtime */ }
    if (body && typeof body === 'object') {
      const b = body as Partial<LockBody>;
      const started = typeof b.started_at === 'string' ? Date.parse(b.started_at) : NaN;
      if (Number.isFinite(started) && Date.now() - started > LOCK_HELD_TOO_LONG_MS) return true;
      if (typeof b.pid === 'number') return !pidAlive(b.pid);
    }
    // legacy bare-pid or malformed body: fall back to a GENEROUS mtime age.
    return Date.now() - fs.statSync(lockPath).mtimeMs > LOCK_HELD_TOO_LONG_MS;
  } catch {
    return true; // vanished between attempts — retry create
  }
}

export async function withLedgerLock<T>(argusDir: string, fn: () => Promise<T>): Promise<T> {
  await fsP.mkdir(ledgerDir(argusDir), { recursive: true });
  const lockPath = ledgerPath(argusDir) + '.lock';
  const nonce = randomUUID();
  const bodyStr = JSON.stringify({ nonce, pid: process.pid, started_at: new Date().toISOString() } satisfies LockBody);
  const tmp = `${lockPath}.${nonce}.tmp`;
  let acquired = false;
  for (let i = 0; i < LOCK_TRIES && !acquired; i++) {
    try {
      // Complete the body first, then create the lock via an ATOMIC hardlink —
      // the lock file exists only ever with a full body (no empty window a racer
      // could misread as "crashed mid-write"), and EEXIST means someone holds it.
      fs.writeFileSync(tmp, bodyStr, 'utf8');
      fs.linkSync(tmp, lockPath);
      acquired = true;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST') {
        // linkSync unsupported on this FS (rare) — degrade to O_EXCL create.
        try {
          const fd = fs.openSync(lockPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY);
          fs.writeSync(fd, bodyStr, null, 'utf8'); fs.closeSync(fd); acquired = true;
        } catch { /* held — fall through to steal/wait */ }
      }
      if (!acquired) {
        if (lockStealable(lockPath)) {
          // Steal ATOMICALLY via rename — exactly one racer's rename wins; the
          // loser throws (already moved) and retries. (unlink+recreate let two
          // stealers both delete then both create — the double-steal race.)
          try { const grave = `${lockPath}.stale-${nonce}`; fs.renameSync(lockPath, grave); fs.unlinkSync(grave); }
          catch { /* lost the steal to another racer — just retry create */ }
          continue; // retry immediately
        }
        await new Promise((r) => setTimeout(r, LOCK_WAIT_MS));
      }
    } finally {
      try { fs.unlinkSync(tmp); } catch { /* linked away on success, or never created */ }
    }
  }
  // Fail OPEN if never acquired (availability > strictness — a stuck lock must
  // never brick the ledger; the steal logic bounds the wait to ~3s).
  try {
    return await fn();
  } finally {
    if (acquired) {
      // Release only our OWN lock (nonce match) — never delete a lock a later
      // holder created after ours was legitimately stolen (ABA guard).
      try { const cur = JSON.parse(fs.readFileSync(lockPath, 'utf8')) as Partial<LockBody>; if (cur.nonce === nonce) fs.unlinkSync(lockPath); }
      catch { /* gone, or not ours */ }
    }
  }
}

/**
 * Does the ledger currently end in a newline? A crash or ENOSPC mid-write leaves
 * a final line with no terminator; the next O_APPEND then writes its bytes
 * directly onto those, fusing the torn remnant with the new first event into one
 * invalid JSON line. Replay counts that as ONE dropped line — so the torn record
 * silently EATS the next event too. If that event is a `settle`, the receipt file
 * is written but the ledger settle is gone: the decision stays due forever and the
 * outcome vanishes from the calibration record, with nothing turning red.
 * Cheap to detect (read the last byte), so we heal instead of corrupting.
 */
function needsLeadingNewline(lPath: string): boolean {
  let fd: number | undefined;
  try {
    const size = fs.statSync(lPath).size;
    if (size === 0) return false;
    fd = fs.openSync(lPath, fs.constants.O_RDONLY);
    const buf = Buffer.alloc(1);
    fs.readSync(fd, buf, 0, 1, size - 1);
    return buf[0] !== 0x0a; // '\n'
  } catch {
    return false; // no file yet (or unreadable) — the append creates it
  } finally {
    if (fd !== undefined) { try { fs.closeSync(fd); } catch { /* already closed */ } }
  }
}

export async function appendLedger(
  argusDir: string,
  events: LedgerEventInput[],
  now: string,
  hints?: MirrorHints,
): Promise<{ written: number; v2_mirror: MirrorOutcome }> {
  const dir = ledgerDir(argusDir);
  await fsP.mkdir(dir, { recursive: true });
  const lPath = ledgerPath(argusDir);

  const body = events
    .map((ev) => JSON.stringify({ v: SCHEMA_VERSION, ts: ev.ts || now, ...ev }))
    .join('\n') + '\n';
  // Heal a torn tail so it can only ever cost the ONE line it tore, never the
  // next event. The torn remnant still counts as dropped_lines (disclosed), but
  // the events we are writing now survive.
  const lines = (needsLeadingNewline(lPath) ? '\n' : '') + body;
  // fsync of the file makes its CONTENTS durable, but the very first append also
  // creates the directory ENTRY — and that entry can be lost on a crash unless
  // the parent directory is itself synced. Only matters on first create.
  const isFirstCreate = !fs.existsSync(lPath);

  await new Promise<void>((resolve, reject) => {
    let fd: number | undefined;
    try {
      fd = fs.openSync(lPath, fs.constants.O_APPEND | fs.constants.O_CREAT | fs.constants.O_WRONLY);
      fs.writeSync(fd, lines, null, 'utf8');
      // The ledger is the product's only durable asset. A rename-based atomic
      // write can't be used on an append, so fsync is the one thing standing
      // between a power loss and a lost settlement.
      try { fs.fsyncSync(fd); } catch (e) {
        // fsync legitimately fails as "unsupported" on some filesystems/handles
        // (EINVAL/ENOTSUP/EOPNOTSUPP — tmpfs, pipes, certain network mounts):
        // there the write still landed, so swallow. But EIO / ENOSPC / EBADF are
        // REAL flush failures — the settlement is NOT durable. Rethrow so the
        // tool returns isError instead of a false "saved!" (fail loud, never
        // report a durability we don't have).
        const code = (e as NodeJS.ErrnoException)?.code;
        if (code !== 'EINVAL' && code !== 'ENOTSUP' && code !== 'EOPNOTSUPP') throw e;
      }
      resolve();
    } catch (e) {
      reject(e);
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
  });

  if (isFirstCreate) {
    // Persist the new file's directory entry, consistent with the file fsync above.
    let dfd: number | undefined;
    try { dfd = fs.openSync(dir, fs.constants.O_RDONLY); fs.fsyncSync(dfd); }
    catch { /* directory fsync unsupported (e.g. Windows) — best effort */ }
    finally { if (dfd !== undefined) { try { fs.closeSync(dfd); } catch { /* already closed */ } } }
  }

  // ── v2 미러 (단일 관문) — v1 쓰기가 성공한 뒤에만, 그리고 반드시 여기서.
  // 툴별 dual-write 호출을 없애 배선 누락을 구조적으로 불가능하게 만든 지점이다
  // (src/v2/mirror.ts 헤더 참조). mirrorV1Events는 절대 던지지 않지만, 만에
  // 하나를 위해 한 번 더 감싼다 — 미러가 v1 쓰기 성공을 오염하면 안 된다.
  let v2_mirror: MirrorOutcome;
  try {
    v2_mirror = mirrorV1Events(argusDir, events, now, hints);
  } catch (e) {
    v2_mirror = {
      bound: false, mirrored: 0, skipped_unmapped: [],
      errors: [], reason: `mirror crashed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  return { written: events.length, v2_mirror };
}
