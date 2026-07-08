#!/usr/bin/env node
/**
 * anc-cloud-hook.js — AI Native Camp usage submitter for Claude Code WEB (remote) sessions.
 *
 * Why this exists: the official camp collector (~/.config/ainc/anc-hook.js) is a Stop hook
 * registered in ~/.claude/settings.json on your LOCAL machine. Web sessions run in an
 * Anthropic cloud container — their transcripts never touch your local disk, so the local
 * collector can't see them and that usage silently vanishes from the leaderboard.
 *
 * This script is the cloud-side counterpart. It is registered as a Stop hook in this repo's
 * .claude/settings.json (repo hooks DO run in cloud sessions) and, on every turn:
 *   1. no-ops unless CLAUDE_CODE_REMOTE=true (so it never double-counts on your local
 *      machine, where the official hook already submits the same transcript)
 *   2. scans ALL *.jsonl under ~/.claude/projects — the container is per-session, so this
 *      is exactly this session's main transcript PLUS subagent/workflow transcripts
 *      (<session>/subagents/agent-*.jsonl), which the official hook misses
 *   3. submits per-file deltas to POST /api/usage/submit with the same payload shape,
 *      Asia/Seoul date bucketing, session-cache delta logic (_rN resubmission ids), and
 *      offline queue as the official script, so server-side dedup keeps everything consistent
 *
 * Setup (one-time): add AINC_TOKEN=ainc_... to your cloud environment's environment
 * variables, and allow the domain ainativecamp-production.up.railway.app in that
 * environment's network access. Without AINC_TOKEN the hook exits silently.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

// Never block the session: hard-exit after 5s, and always exit 0.
const HARD_TIMEOUT = setTimeout(() => process.exit(0), 5000);
HARD_TIMEOUT.unref();

// Cloud sessions only — local machines are covered by the official ainc hook.
if (process.env.CLAUDE_CODE_REMOTE !== 'true') process.exit(0);

const TOKEN = (process.env.AINC_TOKEN || '').trim();
if (!/^ainc_/.test(TOKEN)) process.exit(0);
const API_URL = (process.env.AINC_API_URL || 'https://ainativecamp-production.up.railway.app').replace(/\/+$/, '');

const STATE_DIR = path.join(os.homedir(), '.config', 'ainc');
const STATE_PATH = path.join(STATE_DIR, 'cloud-session-cache.json');
const QUEUE_PATH = path.join(STATE_DIR, 'cloud-queue.jsonl');
const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

// Same pricing table + fallback rules as the official anc-hook.js, so cloud-submitted
// cost figures line up with locally submitted ones.
const PRICING = {
  // fable-5 is a Mythos-tier model above Opus. No official per-token rate is wired
  // in here yet, so we FLOOR it at Opus rates — 5x closer than the old Sonnet
  // fallback. Replace with the published fable-5 rate when confirmed.
  'claude-fable-5': { input: 15, output: 75, cache_write: 18.75, cache_read: 1.5 },
  'claude-opus-4-8': { input: 15, output: 75, cache_write: 18.75, cache_read: 1.5 },
  'claude-opus-4-6': { input: 15, output: 75, cache_write: 18.75, cache_read: 1.5 },
  'claude-sonnet-4-6': { input: 3, output: 15, cache_write: 3.75, cache_read: 0.3 },
  'claude-haiku-4-5': { input: 0.8, output: 4, cache_write: 1, cache_read: 0.08 },
};

function getPrice(model) {
  if (!model) return PRICING['claude-sonnet-4-6'];
  for (const [key, price] of Object.entries(PRICING)) {
    if (model.includes(key) || model.startsWith(key.replace(/-\d+$/, ''))) return price;
  }
  // Unknown model: bias toward NOT under-reporting. A brand-new premium model
  // (fable/opus-class) costed at Sonnet rates silently understates spend ~5x, so
  // an unrecognized non-haiku/non-sonnet model floors at Opus, not Sonnet.
  if (model.includes('opus') || model.includes('fable')) return PRICING['claude-opus-4-6'];
  if (model.includes('haiku')) return PRICING['claude-haiku-4-5'];
  if (model.includes('sonnet')) return PRICING['claude-sonnet-4-6'];
  return PRICING['claude-opus-4-6'];
}

function listTranscripts(dir) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listTranscripts(p));
    else if (e.isFile() && e.name.endsWith('.jsonl')) out.push(p);
  }
  return out;
}

function readUsage(file) {
  const totals = { inp: 0, out: 0, cw: 0, cr: 0, cost: 0, models: new Set() };
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch {
    return totals;
  }
  for (const line of content.split('\n')) {
    if (!line) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.type !== 'assistant') continue;
      const usage = entry.message && entry.message.usage;
      const model = entry.message && entry.message.model;
      if (usage) {
        const inp = usage.input_tokens || 0;
        const out = usage.output_tokens || 0;
        const cw = usage.cache_creation_input_tokens || 0;
        const cr = usage.cache_read_input_tokens || 0;
        totals.inp += inp;
        totals.out += out;
        totals.cw += cw;
        totals.cr += cr;
        const p = getPrice(model);
        totals.cost += (inp * p.input + out * p.output + cw * p.cache_write + cr * p.cache_read) / 1e6;
      }
      if (model) totals.models.add(model);
    } catch {}
  }
  return totals;
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveState(state) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(STATE_PATH, JSON.stringify(state));
  } catch {}
}

function enqueue(data) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.appendFileSync(QUEUE_PATH, data + '\n');
  } catch {}
}

// POST via curl instead of Node's https module: the cloud sandbox only allows
// egress through the HTTPS_PROXY CONNECT proxy (with a re-terminating CA), which
// curl honors automatically and Node's https does not (direct requests get 403).
function submit(data, callback) {
  const child = execFile(
    'curl',
    [
      '-sS',
      '-o', '/dev/null',
      '-w', '%{http_code}',
      '--max-time', '3',
      '-X', 'POST',
      '-H', 'Content-Type: application/json',
      '-H', 'Authorization: Bearer ' + TOKEN,
      '--data-binary', '@-',
      API_URL + '/api/usage/submit',
    ],
    { timeout: 4000 },
    (err, stdout) => {
      const status = parseInt(stdout, 10);
      callback(!err && status >= 200 && status < 300);
    }
  );
  child.stdin.on('error', () => {});
  child.stdin.end(data);
}

function removeFromQueue(data) {
  try {
    const lines = fs.readFileSync(QUEUE_PATH, 'utf8').split('\n').filter(Boolean);
    const idx = lines.lastIndexOf(data);
    if (idx >= 0) lines.splice(idx, 1);
    if (lines.length === 0) fs.unlinkSync(QUEUE_PATH);
    else fs.writeFileSync(QUEUE_PATH, lines.join('\n') + '\n');
  } catch {}
}

function drainQueue(maxItems) {
  let lines;
  try {
    lines = fs.readFileSync(QUEUE_PATH, 'utf8').split('\n').filter(Boolean);
  } catch {
    return;
  }
  for (const line of lines.slice(0, maxItems)) {
    submit(line, (ok) => {
      if (ok) removeFromQueue(line);
    });
  }
}

function main(sessionId) {
  drainQueue(10);

  const state = loadState();
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  let dirty = false;

  for (const file of listTranscripts(PROJECTS_DIR)) {
    const totals = readUsage(file);
    const grand = totals.inp + totals.out + totals.cw + totals.cr;
    if (grand === 0) continue;

    const prev = state[file] || { inp: 0, out: 0, cw: 0, cr: 0, cost: 0, n: 0 };
    const dInp = Math.max(0, totals.inp - prev.inp);
    const dOut = Math.max(0, totals.out - prev.out);
    const dCw = Math.max(0, totals.cw - prev.cw);
    const dCr = Math.max(0, totals.cr - prev.cr);
    const dCost = Math.max(0, totals.cost - prev.cost);
    const dTotal = dInp + dOut + dCw + dCr;
    if (dTotal <= 0) continue;

    // Main transcript keeps the real session id (matches what a local run would submit);
    // subagent/workflow transcripts submit under their own file id. _rN suffixes make
    // incremental resubmissions pass the server's session_id dedup, like the official hook.
    const base = path.basename(file, '.jsonl');
    const id = base === sessionId ? sessionId : base;
    const submissionId = prev.n > 0 ? id + '_r' + prev.n : id;

    state[file] = { inp: totals.inp, out: totals.out, cw: totals.cw, cr: totals.cr, cost: totals.cost, n: prev.n + 1 };
    dirty = true;

    const data = JSON.stringify({
      session_id: submissionId,
      date: today,
      input_tokens: dInp,
      output_tokens: dOut,
      cache_creation_tokens: dCw,
      cache_read_tokens: dCr,
      total_tokens: dTotal,
      total_cost: Math.round(dCost * 100) / 100,
      models_used: Array.from(totals.models),
    });

    // Queue first so a failed/timed-out POST is retried on the next Stop event.
    enqueue(data);
    submit(data, (ok) => {
      if (ok) removeFromQueue(data);
    });
  }

  if (dirty) saveState(state);
}

let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  try {
    const event = JSON.parse(input || '{}');
    main(event.session_id || '');
  } catch {}
});
