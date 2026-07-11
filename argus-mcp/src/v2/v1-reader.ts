/**
 * v1 원장 리더 + 위치 이전 — "과거 이벤트는 영원히 읽는다" (정본 II-E)의 실장.
 *
 * v1 이벤트 14종 (v1 ledger-replay.ts에서 실사 확인): harvest · seal · amend ·
 * dismiss · settle · defer · premise_add · premise_amend · premise_reconsider ·
 * premise_recheck · premise_resolve · gate_input · watch_anchor · watch_capture.
 *
 * 설계 결정 (사람이 나중에 고칠 때 알아야 하는 것):
 *
 *  1. **v1 줄은 v2 원장에 섞지 않는다.** 이전은 원본을
 *     `~/.argus/projects/{id}/ledger.v1.jsonl`로 **복사**하는 것이다 (정본 II-F:
 *     "복사 안내(원본은 보존 — 이동·삭제 금지), 재실행 멱등"). v2 ledger.jsonl은
 *     순수 v2로 남고, loadState가 v1 파일 → v2 파일 순서로 접는다 (시간상 v1이
 *     항상 먼저다 — 이전 후에만 v2 이벤트가 생기므로).
 *
 *  2. **provenance는 하향만 허용.** v1의 predicate_owner:'user'는 elicitation을
 *     입증할 수 없으므로 v2에서 'host_reported'로 접는다. 실제로 elicit으로 확인
 *     된 봉인도 있어 아까운 하향이지만, 출처를 위로 위조하는 것(II-B 승격 규칙
 *     위반)보다 아래로 정직한 쪽을 고른다. 렌더는 "모델이 전한 당신의 말"이 된다.
 *
 *  3. **잃는 것은 세지, 삼키지 않는다.** v2 상태 기계에 접히지 않는 v1 이벤트
 *     (defer의 이력 상세, watch_anchor/capture, gate_input)는 V1Extras에 원문
 *     보존 — projection이 나중에 자기 방식으로 읽는다. 모르는 v1 이벤트 이름은
 *     skipped_unknown 계상.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ledgerPath, projectDir } from './ledger.js';
import type { LedgerState } from './reducer.js';

// ── v1 줄 파싱 (관대하게 — v1엔 strict 계약이 없었다) ──────

export interface V1Event {
  v?: number;
  ts?: string;
  id?: string;
  event: string;
  [key: string]: unknown;
}

const V1_KNOWN = new Set([
  'harvest', 'seal', 'amend', 'dismiss', 'settle', 'defer',
  'premise_add', 'premise_amend', 'premise_reconsider', 'premise_recheck', 'premise_resolve',
  'gate_input', 'watch_anchor', 'watch_capture',
]);

export interface V1Extras {
  anchors: { date?: string; text: string }[];
  captures: { id?: string; date?: string; kind?: string; text: string; source?: string }[];
  gate_inputs: number;
  defers: { id: string; from?: string; to?: string; note?: string }[];
  /** dual-write 시대의 이중 표현 해소: v2가 이미 생성을 가진 id를 건드리는
   *  v1 이벤트는 접지 않고 여기 계수한다 (조용한 skip 금지). */
  overlap_skipped: number;
}

/** v1 fill에서 제외할 id들 — "v2가 그 결정/전제의 생성(harvest·seal·premise_add)을
 *  직접 가졌다"가 기준이다. v2에 settle/amend만 있는 결정(= dual-write 도입 전에
 *  봉인된 것)은 제외하지 않는다 — 그 봉인은 v1만이 공급할 수 있다. */
export interface V1FoldExclusions {
  decisions: ReadonlySet<string>;
  premises: ReadonlySet<string>;
}

export interface V1ReadResult {
  events: V1Event[];
  skipped_unknown: number;
  dropped_corrupt: number;
}

export function v1LedgerPath(home: string, repositoryId: string): string {
  return path.join(projectDir(home, repositoryId), 'ledger.v1.jsonl');
}

export function readV1File(file: string): V1ReadResult {
  const out: V1ReadResult = { events: [], skipped_unknown: 0, dropped_corrupt: 0 };
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return out;
  }
  // v1의 PowerShell BOM 사례(플러그인 statusline에서 실증) — 파싱 전 제거.
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let e: unknown;
    try {
      e = JSON.parse(line);
    } catch {
      out.dropped_corrupt++;
      continue;
    }
    const ev = e as V1Event;
    if (typeof ev.event !== 'string') { out.dropped_corrupt++; continue; }
    if (!V1_KNOWN.has(ev.event)) { out.skipped_unknown++; continue; }
    out.events.push(ev);
  }
  return out;
}

