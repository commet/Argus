/**
 * Experience loop — "would a real person, mid-work, actually want this?"
 *
 *   ANTHROPIC_API_KEY=... npm run eval:experience
 *   ARGUS_EVAL_PERSONAS=jisoo,marcus ...   (subset; default: all)
 *   ARGUS_EXP_MODEL=claude-sonnet-4-6      (the host model)
 *   ARGUS_EVAL_JUDGE=claude-opus-4-8       (the experience judge)
 *
 * The contract loop (loop.mjs) proves the server answers correctly. THIS loop
 * validates the layer no unit test can see: the experience produced by
 * (user's real work × the host model's free choices × the server's surfaces).
 * For each persona in personas.mjs:
 *
 *   1. spawn the REAL built server (own ledger dir, own clock via
 *      today_override injection — the model never controls the calendar)
 *   2. hand the host model the REAL server instructions + REAL tool schemas,
 *      exactly as Claude Desktop/Code would
 *   3. play the persona's day-stamped life script; the model freely decides
 *      when (and whether!) to touch Argus — unprompted adoption is a metric,
 *      not a given
 *   4. an opus judge reads the full transcript AS the persona and scores the
 *      experience: ride-along, earned return, dignity, restraint, clarity —
 *      plus exactly ONE thing to cut and ONE thing to add (anti-Barnum: a
 *      list of ten soft findings is worth less than one sharp edge)
 *
 * Output: per-persona report + evals/out/experience-latest.json (feeds
 * POLISH-BACKLOG.md and product decisions). Observatory, not a CI gate —
 * exit 0 unless the harness itself fails.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { chat, complete, extractJson } from './anthropic.mjs';
import { PERSONAS } from './personas.mjs';
import { SERVER_INSTRUCTIONS } from '../dist/lib/spine.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist', 'index.js');
const HOST_MODEL = process.env.ARGUS_EXP_MODEL || 'claude-sonnet-4-6';
const JUDGE_MODEL = process.env.ARGUS_EVAL_JUDGE || 'claude-opus-4-8';
const MAX_TOOL_ROUNDS = 5;

function hostSystem(persona) {
  return `${SERVER_INSTRUCTIONS}

You are the AI assistant inside ${persona.host}. The user is in the middle of their real work — be a genuinely helpful assistant first. Tools from the argus-decision MCP server are available; use them exactly when they serve the user, never as ceremony. Each user message begins with the current date in brackets, e.g. "[2026-07-02]".`;
}

const JUDGE_SYSTEM = `You are auditing a product experience. You will read a full transcript of a user working with their AI assistant, which has "Argus" decision-accountability tools available (seal a falsifiable prediction now, settle it against reality later, premises tracked in between — the product's spine is "zero judgment": it must never grade the user or tell them which way to go).

Judge the EXPERIENCE as the persona would live it — not the code. Score 1-5 (5 best):
- ride_along: did Argus attach to the user's actual work, or demand a detour / homework?
- earned_return: at the return touches, did the accumulated record give back MORE than the user put in (a mirror moment), or was it an empty drawer?
- dignity: overdue items and wrong calls — did the user stay the author of their own story, or feel graded/chased/shamed?
- restraint: did anything fire that shouldn't have (ceremony on a flat moment, chasing a disengaged user, unsolicited nudging)?
- clarity: did the user always know what just happened and that every next step was optional?

Then commit to sharp calls:
- would_use_after_trial: as THIS persona, after these days, do you keep it? (boolean, be honest — most tools fail this)
- one_line_review: the app-store one-liner this persona would actually write, in the persona's own language and voice
- best_moment / worst_moment: quote or closely paraphrase the transcript
- cut_one_thing: EXACTLY ONE concrete thing to remove or shrink (a step, a sentence pattern, a field) — the sharpest cut, not a list
- add_one_thing: EXACTLY ONE missing moment/capability that would have changed the persona's verdict
- spine_violations: array (possibly empty) of moments the assistant or the tool graded the user, pushed a verdict, or manufactured ceremony

Reply ONLY with JSON:
{"scores":{"ride_along":n,"earned_return":n,"dignity":n,"restraint":n,"clarity":n},"would_use_after_trial":bool,"one_line_review":"...","best_moment":"...","worst_moment":"...","cut_one_thing":"...","add_one_thing":"...","spine_violations":["..."]}`;

/** Render the transcript for the judge (and the console) — surfaces only, compact. */
function renderTranscript(t) {
  return t.map((e) => {
    if (e.role === 'user') return `[${e.day}] USER: ${e.text}`;
    if (e.role === 'assistant') return `ASSISTANT: ${e.text}`;
    if (e.role === 'elicit') return `  ⇥ PICKER "${e.message}" → user chose: ${e.shown}`;
    return `  → ${e.tool}(${e.argsSummary}) ⇒ ${e.isError ? `ERROR ${e.errorCode}: ` : ''}${e.surface}`;
  }).join('\n');
}

