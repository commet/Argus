import fs from 'fs';
import path from 'path';
import { deBom } from './deBom.js';
import { ledgerPath, sessionsRoot } from './layout.js';

const BEARING_NAMES = ['current_bearing.json', 'current-bearing.json'];

export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function asDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

interface ContractEntry {
  status: 'candidate' | 'sealed' | 'settled' | 'dismissed';
  text: string;
  check_by?: string;
  id?: string;
}

export interface LedgerState {
  overdue: Array<{ date: string; text: string; id?: string }>;
  ids: Set<string>;
  sealedPredicates: Set<string>;
  contracts: Map<string, ContractEntry>;
  stats: {
    total_sealed: number;
    total_settled: number;
    held: number;
    avoided: number;
    partial: number;
  };
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(deBom(fs.readFileSync(file, 'utf8')));
  } catch {
    return null;
  }
}

export function replayLedger(argusDir: string, today: string): LedgerState {
  const ids = new Set<string>();
  const sealedPredicates = new Set<string>();
  const map = new Map<string, ContractEntry>();
  const stats = { total_sealed: 0, total_settled: 0, held: 0, avoided: 0, partial: 0 };

  let raw: string;
  try {
    raw = deBom(fs.readFileSync(ledgerPath(argusDir), 'utf8'));
  } catch {
    return { overdue: [], ids, sealedPredicates, contracts: map, stats };
  }

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let ev: Record<string, unknown>;
    try { ev = JSON.parse(line) as Record<string, unknown>; } catch { continue; }
    if (!ev['id'] || typeof ev['id'] !== 'string') continue;
    const id = ev['id'];
    ids.add(id);
    const cur = map.get(id);
    switch (ev['event']) {
      case 'harvest':
        if (!cur) map.set(id, { status: 'candidate', text: (ev['decision'] as string) || (ev['quote'] as string) || '' });
        break;
      case 'seal':
        if (typeof ev['predicate'] === 'string') sealedPredicates.add(ev['predicate']);
        if (cur) {
          cur.status = 'sealed';
          if (ev['predicate'] != null) cur.text = ev['predicate'] as string;
          cur.check_by = ev['check_by'] as string | undefined;
          stats.total_sealed++;
        }
        break;
      case 'amend':
        if (cur) {
          if (ev['predicate'] != null) cur.text = ev['predicate'] as string;
          if (ev['check_by'] != null) cur.check_by = ev['check_by'] as string;
        }
        break;
      case 'dismiss':
        if (cur) cur.status = 'dismissed';
        break;
      case 'settle': {
        if (cur) {
          cur.status = 'settled';
          stats.total_settled++;
          const outcome = ev['outcome'] as string | undefined;
          if (outcome === 'held') stats.held++;
          else if (outcome === 'avoided') stats.avoided++;
          else if (outcome === 'partial') stats.partial++;
        }
        break;
      }
    }
  }

  const overdue: Array<{ date: string; text: string; id?: string }> = [];
  for (const [id, item] of map.entries()) {
    if (item.status !== 'sealed') continue;
    const date = asDate(item.check_by);
    if (date && date <= today) overdue.push({ date, text: item.text || '', id });
  }

  return { overdue, ids, sealedPredicates, contracts: map, stats };
}

export function bearingContracts(
  argusDir: string,
  today: string,
  ledger: LedgerState
): Array<{ date: string; text: string; source: string; predicate: string; check_by: string }> {
  const out: Array<{ date: string; text: string; source: string; predicate: string; check_by: string }> = [];

  function collectSeed(dir: string, importId: string | null) {
    if (importId && ledger.ids.has(importId)) return;
    for (const name of BEARING_NAMES) {
      const bearing = readJson(path.join(dir, name)) as Record<string, unknown> | null;
      const seed = bearing && (bearing['contract_seed'] as Record<string, unknown> | undefined);
      if (!seed) continue;
      if (typeof seed['predicate'] === 'string' && ledger.sealedPredicates.has(seed['predicate'])) return;
      const date = asDate(seed['check_by']);
      if (date && date <= today && typeof seed['predicate'] === 'string') {
        out.push({ date, text: seed['predicate'], source: dir, predicate: seed['predicate'], check_by: seed['check_by'] as string });
      }
      return;
    }
  }

  collectSeed(argusDir, null);

  const sessions = sessionsRoot(argusDir);
  let ids: string[] = [];
  try { ids = fs.readdirSync(sessions); } catch { return out; }
  for (const id of ids) {
    collectSeed(path.join(sessions, id), null);
    const versions = path.join(sessions, id, 'versions');
    let labels: string[] = [];
    try { labels = fs.readdirSync(versions); } catch { continue; }
    for (const label of labels) {
      collectSeed(path.join(versions, label), `bearing:${id}:${label}`);
    }
  }
  return out;
}
