import path from 'node:path';
import { argusHome } from './ledger.js';
import { contextFor } from './bridge.js';
import { gitCommonDirOf } from './git-discovery.js';
import { captureTranscriptFile } from './candidate-capture.js';
import { purge, purgeAll, readQueue, type QueueItemStatus } from './queue.js';
import { drainCapture } from './capture-runtime.js';

function flag(args: readonly string[], name: string): string | null {
  const index = args.indexOf(name);
  return index >= 0 && typeof args[index + 1] === 'string' ? args[index + 1] : null;
}

export async function runCaptureCli(args: readonly string[]): Promise<void> {
  const argusDir = flag(args, '--argus-dir');
  const transcript = flag(args, '--transcript');
  const sessionId = flag(args, '--session-id');
  const today = flag(args, '--today') ?? new Date().toISOString().slice(0, 10);
  if (!argusDir || !path.isAbsolute(argusDir) || !transcript || !path.isAbsolute(transcript) || !sessionId) {
    throw new Error('capture-scan requires absolute --argus-dir, absolute --transcript, and --session-id');
  }
  const commonDir = gitCommonDirOf(argusDir);
  if (!commonDir) throw new Error('capture-scan could not resolve the project git common directory');
  const ctx = contextFor({
    home: argusHome(),
    gitCommonDir: commonDir,
    workspaceArgusDir: argusDir,
    sessionId,
    producerVersion: '2.0.0-jcr-j6',
    today,
  });
  const result = await captureTranscriptFile({
    ctx,
    transcript_path: transcript,
    session_id: sessionId,
    source_origin_id: `claude-code:${transcript}`,
    trigger: 'explicit_scan',
  });
  process.stdout.write(JSON.stringify(result) + '\n');
}

export function runCaptureStatusCli(args: readonly string[]): void {
  const dataDir = flag(args, '--data-dir');
  if (!dataDir || !path.isAbsolute(dataDir)) {
    throw new Error('capture-status requires absolute --data-dir');
  }
  const state = readQueue(dataDir);
  const counts: Partial<Record<QueueItemStatus, number>> = {};
  for (const item of state.items) counts[item.status] = (counts[item.status] ?? 0) + 1;
  process.stdout.write(JSON.stringify({
    corrupt_queue: state.was_corrupt,
    counts,
    // Deliberately omit transcript_path, session_id, last_error, and candidate
    // content. item_id is the local handle required for selective purge.
    items: state.items.map((item) => ({
      item_id: item.item_id,
      status: item.status,
      attempts: item.attempts,
      completed_at: item.completed_at,
    })),
  }) + '\n');
}

export function runCapturePurgeCli(args: readonly string[]): void {
  const dataDir = flag(args, '--data-dir');
  const itemId = flag(args, '--item-id');
  if (!dataDir || !path.isAbsolute(dataDir) || !itemId) {
    throw new Error('capture-purge requires absolute --data-dir and --item-id <id|all>');
  }
  const now = new Date().toISOString();
  const outcome = itemId === 'all'
    ? purgeAll(dataDir, now)
    : { purged: purge(dataDir, itemId, now) ? 1 : 0, leased_skipped: 0 };
  process.stdout.write(JSON.stringify({ item_id: itemId, ...outcome }) + '\n');
}

/**
 * capture-drain — 큐를 한 건 비운다 (N6: 대화 수집을 자동으로 돌리는 자리).
 *
 * 왜 새 명령인가. 큐에 **넣는** 것은 이미 SessionStart 훅이 자동으로 한다
 * (argus-plugin-v2/hooks/session-start.js). 그런데 **비우는** 것은
 * `check_in` 도구 안에서만 돌았다 — 즉 AI 가 그 도구를 부르기로 마음먹어야
 * 대화가 후보로 바뀌었다. CLAUDE.md 가 금지한 모양이다(라우팅은 결정론 구조가
 * 갖는다). 이 명령이 그 배선을 훅으로 옮긴다.
 *
 * 두뇌는 하나다 — `check_in` 과 **같은** drainCapture 를 부른다. 하루 1회·주
 * 2건 캡, 리스·재시도, "절대 던지지 않음"이 전부 그 안에 이미 있다.
 */
export async function runCaptureDrainCli(args: readonly string[]): Promise<void> {
  const argusDir = flag(args, '--argus-dir');
  const dataDir = flag(args, '--data-dir');
  const today = flag(args, '--today') ?? new Date().toISOString().slice(0, 10);
  if (!argusDir || !path.isAbsolute(argusDir)) {
    throw new Error('capture-drain requires an absolute --argus-dir');
  }
  if (dataDir && !path.isAbsolute(dataDir)) {
    throw new Error('capture-drain --data-dir must be absolute');
  }
  const status = await drainCapture(argusDir, today, 'stop_hook_bounded', dataDir ?? undefined);
  process.stdout.write(JSON.stringify(status) + '\n');
}