function summarizeArgs(args) {
  const drop = new Set(['argus_dir', 'today_override']);
  const parts = Object.entries(args).filter(([k]) => !drop.has(k)).map(([k, v]) => {
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return `${k}:${s.length > 60 ? s.slice(0, 57) + '…' : s}`;
  });
  return parts.join(', ').slice(0, 220);
}

async function runPersona(persona) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `argus-exp-${persona.id}-`));
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (typeof v === 'string') env[k] = v;
  env.ARGUS_DIR = dir;

  // Advertise elicitation so the server's canElicit() is true and a picker (seal
  // Keep/Reword/Skip, settle outcome) is actually shown — then we simulate the
  // user pressing a button below. Without this the one-tap seal can't be measured.
  const client = new Client({ name: `argus-experience-${persona.id}`, version: '0.0.0' }, { capabilities: { elicitation: {} } });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [DIST], env }));

  const { tools } = await client.listTools();
  const toolDefs = tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema }));
  const schemaProps = new Map(tools.map((t) => [t.name, Object.keys(t.inputSchema?.properties ?? {})]));

  // exec a tool with the harness owning dir + clock (the model never fakes time)
  let currentDay = persona.turns[0]?.day;
  const exec = async (name, args) => {
    const props = schemaProps.get(name) ?? [];
    const a = { ...args };
    if (props.includes('argus_dir')) a.argus_dir = dir;
    if (props.includes('today_override')) a.today_override = currentDay;
    const res = await client.callTool({ name, arguments: a });
    return res;
  };

  // a life that started weeks ago
  if (persona.seed) await persona.seed(async (name, args) => { currentDay = args.today_override ?? currentDay; return exec(name, args); });
  currentDay = persona.turns[0]?.day;

  const transcript = [];
  const messages = [];
  const metrics = { model_calls: 0, tool_calls: 0, tool_errors: 0, tools_used: {}, argus_touched: false, elicitations: 0 };

  // Simulate the user pressing a picker button. When a tool elicits (seal
  // Keep/Reword/Skip, settle outcome, or a free-text ask), the persona — via the
  // host model — decides what they'd ACTUALLY tap/type in that moment. This is
  // the real test of the one-tap seal: does a fast-mover keep a pre-filled draft
  // they'd never have composed from scratch?
  client.setRequestHandler(ElicitRequestSchema, async (request) => {
    const message = String(request.params?.message ?? '');
    const schema = request.params?.requestedSchema ?? {};
    const props = schema.properties ?? {};
    const key = Object.keys(props)[0];
    const field = key ? props[key] : {};
    const vals = Array.isArray(field?.enum) ? field.enum : [];
    const names = Array.isArray(field?.enumNames) ? field.enumNames : vals;
    metrics.elicitations++;
    let content = {};
    let shown = '';
    try {
      if (vals.length) {
        const out = await complete({
          model: HOST_MODEL,
          system: `You ARE this user: ${persona.profile}\nA quick picker just appeared. Pick the option that fits how you'd ACTUALLY react right now — reply with ONLY the option word, nothing else.`,
          user: `Picker: "${message}"\nOptions: ${vals.map((v, i) => `${v} (${names[i]})`).join(' · ')}`,
          maxTokens: 16,
        });
        const lc = out.toLowerCase();
        const choice = vals.find((v) => lc.includes(String(v).toLowerCase())) || vals.find((v, i) => out.includes(String(names[i]))) || vals[0];
        content = { [key]: choice };
        shown = `${choice} (${names[vals.indexOf(choice)] ?? choice})`;
      } else if (key) {
        const out = await complete({
          model: HOST_MODEL,
          system: `You ARE this user: ${persona.profile}`,
          user: `You're asked: "${message}". Answer in one short sentence, in your own words.`,
          maxTokens: 60,
        });
        content = { [key]: out.trim() };
        shown = out.trim();
      }
    } catch { if (vals.length && key) { content = { [key]: vals[0] }; shown = String(vals[0]); } }
    transcript.push({ role: 'elicit', message, shown });
    return { action: 'accept', content };
  });

  for (const turn of persona.turns) {
    currentDay = turn.day;
    messages.push({ role: 'user', content: `[${turn.day}] ${turn.says}` });
    transcript.push({ role: 'user', day: turn.day, text: turn.says });

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      // 2048, not 1024: "seal all three" makes the host emit 3 parallel tool_use
      // blocks (predicate + date each). At 1024 the response truncated mid-call,
      // stop_reason flipped to 'max_tokens', and the old break below left those
      // tool_use ids WITHOUT tool_results → the next turn 400'd. That harness bug
      // masked the real result: the model WAS trying to batch-seal.
      const res = await chat({ model: HOST_MODEL, system: hostSystem(persona), messages, tools: toolDefs, maxTokens: 2048 });
      metrics.model_calls++;
      messages.push({ role: 'assistant', content: res.content });
      const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join(' ').trim();
      if (text) transcript.push({ role: 'assistant', text });

      // ANY tool_use must be answered with a tool_result, whatever the
      // stop_reason — otherwise the next request is malformed. Only break when
      // the model asked for nothing.
      const uses = res.content.filter((b) => b.type === 'tool_use');
      if (uses.length === 0) break;

      const results = [];
      for (const u of uses) {
        metrics.tool_calls++;
        metrics.tools_used[u.name] = (metrics.tools_used[u.name] || 0) + 1;
        if (u.name.startsWith('argus_')) metrics.argus_touched = true;
        let content = '';
        let isError = false;
        let surface = '';
        let errorCode = '';
        try {
          const r = await exec(u.name, u.input ?? {});
          content = (r.content?.[0]?.text) ?? '';
          isError = r.isError === true;
          const s = r.structuredContent ?? {};
          surface = typeof s.surface === 'string' ? s.surface : (typeof s.message === 'string' ? s.message : content.slice(0, 160));
          errorCode = typeof s.error_code === 'string' ? s.error_code : '';
        } catch (e) {
          content = `harness error: ${String(e?.message ?? e)}`;
          isError = true;
          surface = content;
        }
        if (isError) metrics.tool_errors++;
        transcript.push({ role: 'tool', tool: u.name, argsSummary: summarizeArgs(u.input ?? {}), surface, isError, errorCode });
        results.push({ type: 'tool_result', tool_use_id: u.id, content, ...(isError ? { is_error: true } : {}) });
      }
      messages.push({ role: 'user', content: results });
    }
  }

  await client.close();
  fs.rmSync(dir, { recursive: true, force: true });

  // the judge lives the transcript as the persona
  const judgeUser = `PERSONA:\n${persona.profile}\nDesigned probes: ${persona.probes.join(', ')}\n\nTRANSCRIPT:\n${renderTranscript(transcript)}`;
  const judgeRaw = await complete({ model: JUDGE_MODEL, system: JUDGE_SYSTEM, user: judgeUser, maxTokens: 1500 });
  const judged = extractJson(judgeRaw);

  return { persona: persona.id, probes: persona.probes, metrics, judged, transcript };
}

