#!/usr/bin/env node
'use strict';
/*
 * ainc-report.js — Stop hook that reports this web session's token usage to the
 * AI Native Camp leaderboard (https://ainativecamp-production.up.railway.app).
 *
 * Why this exists: claude.ai/code (web) sessions run in a fresh, ephemeral
 * container, so the user's local usage hook never sees them and that work is
 * missing from the leaderboard. This reads the session transcript on Stop and
 * submits the usage directly — self-contained, no third-party code downloaded
 * or executed.
 *
 * HARD GATE: only acts on the remote Linux container that has AINC_TOKEN set
 * (the token lives in the environment config, never committed). On any local
 * machine it drains stdin and exits 0 — never double-reports alongside the
 * user's own local install, never errors on Windows.
 *
 * Payload + delta/dedup scheme mirror the official hook: one submission per
 * Stop carrying only the new delta, keyed by a per-Stop submission id so the
 * server's dedup accumulates deltas instead of dropping repeats. A container is
 * one session with no concurrency, so no file lock is needed.
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const https = require('https');

const API = 'https://ainativecamp-production.up.railway.app';

// Pricing per 1M tokens — used only for the cosmetic total_cost field.
const PRICING = {
  'claude-opus-4-6':   { input: 15,   output: 75, cache_write: 18.75, cache_read: 1.50 },
  'claude-sonnet-4-6': { input: 3,    output: 15, cache_write: 3.75,  cache_read: 0.30 },
  'claude-haiku-4-5':  { input: 0.80, output: 4,  cache_write: 1,     cache_read: 0.08 },
};
function getPrice(model) {
  if (!model) return PRICING['claude-sonnet-4-6'];
  for (const [key, price] of Object.entries(PRICING)) {
    if (model.includes(key) || model.startsWith(key.replace(/-\d+$/, ''))) return price;
  }
  if (model.includes('opus')) return PRICING['claude-opus-4-6'];
  if (model.includes('haiku')) return PRICING['claude-haiku-4-5'];
  return PRICING['claude-sonnet-4-6'];
}

const chunks = [];
process.stdin.on('error', () => process.exit(0));
process.stdin.on('data', (c) => chunks.push(c));
process.stdin.on('end', () => { try { main(Buffer.concat(chunks).toString('utf8')); } catch { process.exit(0); } });

function main(input) {
  // gate: remote Linux + token only
  if (process.platform !== 'linux' || !process.env.AINC_TOKEN) process.exit(0);

  const event = JSON.parse(input);
  const transcriptPath = event.transcript_path;
  const sessionId = event.session_id;
  if (!transcriptPath || !fs.existsSync(transcriptPath)) process.exit(0);

  // Sum usage across assistant turns in the transcript.
  let inp = 0, out = 0, cw = 0, cr = 0, cost = 0;
  const models = new Set();
  for (const line of fs.readFileSync(transcriptPath, 'utf8').split('\n')) {
    if (!line) continue;
    try {
      const e = JSON.parse(line);
      if (e.type !== 'assistant') continue;
      const u = e.message && e.message.usage;
      const model = e.message && e.message.model;
      if (model) models.add(model);
      if (!u) continue;
      const i = u.input_tokens || 0, o = u.output_tokens || 0;
      const c1 = u.cache_creation_input_tokens || 0, c2 = u.cache_read_input_tokens || 0;
      inp += i; out += o; cw += c1; cr += c2;
      const p = getPrice(model);
      cost += (i * p.input + o * p.output + c1 * p.cache_write + c2 * p.cache_read) / 1e6;
    } catch {}
  }
  const total = inp + out + cw + cr;
  if (total === 0) process.exit(0);

  // Delta vs what this session already submitted (handles multiple Stops).
  const cfg = path.join(os.homedir(), '.config', 'ainc');
  const cachePath = path.join(cfg, 'web-session-cache.json');
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(cachePath, 'utf8')); } catch {}
  const prev = (sessionId && cache[sessionId]) || { inp: 0, out: 0, cw: 0, cr: 0, cost: 0, n: 0 };

  const dInp = Math.max(0, inp - prev.inp);
  const dOut = Math.max(0, out - prev.out);
  const dCw = Math.max(0, cw - prev.cw);
  const dCr = Math.max(0, cr - prev.cr);
  const dCost = Math.max(0, cost - prev.cost);
  const dTotal = dInp + dOut + dCw + dCr;
  if (dTotal <= 0) process.exit(0);

  const submissionId = sessionId ? (prev.n > 0 ? sessionId + '_r' + prev.n : sessionId) : null;
  if (sessionId) {
    cache[sessionId] = { inp, out, cw, cr, cost, n: prev.n + 1 };
    try { fs.mkdirSync(cfg, { recursive: true }); fs.writeFileSync(cachePath, JSON.stringify(cache)); } catch {}
  }

  const body = JSON.stringify({
    session_id: submissionId,
    date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }),
    input_tokens: dInp,
    output_tokens: dOut,
    cache_creation_tokens: dCw,
    cache_read_tokens: dCr,
    total_tokens: dTotal,
    total_cost: Math.round(dCost * 100) / 100,
    models_used: Array.from(models),
  });

  const req = https.request(API + '/api/usage/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      Authorization: 'Bearer ' + String(process.env.AINC_TOKEN).trim(),
    },
    timeout: 4000,
  }, (res) => { res.resume(); res.on('end', () => process.exit(0)); });
  req.on('timeout', () => { req.destroy(); process.exit(0); });
  req.on('error', () => process.exit(0));
  req.write(body);
  req.end();
}
