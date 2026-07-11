/**
 * v2 내구 원장 — 집(II-D)과 쓰기 규율(II-E).
 *
 * 집 (정본 규칙 20 · II-D):
 *   ~/.argus/projects/{repository_id}/ledger.jsonl   ← 원장은 여기 하나뿐
 *   ~/.argus/registry.json                            ← git_common_dir 실경로 → repository_id
 *   worktree의 .argus/에는 projection만 산다 — 여기서는 다루지 않는다(P2).
 *   임시 worktree를 지워도 결정 기록이 죽지 않고, 어느 worktree에서 봉인해도
 *   common dir이 같으면 같은 원장에 닿는다.
 *
 * 쓰기 규율 (정본 규칙 11 · II-E):
 *   락 범위는 `lock → replay → transition guard → append/fsync → unlock` **만**.
 *   projection·영수증·.ics·sync는 락 밖(호출자 책임). 락 획득 실패는 조용한
 *   진행이 아니라 LEDGER_BUSY 명시 거절이다 — v1의 fail-open("Lock or no lock,
 *   the work proceeds")을 의도적으로 뒤집은 것. stale 락은 pid 생존 확인 후에만
 *   탈취한다.
 *
 * 읽기 규율 (II-E 마이그레이션 조항):
 *   미지 이벤트는 skipped_unknown, 파손 줄은 dropped_corrupt — **다른 사건이므로
 *   분리 계상**한다. 조용히 삼키는 카운터 없는 skip은 금지.
 *
 * 정본 순서는 JSONL append 순서다 — event_id(ULID)로 정렬하지 말 것.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ArgusEventSchema, EVENT_NAMES, type ArgusEvent } from './events.js';

// ── 집: 경로 ──────────────────────────────────────────────

/** ~/.argus (테스트·특수 환경은 ARGUS_HOME으로 재지정). */
export function argusHome(env: NodeJS.ProcessEnv = process.env): string {
  return env['ARGUS_HOME'] && env['ARGUS_HOME'].trim() !== ''
    ? env['ARGUS_HOME']
    : path.join(os.homedir(), '.argus');
}

export function projectDir(home: string, repositoryId: string): string {
  return path.join(home, 'projects', repositoryId);
}

export function ledgerPath(home: string, repositoryId: string): string {
  return path.join(projectDir(home, repositoryId), 'ledger.jsonl');
}

export function registryPath(home: string): string {
  return path.join(home, 'registry.json');
}

// ── 집: registry (발견 메커니즘, II-D) ─────────────────────

export interface Registry {
  version: 1;
  /** git_common_dir 실경로 → repository_id(UUID). */
  repositories: Record<string, string>;
}

const EMPTY_REGISTRY: Registry = { version: 1, repositories: {} };

export function readRegistry(home: string): Registry {
  let raw: string;
  try {
    raw = fs.readFileSync(registryPath(home), 'utf8');
  } catch {
    return { ...EMPTY_REGISTRY, repositories: {} }; // 부재 = 빈 registry (에러 아님)
  }
  // 파손된 registry는 조용히 빈 것으로 갈음하지 않는다 — 원장 발견이 걸린 파일이다.
  const parsed = JSON.parse(raw) as Registry;
  if (parsed.version !== 1 || typeof parsed.repositories !== 'object' || parsed.repositories === null) {
    throw new Error(`registry.json has an unexpected shape (version=${String(parsed.version)}) — refusing to guess`);
  }
  return parsed;
}

/** registry 쓰기 락 — read-modify-write의 lost update 방지 (적대 리뷰 F8:
 *  두 세션이 동시에 다른 리포를 init하면 한 매핑이 조용히 증발하고, 그 리포는
 *  재init에서 새 UUID를 받아 기존 내구 원장이 고아가 된다). 동기 API라
 *  Atomics.wait로 잠깐 기다린다 — init은 드문 동사라 경합은 ms 단위다. */
