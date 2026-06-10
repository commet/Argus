/**
 * Append-only decision ledger.
 *
 * Events (one JSON per line in ledger.jsonl):
 *   harvest — a detected decision candidate
 *   seal    — candidate → sealed bet (predicate + falsified_if + check_by)
 *   amend   — change a sealed bet (history preserved; no silent overwrite)
 *   dismiss — candidate rejected by the user ("이건 내 결정이 아닌데")
 *   settle  — outcome recorded at/after check_by
 *
 * State is materialized by replay. Nothing is ever deleted or rewritten —
 * 변침(變針)도 기록이다 (EXECUTION-PLAN P3.5 amend principle).
 *
 * Privacy: this file holds personal decisions — lives in .argus/ledger/, gitignored.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function ledgerDir(repoRoot = process.cwd()) {
  return path.join(repoRoot, '.argus', 'ledger');
}
function ledgerFile(root) { return path.join(ledgerDir(root), 'ledger.jsonl'); }
function stateFile(root) { return path.join(ledgerDir(root), 'scan-state.json'); }

export function decisionId(sessionId, quote) {
  return crypto.createHash('sha256').update(sessionId + '|' + quote).digest('hex').slice(0, 8);
}

export function appendEvent(root, event) {
  fs.mkdirSync(ledgerDir(root), { recursive: true });
  fs.appendFileSync(ledgerFile(root), JSON.stringify({ ...event, at: new Date().toISOString() }) + '\n');
}

/** Replay events → current state: Map<id, decision>. */
export function loadLedger(root) {
  const f = ledgerFile(root);
  const map = new Map();
  if (!fs.existsSync(f)) return map;
  for (const line of fs.readFileSync(f, 'utf8').split('\n').filter(Boolean)) {
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    const cur = map.get(e.id);
    switch (e.event) {
      case 'harvest':
        if (!cur) map.set(e.id, {
          id: e.id, status: 'candidate', harvested_at: e.at,
          project: e.project, session: e.session, decided_at: e.decided_at,
          quote: e.quote, decision: e.decision, type: e.type, stakes: e.stakes,
          history: [],
        });
        break;
      case 'seal':
        if (cur) Object.assign(cur, {
          status: 'sealed', sealed_at: e.at,
          predicate: e.predicate, falsified_if: e.falsified_if, check_by: e.check_by,
        });
        break;
      case 'amend':
        if (cur) {
          cur.history.push({ predicate: cur.predicate, falsified_if: cur.falsified_if, check_by: cur.check_by, amended_at: e.at });
          Object.assign(cur, {
            predicate: e.predicate ?? cur.predicate,
            falsified_if: e.falsified_if ?? cur.falsified_if,
            check_by: e.check_by ?? cur.check_by,
          });
        }
        break;
      case 'dismiss':
        if (cur) { cur.status = 'dismissed'; cur.dismissed_at = e.at; cur.dismiss_reason = e.reason; }
        break;
      case 'settle':
        if (cur) { cur.status = 'settled'; cur.outcome = e.outcome; cur.settled_at = e.at; cur.settle_note = e.note; }
        break;
    }
  }
  return map;
}

export function loadScanState(root) {
  const f = stateFile(root);
  if (!fs.existsSync(f)) return { files: {} };
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return { files: {} }; }
}

export function saveScanState(root, state) {
  fs.mkdirSync(ledgerDir(root), { recursive: true });
  fs.writeFileSync(stateFile(root), JSON.stringify(state, null, 2));
}

/** Today as a LOCAL-timezone ISO date (UTC slice is yesterday before 09:00 KST). */
export function localToday(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400_000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function dueBets(map, today = localToday()) {
  return [...map.values()].filter(d => d.status === 'sealed' && d.check_by && d.check_by <= today);
}
