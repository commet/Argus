import fs from 'node:fs';
import path from 'node:path';
import { argusHome } from './ledger.js';
import { contextFor } from './bridge.js';
import { gitCommonDirOf } from './git-discovery.js';
import { runHarvestSweep } from './harvest.js';
import { readQueue, type QueueItemStatus } from './queue.js';

export interface CaptureRuntimeStatus {
  enabled: boolean;
  consumer: 'check_in_bounded';
  queue_counts: Partial<Record<QueueItemStatus, number>>;
  corrupt_queue: boolean;
  last_drain?: {
    ran: boolean;
    skipped?: string;
    candidates_created: number;
    sensitive_blocked: number;
    quote_not_found: number;
    capped: number;
    failed: boolean;
  };
}

function captureEnabled(home: string): boolean {
  try {
    const config = JSON.parse(fs.readFileSync(path.join(home, 'config.json'), 'utf8')) as {
      harvest?: { opt_in?: unknown };
    };
    return config.harvest?.opt_in === true;
  } catch {
    return false;
  }
}

export async function drainCaptureOnCheckIn(
  workspaceArgusDir: string,
  today: string,
): Promise<CaptureRuntimeStatus> {
  const home = argusHome();
  const dataDir = process.env['CLAUDE_PLUGIN_DATA'];
  const enabled = captureEnabled(home);
  const queue = dataDir ? readQueue(dataDir) : { items: [], was_corrupt: false };
  const queueCounts: Partial<Record<QueueItemStatus, number>> = {};
  for (const item of queue.items) queueCounts[item.status] = (queueCounts[item.status] ?? 0) + 1;
  const status: CaptureRuntimeStatus = {
    enabled,
    consumer: 'check_in_bounded',
    queue_counts: queueCounts,
    corrupt_queue: queue.was_corrupt,
  };
  if (!enabled || !dataDir) return status;

  try {
    const commonDir = gitCommonDirOf(workspaceArgusDir);
    if (!commonDir) return status;
    const ctx = contextFor({
      home,
      gitCommonDir: commonDir,
      workspaceArgusDir,
      sessionId: `check-in-${process.pid}`,
      producerVersion: '2.0.0-jcr-j6',
      today,
    });
    const result = await runHarvestSweep(ctx, dataDir, new Date().toISOString());
    status.last_drain = {
      ran: result.ran,
      skipped: result.skipped,
      candidates_created: result.candidates_created.length,
      sensitive_blocked: result.sensitive_blocked,
      quote_not_found: result.quote_not_found,
      capped: result.capped,
      failed: !!result.error,
    };
    const after = readQueue(dataDir);
    status.queue_counts = {};
    for (const item of after.items) {
      status.queue_counts[item.status] = (status.queue_counts[item.status] ?? 0) + 1;
    }
    status.corrupt_queue = after.was_corrupt;
  } catch {
    status.last_drain = {
      ran: false,
      candidates_created: 0,
      sensitive_blocked: 0,
      quote_not_found: 0,
      capped: 0,
      failed: true,
    };
  }
  return status;
}
