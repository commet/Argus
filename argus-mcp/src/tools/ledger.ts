import fs from 'fs';
import fsP from 'fs/promises';
import { ledgerPath, ledgerDir } from '../lib/layout.js';
import { replayLedger, bearingContracts, localToday, asDate } from '../lib/ledger-replay.js';
import { ok, err, type ToolResult } from './types.js';

interface LedgerEvent {
  event: 'harvest' | 'seal' | 'amend' | 'settle' | 'dismiss';
  id: string;
  [key: string]: unknown;
}

export async function argus_ledger_append(args: {
  argus_dir: string;
  events: LedgerEvent[];
}): Promise<ToolResult> {
  try {
    const lDir = ledgerDir(args.argus_dir);
    await fsP.mkdir(lDir, { recursive: true });
    const lPath = ledgerPath(args.argus_dir);
    const lines = args.events.map(ev => JSON.stringify(ev)).join('\n') + '\n';

    // O_APPEND for true atomic append
    await new Promise<void>((resolve, reject) => {
      const fd = fs.openSync(lPath, fs.constants.O_APPEND | fs.constants.O_CREAT | fs.constants.O_WRONLY);
      try {
        fs.writeSync(fd, lines, 0, 'utf8');
        resolve();
      } catch (e) {
        reject(e);
      } finally {
        fs.closeSync(fd);
      }
    });

    // Verify written lines parse back
    const raw = await fsP.readFile(lPath, 'utf8');
    const written = raw.split('\n').filter(l => l.trim()).length;
    let verification: 'ok' | 'rewrite_needed' = 'ok';
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try { JSON.parse(line); } catch {
        verification = 'rewrite_needed';
        break;
      }
    }

    return ok({ written: args.events.length, total_lines: written, verification });
  } catch (e) {
    return err('ledger_append_failed', String(e));
  }
}

export async function argus_ledger_replay(args: { argus_dir: string }): Promise<ToolResult> {
  try {
    const today = localToday();
    const state = replayLedger(args.argus_dir, today);
    const open = Array.from(state.contracts.entries())
      .filter(([, v]) => v.status === 'sealed')
      .map(([id, v]) => ({ id, ...v }));
    const settled = Array.from(state.contracts.entries())
      .filter(([, v]) => v.status === 'settled')
      .map(([id, v]) => ({ id, ...v }));
    const dismissed = Array.from(state.contracts.entries())
      .filter(([, v]) => v.status === 'dismissed')
      .map(([id, v]) => ({ id, ...v }));
    return ok({
      contracts: { open, settled, dismissed },
      stats: state.stats,
      overdue: state.overdue,
    });
  } catch (e) {
    return err('ledger_replay_failed', String(e));
  }
}

export async function argus_contracts_due(args: { argus_dir: string }): Promise<ToolResult> {
  try {
    const today = localToday();
    const ledger = replayLedger(args.argus_dir, today);
    const fromBearings = bearingContracts(args.argus_dir, today, ledger);
    const due = [
      ...ledger.overdue.map(c => ({ ...c, source: 'ledger' as const })),
      ...fromBearings.map(c => ({ date: c.date, text: c.text, source: 'bearing' as const, predicate: c.predicate, check_by: c.check_by })),
    ].sort((a, b) => (a.date < b.date ? -1 : 1));

    const dates = due.map(c => c.date).filter(d => asDate(d));
    const next_check_by = dates.length ? dates[0] : null;

    return ok({ due, next_check_by, today });
  } catch (e) {
    return err('contracts_due_failed', String(e));
  }
}
