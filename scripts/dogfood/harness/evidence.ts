/**
 * Non-sensitive evidence recorder. One JSONL line per step, append-only.
 *
 * Discipline (handoff §"Exact remaining work" item 1.10): event IDs, receipts,
 * outcome codes, invariant results are recorded; judgment CONTENT is recorded
 * only as sha256 — even in local mode where content is synthetic — so a
 * production run is safe by construction, not by remembering to be careful.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface StepOutcome {
  ok: boolean;
  /** Gateway/route refusal code when not ok (or emulator token). */
  code?: string;
  /** HTTP status the web route would/did return. */
  status?: number;
  /** Receipt duplicate flags returned by the RPC. */
  duplicate?: boolean[];
}

export interface StepRecord {
  run_id: string;
  seq: number;
  mode: 'local' | 'production';
  scenario: string;
  step: string;
  surface: 'web' | 'telegram' | 'plugin' | 'kernel' | 'cross';
  action: string;
  outcome: StepOutcome;
  expected?: string;
  /** Whether the observed outcome matched the scripted expectation. */
  matched: boolean;
  event_ids: string[];
  idempotency_keys: string[];
  content_sha256: string[];
  invariant_failures: string[];
  note?: string;
  elapsed_ms: number;
  at: string;
}

export function sha256(value: unknown): string {
  return createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex').slice(0, 16);
}

export class EvidenceRecorder {
  readonly dir: string;
  private seq = 0;
  private stream: fs.WriteStream;
  readonly startedAt = new Date().toISOString();

  constructor(readonly runId: string, readonly mode: 'local' | 'production', baseDir: string) {
    this.dir = path.join(baseDir, runId);
    fs.mkdirSync(this.dir, { recursive: true });
    this.stream = fs.createWriteStream(path.join(this.dir, 'steps.jsonl'), { flags: 'a' });
  }

  record(record: Omit<StepRecord, 'run_id' | 'seq' | 'mode' | 'at'>): StepRecord {
    const full: StepRecord = {
      run_id: this.runId,
      seq: ++this.seq,
      mode: this.mode,
      at: new Date().toISOString(),
      ...record,
    };
    this.stream.write(`${JSON.stringify(full)}\n`);
    return full;
  }

  writeMeta(meta: Record<string, unknown>): void {
    fs.writeFileSync(
      path.join(this.dir, 'meta.json'),
      JSON.stringify({ run_id: this.runId, mode: this.mode, started_at: this.startedAt, ...meta }, null, 2),
    );
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve, reject) => this.stream.end((err?: Error | null) => (err ? reject(err) : resolve())));
  }
}
