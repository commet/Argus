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
//   SEED          — a contract_seed must be settleable: non-empty predicate,
//                   four parts (pass/fail conditions), a present check_by
//                   (date or prose event per sail Step 7; a dated one must be
//                   strictly after the bearing's generated_at), and no
//                   vibe-predicate ("잘 될 것 같다"). Port of the MCP's seal
//                   gate (argus-mcp/src/lib/validate-seal.ts — keep in sync):
//                   the skill prose already demands all this, but prose rules
//                   fail 25–44% under token pressure (R29) — an unsettleable
//                   seed sealed today is a dead reminder in 30 days.
//
// Usage:
//   node validate-gates.mjs                 # walk all sessions under ./.argus, exit 2 on any violation (CI gate)
//   node validate-gates.mjs --latest --warn # check only the most-recent session, always exit 0 (Stop-hook backstop)
//   node validate-gates.mjs --hook          # PostToolUse(Write|Edit) mode: reads the hook JSON from stdin and
//                                           # gates the JUST-WRITTEN bearing BEFORE the model renders it —
//                                           # exit 2 feeds the violations back so the render the user sees is
//                                           # already repaired (§9.7 O1 방5: post-hoc warn → pre-render gate).
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

// ── SEED gate helpers — mirror of argus-mcp/src/lib/validate-seal.ts. The
// vibe lists are the same WEAK heuristic (obvious cases only, not a complete
// falsifiability gate); no \b in the Korean one (word boundaries don't work
// for Hangul).
const VIBE = /\b(go well|be fine|be good|be great|work out|feel right|be successful|do better|improve somehow)\b/i;
const VIBE_KO = /(잘\s*될|잘\s*풀릴|괜찮을|좋아질|나아질)\s*(것|거)\s*(같|이)|아마도|어떻게든\s*(될|되)/;

function asDate(value) {
  if (typeof value !== 'string') return null;
  const m = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
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
  const perspectiveSet = firstExisting(dir, ['perspective_set.json', 'synthetic-perspective-set.json']);

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

  // ── E4 SYNTHETIC FIREWALL — only applies to new perspective-set writes.
  // Missing perspective_set.json remains a legacy dual-read, but once the new
  // artifact exists every structural honesty field is mandatory.
  if (perspectiveSet) {
    if (perspectiveSet.independence_units !== 1) {
      v.push('E4: perspective_set independence_units must equal 1 — worker/model count is not independent reality support');
    }
    for (const field of ['generator_lineage', 'prompt_version', 'perspectives', 'convergent_simulated_concerns', 'team_contradictions', 'strongest_dissent', 'unknowns_that_block_judgment', 'reality_check_questions']) {
      if (perspectiveSet[field] === undefined) v.push(`E4: perspective_set.${field} is missing`);
    }
    if (!verif) {
      v.push('E4: a new perspective_set reached a bearing without verification.json');
    } else {
      if (verif.synthetic_independence_units !== 1) v.push('E4: verification synthetic_independence_units must equal 1');
      for (const field of ['strongest_dissent', 'unknowns_that_block_judgment', 'reality_check_questions']) {
        if (verif[field] === undefined) v.push(`E4: verification.${field} is missing`);
      }
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

  // ── SEED GATE — a sealed prediction must be one reality can actually grade.
  // Dates compare against the bearing's own generated_at, not today: this gate
  // re-runs over old sessions in CI, and "past today" is a contract that is
  // DUE, not one that was invalid when sealed.
  const seed = bearing.contract_seed;
  if (seed !== null && seed !== undefined) {
    if (typeof seed !== 'object' || Array.isArray(seed)) {
      v.push('SEED: contract_seed is not an object — the four-part contract shape is lost');
    } else {
      const predicate = seed.predicate;
      if (typeof predicate !== 'string' || predicate.trim().length < 8) {
        v.push('SEED: contract_seed.predicate is empty or under 8 chars — a seal needs a statement reality can mark true or false');
      } else if (VIBE.test(predicate) || VIBE_KO.test(predicate)) {
        v.push('SEED: contract_seed.predicate reads like a vibe, not a checkable prediction — restate with a number, threshold, or observable event (weak heuristic; may miss cases)');
      }
      for (const part of ['pass_condition', 'fail_condition']) {
        if (typeof seed[part] !== 'string' || !seed[part].trim()) {
          v.push(`SEED: contract_seed.${part} is missing — without it, settle has no sealed criterion to hold reality against`);
        }
      }
      // check_by may be a date OR prose ("30 days after release") per sail
      // Step 7 — prose is legitimate (settle lists it as "date unclear"), so
      // only a MISSING check_by is a violation; the date rules apply only
      // when a date is actually present.
      if (typeof seed.check_by !== 'string' || !seed.check_by.trim()) {
        v.push('SEED: contract_seed.check_by is missing — without a date or event, reality is never consulted and the contract can never settle');
      } else {
        const checkBy = asDate(seed.check_by);
        const sealedOn = asDate(bearing.generated_at);
        if (checkBy && sealedOn && checkBy <= sealedOn) {
          v.push(`SEED: contract_seed.check_by (${checkBy}) is not after the bearing's generated_at (${sealedOn}) — the contract was born already due`);
        }
      }
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

// ── hook mode (PostToolUse Write|Edit): gate the just-written bearing BEFORE render.
// The skills' step order is "write artifacts → render Current Bearing", so a
// violation surfaced HERE reaches the model before the user sees anything —
// unlike the Stop-hook backstop, which can only warn about a render that
// already happened. Every non-bearing write exits 0 silently and fast; any
// stdin/parse problem also exits 0 — a broken gate must never wedge a session.
function hookMain() {
  let filePath = null;
  try {
    const raw = fs.readFileSync(0, 'utf8');
    const hook = JSON.parse(deBom(raw));
    const input = hook && typeof hook === 'object' ? hook.tool_input : null;
    if (input && typeof input.file_path === 'string') filePath = input.file_path;
  } catch { /* no/garbage stdin → nothing to gate */ }
  if (!filePath || !BEARING_NAMES.includes(path.basename(filePath))) process.exit(0);

  const violations = checkVersion(path.dirname(filePath));
  if (violations.length) {
    console.error(
      `⚓ Argus gate check — the bearing just written violates the spine; repair it BEFORE rendering it to the user:\n` +
      violations.map((m) => `  ${m}`).join('\n'),
    );
    process.exit(2);
  }
  process.exit(0);
}

// ── run (only when invoked directly, not when imported by the test)
function main() {
  if (args.includes('--hook')) return hookMain();
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
