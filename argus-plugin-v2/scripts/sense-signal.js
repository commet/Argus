#!/usr/bin/env node
/**
 * Argus UserPromptSubmit hook — Layer-2 CONTENT sense (2026-07-20).
 *
 * The trust answer, in code. In an MCP the server never sees the conversation and
 * Claude does not support server-driven sampling, so "the model will notice a
 * passing prediction / a surfacing outcome / an assumption" was a goodwill
 * dependency. This hook removes that dependency for the plugin: it runs on EVERY
 * user turn (host-provided, deterministic), scans the message with the shared
 * rule detector (decision-signals.detectSignals — NO LLM), and when a sense fires
 * it hands the MAIN agent a sourced, one-shot nudge naming the USER'S OWN WORDS.
 * Detection moves from "spot it from scratch" to "confirm a flagged candidate".
 *
 * SPINE — max detect, min fire (mirror clause). Detection is high-recall; firing
 * is deliberately restrained:
 *  - SILENCE IS THE DEFAULT. No sense → print nothing, exit 0.
 *  - At most ONCE per session (marker), then never again — no fatigue.
 *  - The nudge is a MIRROR, never a verdict: it offers ONCE, takes a skip as
 *    final, and tells the model to stay silent on a flat/trivial/reversible call.
 *  - MCP absent → the nudge tells the model to ignore it silently (a lone
 *    instruction with no tools reads as an injection attack; source + this rule
 *    prevent that collapse — the same guard ambient-nudge uses).
 *  - Never throws, never exits non-zero — a broken hook must not tax the session.
 *
 * Input(stdin): Claude Code UserPromptSubmit payload { user_message|prompt, session_id, cwd }
 * Output(stdout): { hookSpecificOutput: { hookEventName, additionalContext } } — or nothing.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { configDir, detectSignals } = require('./lib/decision-signals');

function sensedMarker(sessionId) {
  return path.join(configDir(), 'argus-sensed', String(sessionId));
}

// Open (sealed, unsettled) predicate texts from the LOCAL ledger — the input the
// OUTCOME sense needs to tell a real settlement from ordinary past-tense chatter.
// Same direct-ledger read the existing trackRecord helper already does.
function openPredicates(cwd) {
  let raw;
  try { raw = fs.readFileSync(path.join(cwd, '.argus', 'ledger', 'ledger.jsonl'), 'utf8'); }
  catch { return []; }
  const pred = new Map();
  const closed = new Set();
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (!e || !e.id) continue;
    if (e.event === 'seal' && typeof e.predicate === 'string') pred.set(e.id, e.predicate);
    else if (e.event === 'settle' || e.event === 'dismiss') closed.add(e.id);
  }
  const out = [];
  for (const [id, p] of pred.entries()) if (!closed.has(id)) out.push(p);
  return out;
}

const SRC = '[Argus sense — a deterministic plugin hook flagged this from the user\'s own message. Speak to the user in their own language. This is a MIRROR, never a verdict.]';

function buildNudge(sig) {
  const span = String(sig.span || '').slice(0, 220);
  const tail = 'If the Argus tools (argus_predict / argus_resolve / argus_capture) are NOT in your tool list right now, ignore this entirely and do not mention it — a different surface reports connection issues.';
  if (sig.kind === 'prediction') {
    return [
      SRC,
      `The user just made a claim reality can later check: "${span}"`,
      'If this is a CONSEQUENTIAL decision (high stakes or hard to reverse), then AFTER you have fully handled their request you MAY offer ONCE to save it as a falsifiable prediction with a check-by date: call argus_predict with the user\'s own wording (predicate_owner:"user" if they worded it; else confirm_draft:true so they get a one-tap Keep / Reword / Skip). If the call is flat, trivial, or easily reversible, stay SILENT. Offer at most once; a skip is final. Never grade the decision.',
      tail,
    ].join('\n');
  }
  if (sig.kind === 'outcome') {
    return [
      SRC,
      `The user's words suggest a prediction you are tracking may have just resolved: "${span}"`,
      'If this settles one of their OPEN predictions, record what reality did in the user\'s own words with argus_resolve — do NOT wait for the check-by date when reality has already spoken. Never infer an outcome they did not state. If it does not actually settle a tracked prediction, stay silent. Recording is neutral bookkeeping, never praise or a grade.',
      tail,
    ].join('\n');
  }
  // assumption
  return [
    SRC,
    `The user's reasoning rests on a stated premise: "${span}"`,
    'You MAY note the SINGLE load-bearing assumption it most rests on, in the user\'s own words, with argus_capture — a fact to revisit later, never a verdict on their decision, and at most one. Only if the decision is consequential; otherwise stay silent.',
    tail,
  ].join('\n');
}

function main(input) {
  let payload = {};
  try { payload = JSON.parse(input || '{}'); } catch { return null; }
  const cwd = typeof payload.cwd === 'string' && payload.cwd ? payload.cwd : process.cwd();
  const sessionId = payload && payload.session_id;
  const prompt = (payload && (payload.user_message || payload.prompt)) || '';
  if (!sessionId || typeof prompt !== 'string' || prompt.length < 8) return null;

  // opt-out — same escape hatch as the ambient nudge (one switch, not two).
  try {
    const home = process.env.ARGUS_HOME || path.join(require('os').homedir(), '.argus');
    const cfg = JSON.parse(fs.readFileSync(path.join(home, 'config.json'), 'utf8'));
    if (cfg && cfg.ambient && cfg.ambient.opt_out === true) return null;
  } catch { /* no config = default on */ }

  // once-per-session gate (silence is the default; fatigue is a spine violation).
  const marker = sensedMarker(sessionId);
  try { if (fs.existsSync(marker)) return null; } catch { return null; }

  // DETECT (high recall) — the turn's content, plus open predicates for the
  // outcome sense. max:1 — one nudge per turn, and the gate makes it one per session.
  const sigs = detectSignals(prompt, { openPredicates: openPredicates(cwd), max: 1 });
  if (!sigs.length) return null;

  // Claim the slot BEFORE printing: a write failure means silence, not a repeat.
  try {
    fs.mkdirSync(path.dirname(marker), { recursive: true });
    fs.writeFileSync(marker, '');
  } catch { return null; }

  return buildNudge(sigs[0]);
}

let stdin = '';
try { stdin = fs.readFileSync(0, 'utf8'); } catch { /* no stdin */ }
let context = null;
try { context = main(stdin); } catch { /* a broken hook must never tax the session */ }
if (context) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: context },
  }));
}
process.exit(0);
