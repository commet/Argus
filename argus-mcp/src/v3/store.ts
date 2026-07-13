import { createHash } from 'node:crypto';
import fs from 'node:fs';
import fsP from 'node:fs/promises';
import path from 'node:path';
import { ledgerDir } from '../lib/layout.js';
import { withLedgerLock } from '../lib/ledger-append.js';
import { guardAppendBatch } from './reducer.js';
import { SemanticEventSchema, type SemanticEvent } from './types.js';

export const semanticLedgerPath = (argusDir: string): string =>
  path.join(ledgerDir(argusDir), 'semantic-v3.jsonl');

export interface SemanticLedgerDiagnostic {
  line: number;
  code: 'INVALID_JSON';
  detail: string;
}

export interface SemanticLedgerRead {
  events: readonly unknown[];
  diagnostics: readonly SemanticLedgerDiagnostic[];
}

export class SemanticLedgerError extends Error {
  constructor(readonly code: 'IDEMPOTENCY_CONFLICT' | 'INVALID_EVENT' | 'DUPLICATE_IDEMPOTENCY' | 'UNKNOWN_REFERENCE' | 'ILLEGAL_TRANSITION' | 'MISSING_AUTHORITY') {
    super(code);
    this.name = 'SemanticLedgerError';
  }
}

/** A repository-local, privacy-preserving stable name for the local semantic space. */
export function localSpaceId(argusDir: string): string {
  const canonical = path.resolve(argusDir).replace(/\\/g, '/').toLowerCase();
  return `local-${createHash('sha256').update(canonical).digest('hex').slice(0, 24)}`;
}

export async function readSemanticLedger(argusDir: string): Promise<SemanticLedgerRead> {
  let raw = '';
  try {
    raw = await fsP.readFile(semanticLedgerPath(argusDir), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { events: [], diagnostics: [] };
    throw error;
  }

  const events: unknown[] = [];
  const diagnostics: SemanticLedgerDiagnostic[] = [];
  for (const [index, line] of raw.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const source = line.trim();
    if (!source) continue;
    try {
      events.push(JSON.parse(source));
    } catch (error) {
      diagnostics.push({
        line: index + 1,
        code: 'INVALID_JSON',
        detail: error instanceof Error ? error.message : 'JSON parse failed',
      });
    }
  }
  return { events, diagnostics };
}

function durableAppend(filePath: string, events: readonly SemanticEvent[]): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  let leadingNewline = '';
  try {
    const size = fs.statSync(filePath).size;
    if (size > 0) {
      const fd = fs.openSync(filePath, fs.constants.O_RDONLY);
      try {
        const last = Buffer.alloc(1);
        fs.readSync(fd, last, 0, 1, size - 1);
        if (last[0] !== 0x0a) leadingNewline = '\n';
      } finally {
        fs.closeSync(fd);
      }
    }
  } catch {
    // The O_APPEND open below creates a new ledger when needed.
  }

  const fd = fs.openSync(filePath, fs.constants.O_APPEND | fs.constants.O_CREAT | fs.constants.O_WRONLY);
  try {
    fs.writeSync(fd, leadingNewline + events.map((event) => JSON.stringify(event)).join('\n') + '\n', null, 'utf8');
    try { fs.fsyncSync(fd); } catch { /* unsupported filesystem: the append still completed */ }
  } finally {
    fs.closeSync(fd);
  }
}

function stableIntent(event: SemanticEvent): string {
  const { event_id: _eventId, time, ...rest } = event;
  return JSON.stringify({
    ...rest,
    time: {
      occurred_at: time.occurred_at,
      temporal_mode: time.temporal_mode,
    },
  });
}

export interface SemanticAppendResult {
  status: 'written' | 'duplicate';
  events: readonly SemanticEvent[];
  integrity: { invalid_json_lines: number };
}

/**
 * Append only a fully validated batch. Existing idempotency keys turn an exact
 * retry into a receipt, but a reused key with different intent is rejected.
 */
export async function appendSemanticEvents(argusDir: string, candidates: readonly unknown[]): Promise<SemanticAppendResult> {
  return withLedgerLock(argusDir, async () => {
    const parsed = candidates.map((candidate) => SemanticEventSchema.safeParse(candidate));
    if (parsed.some((result) => !result.success)) throw new SemanticLedgerError('INVALID_EVENT');
    const events: SemanticEvent[] = [];
    for (const result of parsed) {
      if (!result.success) throw new SemanticLedgerError('INVALID_EVENT');
      events.push(result.data);
    }
    const ledger = await readSemanticLedger(argusDir);
    const existingByKey = new Map<string, SemanticEvent>();
    for (const raw of ledger.events) {
      const event = SemanticEventSchema.safeParse(raw);
      if (event.success && !existingByKey.has(event.data.idempotency_key)) {
        existingByKey.set(event.data.idempotency_key, event.data);
      }
    }

    const matching = events.map((event) => existingByKey.get(event.idempotency_key));
    if (matching.some(Boolean)) {
      if (matching.some((event) => !event)) throw new SemanticLedgerError('IDEMPOTENCY_CONFLICT');
      if (matching.some((event, index) => stableIntent(event!) !== stableIntent(events[index]!))) {
        throw new SemanticLedgerError('IDEMPOTENCY_CONFLICT');
      }
      return { status: 'duplicate', events: matching as SemanticEvent[], integrity: { invalid_json_lines: ledger.diagnostics.length } };
    }

    const guarded = guardAppendBatch(ledger.events, events);
    if (!guarded.ok) throw new SemanticLedgerError(guarded.code as SemanticLedgerError['code']);
    durableAppend(semanticLedgerPath(argusDir), guarded.events);
    return { status: 'written', events: guarded.events, integrity: { invalid_json_lines: ledger.diagnostics.length } };
  });
}
