#!/usr/bin/env node
// Argus ENFORCEMENT GATES — architectural, not prose.
//
// Why: prose rules are a floor, not enforcement. Under token pressure a model
// skips its own required steps and even admits it (Superpowers #528; Argus R29
// found 25–44% prose-enforcement failure). The spine's must-not-skip gates
// therefore need a MECHANICAL check that reads the session artifacts the model
// actually wrote and flags violations — something the model cannot "skip".
//
// Gates checked, per session's latest version (reads analysis.json +
// verification-ledger.json + current_bearing.json):
//   VERIFY        — a blocked / critical-unresolved verification must NOT be
//                   surfaced as an executable bearing (blocked:false).
//   ROUTE-CONTRACT— a non-open request (validation/vent/info) must NOT produce a
//                   manufactured fork (vent especially never forks). [over-fire]
//   FRAME-FLAT    — a flat decision must NOT manufacture a fork/fog. [over-fire]
//
// Usage:
//   node validate-gates.mjs                 # walk all sessions under ./.argus, exit 2 on any violation (CI gate)
//   node validate-gates.mjs --latest --warn # check only the most-recent session, always exit 0 (Stop-hook mode)
//   node validate-gates.mjs --root <dir>    # point at a specific .argus dir (tests)
//
// Never throws on read/parse errors — a broken gate-check must not wedge a session.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const WARN = args.includes('--warn');
const LATEST = args.includes('--latest');
const rootIdx = args.indexOf('--root');
const argusDir = rootIdx !== -1 ? args[rootIdx + 1] : path.join(process.cwd(), '.argus');

const BEARING_NAMES = ['current_bearing.json', 'current-bearing.json'];
const VERIF_NAMES = ['verification-ledger.json', 'verification_ledger.json', 'verification.json'];
const ANALYSIS_NAMES = ['analysis.json', 'analysis-snapshot.json'];

function deBom(s) { return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s; }
function readJson(file) {
  try { return JSON.parse(deBom(fs.readFileSync(file, 'utf8'))); } catch { return null; }
}
function firstExisting(dir, names) {
  for (const n of names) { const p = path.join(dir, n); if (fs.existsSync(p)) return readJson(p); }
  return null;
}

// Collect the active/latest version for each session. Superseded drafts are
// immutable history: re-gating every old version makes a repaired session fail
// forever and contradicts the "per session's latest version" contract above.
function collectVersions() {
  const out = [];
  const sessions = path.join(argusDir, 'sessions');
  let ids = [];
  try { ids = fs.readdirSync(sessions); } catch { return out; }
  for (const id of ids) {
    const sessionDir = path.join(sessions, id);
    const versions = path.join(sessions, id, 'versions');
    let labels = [];
    try { labels = fs.readdirSync(versions); } catch { continue; }
    const entries = [];
    for (const label of labels) {
      const dir = path.join(versions, label);
      let mtime = 0;
      try { mtime = fs.statSync(dir).mtimeMs; } catch { /* skip */ }
      entries.push({ session: id, label, dir, mtime });
    }
    if (!entries.length) continue;

    const session = readJson(path.join(sessionDir, 'session.json'));
    const active = Array.isArray(session?.drafts)
      ? session.drafts.find((draft) => draft.id === session.active_draft_id)?.version_label
      : null;
    out.push(entries.find((entry) => entry.label === active)
      ?? entries.sort((a, b) => b.mtime - a.mtime)[0]);
  }
  return out;
}