// ── v1 → LedgerState fold (하향 provenance, 총함수) ────────

const HOST = 'host_reported' as const;
const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);

/** v1 이벤트들을 기존 LedgerState 위에 접는다 (v2 fold보다 먼저 호출).
 *  v1 replay와 같은 정신: fold는 검증자가 아니다 — 절대 던지지 않는다.
 *  exclude(v2가 생성을 가진 id들)에 걸리는 결정/전제 이벤트는 접지 않고
 *  overlap_skipped로 계수한다 — 이중 표현(마이그레이션된 v1 스냅샷 +
 *  dual-write된 v2 이벤트)이 이중 fold가 되는 것을 막는다. */
const NO_EXCLUSIONS: V1FoldExclusions = { decisions: new Set(), premises: new Set() };

export function foldV1(state: LedgerState, events: V1Event[], exclude: V1FoldExclusions = NO_EXCLUSIONS): V1Extras {
  const extras: V1Extras = { anchors: [], captures: [], gate_inputs: 0, defers: [], overlap_skipped: 0 };
  const DECISION_EVENTS = new Set(['harvest', 'seal', 'amend', 'dismiss', 'settle', 'defer']);
  const PREMISE_EVENTS = new Set(['premise_add', 'premise_amend', 'premise_reconsider', 'premise_recheck', 'premise_resolve']);
  for (const ev of events) {
    const id = str(ev.id) ?? '';
    if (DECISION_EVENTS.has(ev.event) && exclude.decisions.has(id)) { extras.overlap_skipped++; continue; }
    if (PREMISE_EVENTS.has(ev.event) && exclude.premises.has(str(ev['premise_id']) ?? '')) { extras.overlap_skipped++; continue; }
    switch (ev.event) {
      case 'harvest': {
        if (!id || state.decisions.has(id)) break;
        state.decisions.set(id, {
          id, state: 'harvested', snooze_count: 0,
          text: { value: str(ev['decision']) ?? str(ev['quote']) ?? '', provenance: HOST },
        });
        break;
      }
      case 'seal': {
        if (!id) break;
        const d = state.decisions.get(id) ?? { id, state: 'harvested' as const, snooze_count: 0 };
        state.decisions.set(id, {
          ...d, state: 'sealed',
          // v1 predicate_owner('user'|'ai_surfaced')는 입증 불가 → 하향 (헤더 결정 2).
          predicate: { value: str(ev['predicate']) ?? '', provenance: ev['predicate_owner'] === 'ai_surfaced' ? 'ai_surfaced' : HOST },
          check_by: { value: str(ev['check_by']) ?? '', provenance: HOST },
        });
        break;
      }
      case 'amend': {
        const d = state.decisions.get(id);
        if (!d) break;
        const p = str(ev['predicate']);
        const c = str(ev['check_by']);
        if (p) d.predicate = { value: p, provenance: HOST };
        if (c) d.check_by = { value: c, provenance: HOST };
        break;
      }
      case 'dismiss': {
        const d = state.decisions.get(id);
        if (d) d.state = 'dismissed';
        break;
      }
      case 'settle': {
        const d = state.decisions.get(id);
        if (!d) break;
        d.state = 'settled';
        const o = str(ev['outcome']);
        if (o) d.outcome = { value: o, provenance: HOST };
        break;
      }
      case 'defer': {
        // v1 defer = 재무장: check_by 전진, sealed 유지. 이력은 extras에 원문 보존.
        const d = state.decisions.get(id);
        const to = str(ev['check_by']);
        if (d && to) d.check_by = { value: to, provenance: HOST };
        extras.defers.push({ id, from: str(ev['from']), to, note: str(ev['note']) });
        break;
      }
      case 'premise_add': {
        const pid = str(ev['premise_id']);
        const text = str(ev['text']);
        if (!pid || !text || state.premises.has(pid)) break;
        const kind = ev['kind'];
        state.premises.set(pid, {
          id: pid, decision_id: id || undefined,
          kind: kind === 'fact' || kind === 'question' ? kind : 'premise',
          text: { value: text, provenance: ev['source'] === 'user' || ev['source'] === 'user_stated' ? HOST : 'ai_surfaced' },
          load_bearing: ev['load_bearing'] === true, resolved: false,
        });
        break;
      }
      case 'premise_amend':
      case 'premise_reconsider': {
        const p = state.premises.get(str(ev['premise_id']) ?? '');
        const text = str(ev['text']);
        if (p && text) p.text = { value: text, provenance: HOST };
        break;
      }
      case 'premise_recheck': {
        const p = state.premises.get(str(ev['premise_id']) ?? '');
        const result = str(ev['result']) ?? str(ev['status']);
        if (p) p.last_recheck = { on: (str(ev.ts) ?? '').slice(0, 10), result: result ?? 'unknown' };
        break;
      }
      case 'premise_resolve': {
        const p = state.premises.get(str(ev['premise_id']) ?? '');
        if (p) p.resolved = true;
        break;
      }
      case 'gate_input':
        extras.gate_inputs++;
        break;
      case 'watch_anchor': {
        const text = str(ev['text']);
        if (text) extras.anchors.push({ date: str(ev['date']), text });
        break;
      }
      case 'watch_capture': {
        const text = str(ev['text']);
        if (text) extras.captures.push({
          id: str(ev['id']), date: str(ev['date']), kind: str(ev['kind']), text, source: str(ev['source']),
        });
        break;
      }
    }
  }
  return extras;
}