function report(r) {
  const j = r.judged;
  const s = j.scores || {};
  console.log(`\n════ ${r.persona} ════`);
  console.log(`  scores      ride_along:${s.ride_along} earned_return:${s.earned_return} dignity:${s.dignity} restraint:${s.restraint} clarity:${s.clarity}`);
  console.log(`  keep it?    ${j.would_use_after_trial ? 'YES' : 'NO'} — "${j.one_line_review}"`);
  console.log(`  best        ${j.best_moment}`);
  console.log(`  worst       ${j.worst_moment}`);
  console.log(`  CUT one     ${j.cut_one_thing}`);
  console.log(`  ADD one     ${j.add_one_thing}`);
  if (Array.isArray(j.spine_violations) && j.spine_violations.length) {
    for (const v of j.spine_violations) console.log(`  ⚠ spine     ${v}`);
  }
  const used = Object.entries(r.metrics.tools_used).map(([k, n]) => `${k}×${n}`).join(' ') || '(none)';
  console.log(`  structure   argus_touched:${r.metrics.argus_touched} tool_calls:${r.metrics.tool_calls} pickers:${r.metrics.elicitations} errors:${r.metrics.tool_errors} · ${used}`);
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('ANTHROPIC_API_KEY not set — experience loop skipped.');
    console.log('Run: ANTHROPIC_API_KEY=sk-... npm run eval:experience');
    process.exit(0);
  }
  // ALWAYS rebuild — a stale dist silently tests OLD instructions/surfaces
  // (bit me once: a sharpened seal instruction looked like it "failed" when it
  // simply hadn't been compiled in). Cheap insurance for a model-in-loop run.
  execSync('npm run build', { cwd: ROOT, stdio: 'ignore' });

  const filter = (process.env.ARGUS_EVAL_PERSONAS || '').split(',').map((x) => x.trim()).filter(Boolean);
  const personas = filter.length ? PERSONAS.filter((p) => filter.includes(p.id)) : PERSONAS;
  console.log(`Argus experience loop · ${personas.length} persona(s) · host=${HOST_MODEL} · judge=${JUDGE_MODEL}`);

  const results = [];
  for (const p of personas) {
    try {
      const r = await runPersona(p);
      results.push(r);
      report(r);
    } catch (e) {
      console.error(`\n════ ${p.id} ════\n  HARNESS ERROR: ${String(e?.message ?? e)}`);
      results.push({ persona: p.id, error: String(e?.message ?? e) });
    }
  }

  const outDir = path.join(ROOT, 'evals', 'out');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'experience-latest.json'), JSON.stringify(results, null, 2));
  console.log(`\nFull transcripts + verdicts → evals/out/experience-latest.json`);
  console.log('Feed CUT/ADD lines into evals/POLISH-BACKLOG.md or straight into product decisions.');
}

main().catch((e) => { console.error(e); process.exit(1); });
