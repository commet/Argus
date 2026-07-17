import path from 'node:path';
import { argusHome } from './ledger.js';
import { contextFor } from './bridge.js';
import { gitCommonDirOf } from './git-discovery.js';
import { captureTranscriptFile } from './candidate-capture.js';
import { purge, purgeAll, readQueue, type QueueItemStatus } from './queue.js';

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
