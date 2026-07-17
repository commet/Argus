/**
 * 수확 처리 단계 (P6-1) — 큐에서 클레임한 transcript를 결정론 게이트로 훑어
 * byte-검증 후보를 만든다.
 *
 * 이 판은 **모델이 없다.** foreground scan과 같은 CandidateExtractorPort의
 * 결정론 floor를 사용한다. 추출기를 교체해도 큐·캡·증거·stable identity·
 * canonical writer는 그대로 재사용된다.
 *
 * 창업자 확정 정책 (2026-07-11): **1일 1회 · 주 2건 캡 · opt-in.**
 *  - opt-in은 훅이 이미 지킨다 (opt-in 아니면 큐에 아무것도 없다).
 *  - 1일 1회: dataDir의 dedupe marker (규칙 3 — 임시 상태).
 *  - 주 2건: 원장의 candidate_created(source=harvest_sweep) 실계수 —
 *    marker가 아니라 원장이 정본이라, marker가 지워져도 캡은 뚫리지 않는다.
 *
 * 정직성:
 *  - byte 대조 실패(quote가 raw transcript에 그대로 없음 — JSON 이스케이프
 *    등)는 조용한 host_reported 강등이 아니라 **quote_not_found 계수**다.
 *    byte-검증 못 하는 후보는 만들지 않는다 (Matrix Debrief 행).
 *  - 캡으로 못 만든 건수도 capped로 계수한다 (조용한 truncation 금지).
 *  - 이 함수는 절대 던지지 않는다 — 실패는 큐 항목에 보존된다 (규칙 4).
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { V2Context } from './bridge.js';
import { captureTranscriptFile } from './candidate-capture.js';
import { claim, complete, fail, type QueueItem } from './queue.js';
import { readLedger } from './ledger.js';

export const WEEKLY_CANDIDATE_CAP = 2;   // 창업자 확정 ③
export const DEFAULT_LEASE_MS = 10 * 60 * 1000;

export interface SweepResult {
  ran: boolean;
  skipped?: 'already_ran_today' | 'weekly_cap_exhausted' | 'queue_empty';
  item_id?: string;
  utterances_scanned: number;
  candidates_created: string[];
  /** 게이트는 발화했지만 byte 대조 실패 — 후보를 만들지 않았다 (정직 계수). */
  quote_not_found: number;
  /** 게이트는 발화했지만 주간 캡으로 만들지 않았다 (정직 계수). */
  capped: number;
  sensitive_blocked: number;
  sensitive_categories: string[];
  error?: string;
}

const empty = (skipped?: SweepResult['skipped']): SweepResult => ({
  ran: false, ...(skipped ? { skipped } : {}),
  utterances_scanned: 0, candidates_created: [], quote_not_found: 0, capped: 0,
  sensitive_blocked: 0, sensitive_categories: [],
});

/** ISO 주의 월요일 (UTC) — 주간 캡의 경계. */
export function weekStartOf(dateIso: string): string {
  const d = new Date(dateIso + 'T00:00:00Z');
  const dow = d.getUTCDay(); // 0=일
  d.setUTCDate(d.getUTCDate() - ((dow + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function weeklyCandidateCount(home: string, repositoryId: string, today: string): number {
  const weekStart = weekStartOf(today);
  return readLedger(home, repositoryId).events.filter((e) => {
    const ev = e as Record<string, unknown>;
    return ev['event'] === 'candidate_created' && ev['source'] === 'harvest_sweep' &&
      typeof ev['logical_date'] === 'string' && (ev['logical_date'] as string) >= weekStart;
  }).length;
}

const markerPath = (dataDir: string): string => path.join(dataDir, 'harvest-last-run.json');

function alreadyRanToday(dataDir: string, today: string): boolean {
  try {
    return (JSON.parse(fs.readFileSync(markerPath(dataDir), 'utf8')) as { date?: string }).date === today;
  } catch { return false; }
}

function markRanToday(dataDir: string, today: string): void {
  fs.mkdirSync(dataDir, { recursive: true });
  const tmp = `${markerPath(dataDir)}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ date: today }));
  fs.renameSync(tmp, markerPath(dataDir));
}

/** 큐에서 1건 클레임 → 게이트 훑기 → byte-검증 후보 생성 → 완료/실패 기록.
 *  하루 1회·주 2건 캡. 절대 던지지 않는다. */
export async function runHarvestSweep(
  ctx: V2Context, dataDir: string, nowIso: string,
  opts: { leaseMs?: number } = {},
): Promise<SweepResult> {
  const today = ctx.today;
  if (alreadyRanToday(dataDir, today)) return empty('already_ran_today');

  const already = weeklyCandidateCount(ctx.home, ctx.repository_id, today);
  let budget = WEEKLY_CANDIDATE_CAP - already;
  if (budget <= 0) { markRanToday(dataDir, today); return empty('weekly_cap_exhausted'); }

  const nonce = randomUUID();
  let item: QueueItem | null = null;
  try {
    item = claim(dataDir, nowIso, opts.leaseMs ?? DEFAULT_LEASE_MS, nonce);
  } catch { /* 큐 파손 — readQueue가 빈 큐로 정직 처리, claim null */ }
  if (!item) { markRanToday(dataDir, today); return empty('queue_empty'); }

  const result: SweepResult = {
    ran: true, item_id: item.item_id,
    utterances_scanned: 0, candidates_created: [], quote_not_found: 0, capped: 0,
    sensitive_blocked: 0, sensitive_categories: [],
  };
  try {
    const captured = await captureTranscriptFile({
      ctx,
      transcript_path: item.transcript_path,
      session_id: item.session_id,
      source_origin_id: `claude-code:${item.transcript_path}`,
      trigger: 'background_queue',
      max_candidates: budget,
    });
    result.utterances_scanned = captured.utterances_scanned;
    result.candidates_created = captured.candidates_created;
    result.quote_not_found = captured.quote_not_found;
    result.capped = captured.capped;
    result.sensitive_blocked = captured.sensitive_blocked;
    result.sensitive_categories = captured.sensitive_categories;
    complete(dataDir, item.item_id, nonce, {
      candidateIds: captured.candidates_created,
      noCandidate: captured.no_candidate,
      completedAt: nowIso,
    });
    markRanToday(dataDir, today);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    fail(dataDir, item.item_id, nonce, msg); // 항목 보존 (규칙 4)
    result.error = msg;
    // 실패한 날도 '오늘 1회'는 소모다 — 같은 파손을 하루에 무한 재시도하지 않는다.
    markRanToday(dataDir, today);
  }
  return result;
}