// Apply the gates to one version dir. Returns string[] of violations.
export function checkVersion(dir) {
  const v = [];
  const bearing = firstExisting(dir, BEARING_NAMES);
  if (!bearing) return v; // no bearing produced → nothing to enforce against
  const verif = firstExisting(dir, VERIF_NAMES);
  const analysis = firstExisting(dir, ANALYSIS_NAMES);
  const workers = firstExisting(dir, ['workers.json', 'worker_results.json', 'worker-results.json']);

  const status = bearing.current_course?.status;
  const road = Array.isArray(bearing.road_not_taken) ? bearing.road_not_taken : [];
  const executable = bearing.blocked !== true; // bearing presented as something to act on

  // ── VERIFY GATE
  if (verif) {
    if (verif.overall_status === 'blocked' && executable) {
      v.push('VERIFY: verification overall_status=blocked but bearing is executable (blocked!=true) — an unverified-blocked decision was surfaced as actionable');
    }
    const criticalChallenged = (verif.challenged_claims || []).some((c) => c.severity === 'critical');
    if (criticalChallenged && verif.routing_decision === 'proceed_to_boss' && !verif.user_choice) {
      v.push('VERIFY: a critical challenged_claim routed proceed_to_boss with no recorded user_choice — a critical unverified claim slipped past the gate');
    }
    const execBlockingHuman = (verif.human_required_checks || []).some((h) => h.blocks === 'execution' || h.blocks === 'final_signoff');
    if (execBlockingHuman && executable) {
      v.push('VERIFY: a human_required_check that blocks execution/final_signoff exists but bearing is executable (blocked!=true)');
    }
  }

  // ── OUTPUT-INTEGRITY GATE — no degraded run may render as a clean "verified".
  // A failed/empty/weak worker that vanishes from the surfaced output is the
  // "never lie about completeness" violation (spine extension of authorship honesty).
  const workerList = Array.isArray(workers) ? workers : (workers?.workers || workers?.results || []);
  if (Array.isArray(workerList) && workerList.length) {
    const failed = workerList.filter((w) =>
      ['error', 'verification_failed'].includes(w.status) ||
      w.verification_passed === false ||
      (typeof w.verification_score === 'number' && w.verification_score < 70));
    if (failed.length && verif && verif.overall_status === 'verified') {
      v.push(`OUTPUT-INTEGRITY: ${failed.length} worker(s) failed/weak (${failed.map((w) => w.agent_id || w.id).join(', ')}) but verification overall_status=verified — a degraded run is masquerading as clean`);
    }
    if (failed.length && executable && bearing.fog_or_reef == null && status !== 'hold') {
      v.push('OUTPUT-INTEGRITY: a failed/weak worker exists but the bearing surfaces no fog_or_reef and is executable — the failure was silently dropped');
    }
  }

  // ── ROUTE-CONTRACT GATE (over-fire on non-open requests)
  const reqType = analysis?.request_type;
  if (reqType && reqType !== 'open_decision') {
    if (status === 'fork' || road.length > 0) {
      v.push(`ROUTE-CONTRACT: request_type=${reqType} (non-open) but bearing manufactured a fork (status=${status}, road_not_taken=${road.length}) — over-fire`);
    }
    if (reqType === 'vent') {
      v.push('ROUTE-CONTRACT: request_type=vent produced a decision bearing at all — vent must off-ramp, never decide');
    }
  }

  // ── FRAME-FLAT GATE (over-fire on flat decisions)
  if (analysis?.frame_status === 'flat') {
    if (road.length > 0) v.push('FRAME-FLAT: flat decision has a non-empty road_not_taken — manufactured fork (over-fire)');
    if (bearing.fog_or_reef !== null && bearing.fog_or_reef !== undefined) v.push('FRAME-FLAT: flat decision has non-null fog_or_reef — manufactured fog (over-fire)');
    if (status && !['proceed', 'anchor'].includes(status)) v.push(`FRAME-FLAT: flat decision uses status=${status} (must be proceed/anchor)`);
  }

  return v;
}

// ── run (only when invoked directly, not when imported by the test)
function main() {
  let versions = collectVersions();
  if (LATEST && versions.length) {
    versions = [versions.sort((a, b) => b.mtime - a.mtime)[0]];
  }

  const findings = [];
  for (const ver of versions) {
    for (const msg of checkVersion(ver.dir)) {
      findings.push(`  [${ver.session}/${ver.label}] ${msg}`);
    }
  }

  if (findings.length) {
    const header = '⚓ Argus gate check — spine violation(s) in session artifacts:';
    if (WARN) {
      // Stop-hook mode: surface prominently, but never wedge the session.
      console.error(`${header}\n${findings.join('\n')}\n(warn-only; fix before sealing. Run: node argus-plugin-v2/scripts/validate-gates.mjs)`);
      process.exit(0);
    }
    console.error(`${header}\n${findings.join('\n')}`);
    process.exit(2);
  }

  if (!WARN) console.log(`Argus gate check passed (${versions.length} version(s)).`);
  process.exit(0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
