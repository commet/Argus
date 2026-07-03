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
// verification-ledger.json + current_course.json):
//   VERIFY        — a blocked / critical-unresolved verification must NOT be
//                   surfaced as an executable course (blocked:false).
//   ROUTE-CONTRACT— a non-open request (validation/vent/info) must NOT produce a
//                   manufactured fork (vent especially never forks). [over-fire]
//   FRAME-FLAT    — a flat decision must NOT manufacture a fork/uncertainty. [over-fire]
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

const COURSE_NAMES = ['current_course.json', 'current-course.json'];
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

// Collect { session, label, dir, mtime } for every version dir.
function collectVersions() {
  const out = [];
  const sessions = path.join(argusDir, 'sessions');
  let ids = [];
  try { ids = fs.readdirSync(sessions); } catch { return out; }
  for (const id of ids) {
    const versions = path.join(sessions, id, 'versions');
    let labels = [];
    try { labels = fs.readdirSync(versions); } catch { continue; }
    for (const label of labels) {
      const dir = path.join(versions, label);
      let mtime = 0;
      try { mtime = fs.statSync(dir).mtimeMs; } catch { /* skip */ }
      out.push({ session: id, label, dir, mtime });
    }
  }
  return out;
}

// Apply the gates to one version dir. Returns string[] of violations.
export function checkVersion(dir) {
  const v = [];
  const course = firstExisting(dir, COURSE_NAMES);
  if (!course) return v; // no course produced → nothing to enforce against
  const verif = firstExisting(dir, VERIF_NAMES);
  const analysis = firstExisting(dir, ANALYSIS_NAMES);

  const status = course.current_course?.status;
  const road = Array.isArray(course.set_aside_options) ? course.set_aside_options : [];
  const executable = course.blocked !== true; // course presented as something to act on

  // ── VERIFY GATE
  if (verif) {
    if (verif.overall_status === 'blocked' && executable) {
      v.push('VERIFY: verification overall_status=blocked but course is executable (blocked!=true) — an unverified-blocked decision was surfaced as actionable');
    }
    const criticalChallenged = (verif.challenged_claims || []).some((c) => c.severity === 'critical');
    if (criticalChallenged && verif.routing_decision === 'proceed_to_boss' && !verif.user_choice) {
      v.push('VERIFY: a critical challenged_claim routed proceed_to_boss with no recorded user_choice — a critical unverified claim slipped past the gate');
    }
    const execBlockingHuman = (verif.human_required_checks || []).some((h) => h.blocks === 'execution' || h.blocks === 'final_signoff');
    if (execBlockingHuman && executable) {
      v.push('VERIFY: a human_required_check that blocks execution/final_signoff exists but course is executable (blocked!=true)');
    }
  }

  // ── ROUTE-CONTRACT GATE (over-fire on non-open requests)
  const reqType = analysis?.request_type;
  if (reqType && reqType !== 'open_decision') {
    if (status === 'fork' || road.length > 0) {
      v.push(`ROUTE-CONTRACT: request_type=${reqType} (non-open) but course manufactured a fork (status=${status}, set_aside_options=${road.length}) — over-fire`);
    }
    if (reqType === 'vent') {
      v.push('ROUTE-CONTRACT: request_type=vent produced a decision course at all — vent must off-ramp, never decide');
    }
  }

  // ── FRAME-FLAT GATE (over-fire on flat decisions)
  if (analysis?.frame_status === 'flat') {
    if (road.length > 0) v.push('FRAME-FLAT: flat decision has a non-empty set_aside_options — manufactured fork (over-fire)');
    if (course.open_risk !== null && course.open_risk !== undefined) v.push('FRAME-FLAT: flat decision has non-null open_risk — manufactured uncertainty (over-fire)');
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
