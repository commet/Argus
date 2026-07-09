import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { tmpArgusDir } from '../../test-helpers.js';

/**
 * REAL MCP protocol round-trip (plan v5 §8 release smoke, automated): spawns the
 * BUILT server over stdio exactly as a host would (`node dist/index.js`), speaks
 * the actual protocol via the SDK client, and walks the living-premises journey
 * end to end — initialize → tools/list → tools/call → resources/read →
 * prompts/get. This is what the MCP Inspector would verify by hand, pinned in CI.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DIST = path.join(ROOT, 'dist', 'index.js');
const TODAY = '2026-07-02';
// A monitored premise's first recheck now waits one cadence from its add date
// (founder decision 2026-07-10), so premises are added a month before TODAY to
// be due by the TODAY checks.
const ADDED = '2026-06-01';

let client: Client;
let dir: string;

beforeAll(async () => {
  // Always rebuild — this suite drives the BUILT dist directly, so a stale dist
  // silently tests old behavior (it did: the cadence-gate looked to pass here
  // only because dist hadn't been rebuilt).
  execSync('npm run build', { cwd: ROOT, stdio: 'ignore' });
  dir = tmpArgusDir();
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (typeof v === 'string') env[k] = v;
  env['ARGUS_DIR'] = dir; // resources resolve the project from the env, like a real host config

  client = new Client({ name: 'roundtrip-test', version: '0.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [DIST], env }));
}, 30000);

afterAll(async () => {
  await client?.close();
});

function structured(res: unknown): Record<string, unknown> {
  return (res as { structuredContent: Record<string, unknown> }).structuredContent;
}

describe('MCP protocol round-trip (built server, stdio)', () => {
  it('advertises the npm package name and version', () => {
    expect(client.getServerVersion()).toEqual({ name: 'argus-decision-mcp', version: '1.1.0' });
  });

  it('advertises the premises tools with generated JSON schemas', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain('argus_premises');
    expect(names).toContain('argus_recheck');
    expect(names).toContain('argus_watch'); // M1 당직 루프
    expect(tools).toHaveLength(14);
    const prem = tools.find((t) => t.name === 'argus_premises')!;
    const schema = JSON.stringify(prem.inputSchema);
    expect(schema).toContain('"add"'); // op enum made it through z.toJSONSchema
    expect(schema).toContain('ai_original');
  });

  it('walks the journey: seal(+promotion) → add → due_note piggyback → recheck baseline → recall', async () => {
    // seal with a named assumption → promoted premise P1
    const sealRes = structured(await client.callTool({
      name: 'argus_seal',
      arguments: {
        argus_dir: dir, id: 'rt1', predicate: 'the cutover ships with no visible outage',
        check_by: '2026-09-01', predicate_owner: 'user',
        unverified_assumption: 'the index rebuild fits the replication lag budget',
        today_override: ADDED,
      },
    }));
    expect(sealRes['ok']).toBe(true);
    expect((sealRes['data'] as Record<string, unknown>)['premise_promoted']).toBe('P1');

    // add a monitored premise (a month ago, so it's due by TODAY)
    const addRes = structured(await client.callTool({
      name: 'argus_premises',
      arguments: {
        argus_dir: dir, id: 'rt1', op: 'add', today_override: ADDED,
        premises: [{ text: 'base rate stays at 3.5%', kind: 'premise', external: true, load_bearing: true, source: 'ai', ai_original: 'base rate stays at 3.5%' }],
      },
    }));
    expect(addRes['ok']).toBe(true);

    // an unrelated later call carries the dispatcher-level due_note (the return loop)
    const bearing = structured(await client.callTool({ name: 'argus_recall', arguments: { argus_dir: dir, view: 'bearing', today_override: TODAY } }));
    expect(String((bearing['data'] as Record<string, unknown>)['due_note'])).toContain('premise fact(s) to re-check');
    expect(bearing['next_actions']).toContain('argus_check_in');

    // recheck: baseline, provenance-tagged
    const rc = structured(await client.callTool({
      name: 'argus_recheck',
      arguments: { argus_dir: dir, id: 'rt1', ref: 'P2', finding: 'base rate 3.5%', numeric_value: 3.5, source: 'url', source_detail: 'https://bok.example', today_override: TODAY },
    }));
    expect((rc['data'] as Record<string, unknown>)['baseline_only']).toBe(true);

    // recall premises: both premises, provenance + staleness rendered
    const prems = structured(await client.callTool({ name: 'argus_recall', arguments: { argus_dir: dir, view: 'premises', id: 'rt1', today_override: TODAY } }));
    const rows = (prems['data'] as Record<string, unknown>)['premises'] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r['ref'])).toEqual(['P1', 'P2']);
  });

  it('serves argus://premises/due as an auto-injectable resource', async () => {
    const res = await client.readResource({ uri: 'argus://premises/due' });
    const payload = JSON.parse((res.contents[0] as { text: string }).text) as Record<string, unknown>;
    // P1 (promoted, external=false) is not monitored; P2 was baselined today → not due yet.
    expect(payload['group_count']).toBe(0);
    expect(payload).toHaveProperty('groups');
  });

  it('the settle ritual prompt carries the recheck choreography when premises are due', async () => {
    // a second decision with a never-checked monitored premise → due
    await client.callTool({ name: 'argus_seal', arguments: { argus_dir: dir, id: 'rt2', predicate: 'second bet holds through the quarter', check_by: '2026-10-01', predicate_owner: 'user', today_override: ADDED } });
    await client.callTool({ name: 'argus_premises', arguments: { argus_dir: dir, id: 'rt2', op: 'add', today_override: ADDED, premises: [{ text: 'supply stays constrained', kind: 'premise', external: true, load_bearing: true, source: 'user' }] } });

    const prompt = await client.getPrompt({ name: 'argus-settle', arguments: {} });
    const text = (prompt.messages[0].content as { text: string }).text;
    expect(text).toContain('argus_recheck');
    expect(text).toContain('supply stays constrained');
  });

  it('schema violations come back as clean tool errors over the wire', async () => {
    const res = await client.callTool({ name: 'argus_premises', arguments: { argus_dir: dir, id: 'rt1', op: 'nonsense' } });
    expect(res.isError).toBe(true);
    expect((res.content as Array<{ text: string }>)[0].text).toContain('INVALID_INPUT');
    expect((res.content as Array<{ text: string }>)[0].text).toContain('recovery');
  });

  // M3 acceptance (coordinator repro): the FULL open_question reconsider journey
  // through the REAL dispatch — zod validation + the over-fire gate + replay —
  // NOT the direct-handler path (which bypasses both). This is the path that
  // actually failed the dist smoke: open_decision must FIRE (write the harvest)
  // for premise_add to be legal, then the anchored reconsider clock must make
  // check_in AND recall agree the question is due weeks later.
  it('M3: open_decision(fires) → add open_question → seal → check_in surfaces the reconsider (count==1, == recall)', async () => {
    // A high-stakes, one-way-door decision so the restraint gate FIRES and the
    // harvest is written (a low-stakes/reversible one returns restraint, writes
    // no harvest, and premise_add would then be ILLEGAL_TRANSITION from absent).
    const od = structured(await client.callTool({
      name: 'argus_open_decision',
      arguments: {
        argus_dir: dir, id: 'm3', decision: '지분 어떻게 나눌지 결정',
        stakes: 'high', reversibility: 'one_way_door', status_quo: '현행 지분 유지',
        today_override: '2026-07-03',
      },
    }));
    expect(od['ok']).toBe(true);
    expect((od['data'] as Record<string, unknown>)['harvest_written']).toBe(true);

    // add the open_question the user leaves unresolved (anchor = today_override)
    const add = structured(await client.callTool({
      name: 'argus_premises',
      arguments: {
        argus_dir: dir, id: 'm3', op: 'add', today_override: '2026-07-03',
        premises: [{ text: '지분 미정 상태', kind: 'open_question', source: 'user' }],
      },
    }));
    expect(add['ok']).toBe(true);

    // seal the decision (arms the nudge)
    const sl = structured(await client.callTool({
      name: 'argus_seal',
      arguments: { argus_dir: dir, id: 'm3', predicate: '3개월 내 지분 합의 완료', check_by: '2026-10-03', predicate_owner: 'user', today_override: '2026-07-03' },
    }));
    expect(sl['ok']).toBe(true);

    // 23 days later: recall says due, and check_in MUST agree (count == 1) with
    // the user's own words in the surface. This is the exact assertion that was
    // failing against the dist smoke.
    const rec = structured(await client.callTool({ name: 'argus_recall', arguments: { argus_dir: dir, view: 'premises', id: 'm3', today_override: '2026-07-26' } }));
    const q = ((rec['data'] as Record<string, unknown>)['premises'] as Array<Record<string, unknown>>)[0];
    expect(q['next_reponder_due']).toBe('2026-07-24'); // 2026-07-03 + 21d
    expect(q['due_for_reconsider']).toBe(true);

    const ci = structured(await client.callTool({ name: 'argus_check_in', arguments: { argus_dir: dir, today_override: '2026-07-26' } }));
    expect((ci['data'] as Record<string, unknown>)['due_open_question_count']).toBe(1);
    expect(String(ci['surface'])).toContain('지분 미정 상태');
    expect(String(ci['surface'])).toContain('argus_premises');

    // still_open defers: silent the next day, re-emerges after the cadence.
    const so = structured(await client.callTool({ name: 'argus_premises', arguments: { argus_dir: dir, id: 'm3', op: 'still_open', ref: 'P1', today_override: '2026-07-26' } }));
    expect(so['ok']).toBe(true);
    const quiet = structured(await client.callTool({ name: 'argus_check_in', arguments: { argus_dir: dir, today_override: '2026-07-27' } }));
    expect((quiet['data'] as Record<string, unknown>)['due_open_question_count']).toBe(0);
    const back = structured(await client.callTool({ name: 'argus_check_in', arguments: { argus_dir: dir, today_override: '2026-08-17' } }));
    expect((back['data'] as Record<string, unknown>)['due_open_question_count']).toBe(1);

    // resolve closes it for good — gone from both surfaces.
    const rs = structured(await client.callTool({ name: 'argus_premises', arguments: { argus_dir: dir, id: 'm3', op: 'resolve', ref: 'P1', decision: '창업자 60/40', today_override: '2026-08-17' } }));
    expect(rs['ok']).toBe(true);
    const gone = structured(await client.callTool({ name: 'argus_check_in', arguments: { argus_dir: dir, today_override: '2026-09-01' } }));
    expect((gone['data'] as Record<string, unknown>)['due_open_question_count']).toBe(0);
  }, 20000);
});