function withRegistryLock<T>(home: string, fn: () => T): T {
  const lock = registryPath(home) + '.lock';
  fs.mkdirSync(home, { recursive: true });
  const waiter = new Int32Array(new SharedArrayBuffer(4));
  for (let i = 0; i < 200; i++) {
    try {
      fs.writeFileSync(lock, String(process.pid), { flag: 'wx' });
      try {
        return fn();
      } finally {
        try { fs.unlinkSync(lock); } catch { /* 이미 정리됨 */ }
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      try {
        if (Date.now() - fs.statSync(lock).mtimeMs > 5000) { fs.unlinkSync(lock); continue; } // crash 잔재
      } catch { continue; }
      Atomics.wait(waiter, 0, 0, 10); // 10ms 동기 대기
    }
  }
  throw new Error('REGISTRY_BUSY: could not acquire registry lock — another init is stuck');
}

/** init의 동사: common dir을 실경로화해 등록한다. 이미 같은 매핑이면 no-op,
 *  같은 경로가 다른 repository_id를 가리키면 명시 거절(조용한 재바인딩 금지). */
export function registerRepository(home: string, gitCommonDir: string, repositoryId?: string): string {
  const real = fs.realpathSync(gitCommonDir);
  return withRegistryLock(home, () => registerLocked(home, real, repositoryId));
}

function registerLocked(home: string, real: string, repositoryId?: string): string {
  const reg = readRegistry(home);
  const existing = reg.repositories[real];
  if (existing) {
    if (repositoryId && repositoryId !== existing) {
      throw new Error(`REGISTRY_CONFLICT: ${real} is already bound to ${existing}`);
    }
    return existing;
  }
  const id = repositoryId ?? randomUUID(); // II-D: 실경로 해시 금지 — init 시 생성 UUID
  reg.repositories[real] = id;
  fs.mkdirSync(home, { recursive: true });
  // tmp+rename — registry가 torn write로 반쯤 죽으면 모든 원장 발견이 죽는다.
  const tmp = registryPath(home) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(reg, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, registryPath(home));
  fs.mkdirSync(projectDir(home, id), { recursive: true });
  return id;
}

/** 발견: 매핑이 없으면 null — 자동 생성하지 않는다 (II-D: "매핑 부재 시 init
 *  안내(자동 생성 금지 — 명시적 바인딩)"). 호출자가 init을 안내할 것. */
export function lookupRepository(home: string, gitCommonDir: string): string | null {
  let real: string;
  try {
    real = fs.realpathSync(gitCommonDir);
  } catch {
    return null; // 경로 자체가 없으면 발견도 없다
  }
  return readRegistry(home).repositories[real] ?? null;
}

// ── 쓰기 규율: 락 ─────────────────────────────────────────

export class LedgerBusyError extends Error {
  readonly code = 'LEDGER_BUSY';
  constructor(holder: { pid: number; started_at: string }) {
    super(
      `LEDGER_BUSY: another process (pid ${holder.pid}, since ${holder.started_at}) holds the write lock — retry after it finishes`,
    );
  }
}

interface LockFileBody {
  nonce: string;
  pid: number;
  started_at: string;
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM = 살아있지만 남의 것. ESRCH = 죽었다. 그 외는 보수적으로 "살아있다"로.
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function lockFilePath(home: string, repositoryId: string): string {
  return ledgerPath(home, repositoryId) + '.lock';
}

/** 락 획득 — 두 경합 결함(적대 리뷰 F3)을 봉인한 형태:
 *
 *  1. **빈 본문 창 제거**: 'wx' open 후 write는 두 걸음이라, 그 사이를 본
 *     경쟁자가 "쓰다 죽은 흔적"으로 오판해 산 락을 탈취할 수 있었다.
 *     수리: 본문을 임시 파일에 완성한 뒤 linkSync로 원자 생성 — 락 파일은
 *     존재하는 순간부터 항상 완전한 본문을 가진다.
 *  2. **이중 탈취 경쟁 제거**: 죽은 락을 두 프로세스가 동시에 발견하면
 *     unlink 경쟁으로 A의 새 락을 B가 지울 수 있었다. 수리: 탈취는
 *     rename(원자 — 정확히 한 명만 성공)으로만.
 *
 *  pid 재사용 방어: 보유자 pid가 살아 있어도 started_at이 10분을 넘긴 락은
 *  탈취 대상이다 — 정상 append는 ms 단위이므로 10분 보유 = 좀비/재사용 pid.
 *  반환된 release는 자기 nonce일 때만 지운다(ABA 방지). */
const LOCK_HELD_TOO_LONG_MS = 10 * 60_000;

export function acquireLock(home: string, repositoryId: string): { release: () => void } {
  const lockPath = lockFilePath(home, repositoryId);
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  const body: LockFileBody = { nonce: randomUUID(), pid: process.pid, started_at: new Date().toISOString() };
  const tmp = `${lockPath}.${body.nonce}.tmp`;

  for (let attempt = 0; attempt < 4; attempt++) {
    // 본문 완성본을 먼저 — 락 파일에 빈 상태가 존재할 수 없게.
    fs.writeFileSync(tmp, JSON.stringify(body), 'utf8');
    try {
      fs.linkSync(tmp, lockPath); // 원자 생성 (EEXIST면 선점자 존재)
      fs.unlinkSync(tmp);
      return {
        release: () => {
          try {
            const cur = JSON.parse(fs.readFileSync(lockPath, 'utf8')) as LockFileBody;
            if (cur.nonce === body.nonce) fs.unlinkSync(lockPath);
          } catch {
            /* 이미 없거나 남의 락 — 건드리지 않는다 */
          }
        },
      };
    } catch (e) {
      try { fs.unlinkSync(tmp); } catch { /* tmp 정리 실패는 무해 */ }
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    }

    let holder: LockFileBody | null = null;
    try {
      holder = JSON.parse(fs.readFileSync(lockPath, 'utf8')) as LockFileBody;
    } catch {
      holder = null; // 사라졌거나(경쟁자 탈취) 외부산 파손 — 아래 rename이 판정한다
    }
    const heldTooLong =
      holder?.started_at !== undefined &&
      Number.isFinite(Date.parse(holder.started_at)) &&
      Date.now() - Date.parse(holder.started_at) > LOCK_HELD_TOO_LONG_MS;
    if (holder && holder.pid > 0 && pidAlive(holder.pid) && !heldTooLong) {
      throw new LedgerBusyError(holder); // 명시 거절 — fail-open 금지
    }

    // 원자 탈취: rename은 정확히 한 경쟁자만 성공한다. 실패(ENOENT)는 남이
    // 이미 처리했다는 뜻 — 루프가 재시도로 판정한다.
    const grave = `${lockPath}.stale.${randomUUID()}`;
    try {
      fs.renameSync(lockPath, grave);
      fs.unlinkSync(grave);
    } catch {
      /* 경쟁자가 먼저 — 다음 시도 */
    }
  }
  throw new LedgerBusyError({ pid: -1, started_at: 'contended' });
}

// ── 읽기 규율: 정직한 카운터 ───────────────────────────────

export interface LedgerReadResult {
  events: ArgusEvent[];
  /** 미래 producer가 쓴 미지 이벤트 — 데이터는 정상, 내가 모를 뿐. */
  skipped_unknown: number;
  /** JSON 파손·아는 이벤트의 깨진 shape — 데이터 자체가 다쳤다. */
  dropped_corrupt: number;
}

const KNOWN = new Set(EVENT_NAMES);

export function readLedger(home: string, repositoryId: string): LedgerReadResult {
  const result: LedgerReadResult = { events: [], skipped_unknown: 0, dropped_corrupt: 0 };
  let raw: string;
  try {
    raw = fs.readFileSync(ledgerPath(home, repositoryId), 'utf8');
  } catch {
    return result; // 원장 부재 = 빈 원장
  }
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      result.dropped_corrupt++;
      continue;
    }
    const name = (parsed as { event?: unknown }).event;
    if (typeof name !== 'string' || !KNOWN.has(name)) {
      result.skipped_unknown++; // 미래 이벤트는 파손이 아니다 — 분리 계상
      continue;
    }
    const check = ArgusEventSchema.safeParse(parsed);
    if (!check.success) {
      result.dropped_corrupt++; // 아는 이벤트인데 shape이 깨졌다 = 파손
      continue;
    }
    result.events.push(check.data);
  }
  return result;
}