// ── 위치 이전 (정본 II-F) ─────────────────────────────────

export interface MigrationResult {
  action: 'copied' | 'refreshed' | 'already_migrated' | 'source_missing';
  lines?: number;
  backup?: string;
}

/** v1 원장을 v2 내구 위치로 **복사**한다. 원본은 절대 건드리지 않는다.
 *  재실행 멱등: 같은 내용이면 no-op. dual-write 시대에는 v1 원본이 계속
 *  자라므로, 기존 사본이 새 원본의 **prefix**면(append-only 성장 = 정상)
 *  스냅샷을 갱신한다('refreshed'). 진짜 발산(prefix 아님)만 명시 거절 —
 *  사람이 봐야 하는 상황을 조용히 해소하지 않는다.
 *  기존 v2 자산이 있으면 복사 전에 1회분 백업(II-F 백업 조항). */
export function migrateV1Ledger(home: string, repositoryId: string, sourceFile: string): MigrationResult {
  if (!fs.existsSync(sourceFile)) return { action: 'source_missing' };
  const target = v1LedgerPath(home, repositoryId);
  fs.mkdirSync(path.dirname(target), { recursive: true });

  let refresh = false;
  if (fs.existsSync(target)) {
    const tgt = fs.readFileSync(target);
    const src = fs.readFileSync(sourceFile);
    if (tgt.equals(src)) return { action: 'already_migrated' };
    if (src.length > tgt.length && src.subarray(0, tgt.length).equals(tgt)) {
      refresh = true; // 원본이 사본을 접두사로 포함 — 정상 성장, 갱신 진행
    } else {
      throw new Error(
        `MIGRATION_CONFLICT: ${target} DIVERGES from ${sourceFile} (not a prefix) — ` +
        `refusing to overwrite. Inspect both files; the durable copy may hold a different v1 history.`,
      );
    }
  }

  // 이전 전 백업: 대상 프로젝트 디렉토리에 이미 v2 원장이 있으면 1회분 보관.
  let backup: string | undefined;
  const v2Ledger = ledgerPath(home, repositoryId);
  if (fs.existsSync(v2Ledger)) {
    backup = v2Ledger + `.backup-${new Date().toISOString().slice(0, 10)}`;
    if (!fs.existsSync(backup)) fs.copyFileSync(v2Ledger, backup);
  }

  // tmp+rename — 반쯤 복사된 v1 파일이 진짜처럼 읽히는 것을 방지.
  const tmp = target + '.tmp';
  fs.copyFileSync(sourceFile, tmp);
  fs.renameSync(tmp, target);
  const lines = fs.readFileSync(target, 'utf8').split('\n').filter((l) => l.trim()).length;
  return { action: refresh ? 'refreshed' : 'copied', lines, ...(backup ? { backup } : {}) };
}

/** 기존 설치에서 v1 원장이 살 수 있는 곳들 (정본 II-F 명시 2곳). */
export function v1CandidatePaths(projectRoot: string, home: string): string[] {
  return [
    path.join(projectRoot, '.argus', 'ledger', 'ledger.jsonl'),
    path.join(home, 'ledger', 'ledger.jsonl'),
  ];
}