// ── 쓰기: lock → replay → guard → append/fsync → unlock ──

/** replay 결과를 받아 전이를 판정하는 훅. 던지면 append는 일어나지 않는다.
 *  (ALREADY_SETTLED 류 판정은 P1 reducer가 이 자리에 꽂힌다.) */
export type TransitionGuard = (prior: LedgerReadResult, next: ArgusEvent) => void;

export function appendEvent(
  home: string,
  repositoryId: string,
  event: unknown,
  guard?: TransitionGuard,
): ArgusEvent {
  // 검증은 락 밖에서 — 깨진 입력 때문에 락을 잡을 이유가 없다.
  const parsed = ArgusEventSchema.safeParse(event);
  if (!parsed.success) {
    throw new Error(`INVALID_EVENT: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · ')}`);
  }
  if (parsed.data.repository_id !== repositoryId) {
    throw new Error(
      `REPOSITORY_MISMATCH: event.repository_id=${parsed.data.repository_id} but appending to ${repositoryId}`,
    );
  }

  const lock = acquireLock(home, repositoryId);
  try {
    const prior = readLedger(home, repositoryId); // replay (락 안 — II-E 순서)
    if (guard) guard(prior, parsed.data); // transition guard — 던지면 append 없음
    const fd = fs.openSync(ledgerPath(home, repositoryId), 'a');
    try {
      fs.writeSync(fd, JSON.stringify(parsed.data) + '\n');
      fs.fsyncSync(fd); // append는 fsync까지가 한 동작 — torn write 최소화
    } finally {
      fs.closeSync(fd);
    }
    return parsed.data;
  } finally {
    lock.release(); // projection·영수증·sync는 이 밖에서 — 락 범위는 여기까지다
  }
}
