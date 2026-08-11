import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { tmpArgusDir } from '../../test-helpers.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const TSX = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const SOURCE = path.join(ROOT, 'src', 'index.ts');
let client: Client;
let dir: string;

beforeAll(async () => {
  dir = tmpArgusDir();
  const env = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
  env.ARGUS_DIR = dir;
  env.ARGUS_TZ = 'UTC';
  client = new Client({ name: 'roundtrip-test', version: '0.0.0' });
  // Run source through the pinned TS loader. Packaging/executable mode has its
  // own gate; this suite owns the MCP protocol contract and must not rebuild a
  // shared dist directory while other Vitest workers are running.
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [TSX, SOURCE], env }));
}, 90_000);

afterAll(async () => {
  await client?.close();
});

function structured(result: unknown): Record<string, unknown> {
  return (result as { structuredContent: Record<string, unknown> }).structuredContent;
}

describe('MCP protocol round-trip (real server, stdio)', () => {
  it('advertises package metadata and exactly six tools', async () => {
    const pkg = JSON.parse(fs.readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')) as {
      name: string;
      version: string;
    };
    expect(client.getServerVersion()).toEqual({ name: pkg.name, version: pkg.version });
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual([
      'argus_capture',
      'argus_predict',
      'argus_check_in',
      'argus_resolve',
      'argus_patterns',
      'argus_settings',
    ]);
    expect(JSON.stringify(tools)).not.toContain('argus_record');
    expect(JSON.stringify(tools)).not.toContain('argus_premises');
    const capture = tools.find((tool) => tool.name === 'argus_capture')!;
    const captureSchema = capture.inputSchema as {
      properties?: Record<string, { description?: string; items?: { properties?: Record<string, { description?: string }> } }>;
    };
    // Concise does not mean blind: conditional provenance and companion text
    // fields keep the hints that prevent failed model calls.
    expect(captureSchema.properties?.['source']?.description).toContain('update_fact');
    expect(captureSchema.properties?.['premises']?.items?.properties?.['source']?.description).toContain('ai_surfaced');
    expect(captureSchema.properties?.['premises']?.items?.properties?.['ai_original']?.description).toContain('필수');
    const resolveSchema = tools.find((tool) => tool.name === 'argus_resolve')?.inputSchema as {
      properties?: Record<string, { description?: string }>;
    };
    expect(resolveSchema.properties?.['what_happened']?.description).toBeTruthy();
    expect(Buffer.byteLength(JSON.stringify(tools), 'utf8')).toBeLessThanOrEqual(20_000);
  });

  it('runs the core prediction and return loop', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const future = new Date();
    future.setUTCDate(future.getUTCDate() + 7);
    const prediction = structured(await client.callTool({
      name: 'argus_predict',
      arguments: {
        argus_dir: dir,
        id: 'roundtrip',
        predicate: 'the release reaches the agreed test group',
        check_by: future.toISOString().slice(0, 10),
        predicate_owner: 'user',
        today_override: today,
      },
    }));
    expect(prediction.ok).toBe(true);

    const checkIn = structured(await client.callTool({
      name: 'argus_check_in',
      arguments: { argus_dir: dir, today_override: today },
    }));
    expect(checkIn.ok).toBe(true);
    expect((checkIn.data as Record<string, unknown>).open_predictions).toBeTruthy();
  });

  it('rejects removed aliases and validates public inputs', async () => {
    const legacy = await client.callTool({ name: 'argus_premises', arguments: {} });
    expect(legacy.isError).toBe(true);
    expect((legacy.content as Array<{ text: string }>)[0]?.text).toContain('UNKNOWN_TOOL');

    const invalid = await client.callTool({ name: 'argus_predict', arguments: { predicate: 'short' } });
    expect(invalid.isError).toBe(true);
    expect((invalid.content as Array<{ text: string }>)[0]?.text).toContain('INVALID_INPUT');
  });

  it('a bad date argument hands the caller the server clock', async () => {
    // RUN8 (docs/receipts/2026-08-11-first-user-journey/): the model sent
    // check_by:"" and the refusal said only "must be YYYY-MM-DD" — the one
    // thing it already knew. A caller has no clock and cannot compute a future
    // date; the server has one. This must survive BOTH localizers, which
    // replace `recovery` from static per-locale maps.
    const bad = await client.callTool({
      name: 'argus_predict',
      arguments: { id: 'clock-probe', predicate: 'p95 latency stays under 200ms', check_by: '', predicate_owner: 'user' },
    });
    expect(bad.isError).toBe(true);
    const sc = structured(bad);
    expect(sc['error_code']).toBe('INVALID_INPUT');
    expect(String(sc['today'])).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(String(sc['recovery'])).toContain(String(sc['today']));
  });

  it('accepts a horizon for check_by and stores the resolved DATE', async () => {
    // The caller has no clock; the user said "in two weeks". What must never
    // happen is the horizon leaking past the boundary — every downstream
    // consumer (replay, receipts, calendar, the overdue sweep) compares dates
    // as strings, and a stored "+2w" would silently never come due.
    const today = new Date().toISOString().slice(0, 10);
    const expected = new Date(`${today}T12:00:00Z`);
    expected.setUTCDate(expected.getUTCDate() + 14);
    const sealed = structured(await client.callTool({
      name: 'argus_predict',
      arguments: {
        argus_dir: dir, id: 'horizon-probe',
        predicate: 'the cutover finishes with no data loss',
        check_by: '+2w', predicate_owner: 'user', today_override: today,
      },
    }));
    expect(sealed.ok).toBe(true);
    const ledger = fs.readFileSync(path.join(dir, 'ledger', 'ledger.jsonl'), 'utf8');
    const row = ledger.split(/\r?\n/).filter(Boolean)
      .map((l) => JSON.parse(l) as Record<string, unknown>)
      .find((e) => e['id'] === 'horizon-probe' && e['event'] === 'seal')!;
    expect(row['check_by']).toBe(expected.toISOString().slice(0, 10));
    expect(JSON.stringify(row)).not.toContain('+2w');
  });

  it('settling an unknown id hands back the ids that ARE saved', async () => {
    // Journey RUN A3: sealing and settling happen in different sessions, so the
    // caller no longer holds the id and reconstructs one from the predicate's
    // wording. It sealed `queue-migration-no-runtime-regressions` and settled
    // `no-major-runtime-regressions`; "never saved" reads as "your record is
    // gone" and the turn ended with the outcome unrecorded.
    const future = new Date();
    future.setUTCDate(future.getUTCDate() + 7);
    await client.callTool({
      name: 'argus_predict',
      arguments: {
        argus_dir: dir, id: 'queue-migration-no-runtime-regressions',
        predicate: 'no major runtime regressions after the cutover',
        check_by: future.toISOString().slice(0, 10), predicate_owner: 'user',
      },
    });
    const missed = await client.callTool({
      name: 'argus_resolve',
      arguments: {
        argus_dir: dir, id: 'no-major-runtime-regressions',
        outcome: 'missed', what_happened: 'failures stayed flat',
      },
    });
    expect(missed.isError).toBe(true);
    const sc = structured(missed);
    expect(sc['error_code']).toBe('NO_PRIOR_SEAL');
    const saved = (sc['data'] as Record<string, unknown>)?.['saved_ids'] as string[];
    expect(saved).toContain('queue-migration-no-runtime-regressions');
  });

  it('이미 정산된 id는 saved_ids에 들어가지 않는다', async () => {
    // 그걸 고르면 다음 호출이 ALREADY_SETTLED다. 거절이 또 다른 거절을
    // 가리키는 것은 복구가 아니다.
    // 날짜 셋이 순서대로 필요하다: 봉인 시점 → 그보다 뒤인 확인일 → 그보다 뒤인
    // 정산 시점. check_by를 today와 같게 두면 validateSeal이 봉인을 거절하고,
    // 그러면 정산될 계약이 아예 없어서 아래 단언이 공허하게 통과한다.
    const sealDay = new Date();
    sealDay.setUTCDate(sealDay.getUTCDate() - 10);
    const checkDay = new Date(sealDay);
    checkDay.setUTCDate(checkDay.getUTCDate() + 3);
    const settleDay = new Date(checkDay);
    settleDay.setUTCDate(settleDay.getUTCDate() + 2);
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    const sealed = await client.callTool({
      name: 'argus_predict',
      arguments: {
        argus_dir: dir, id: 'already-done', predicate: 'the pilot reaches twenty teams',
        check_by: iso(checkDay), predicate_owner: 'user', today_override: iso(sealDay),
      },
    });
    expect(structured(sealed)['ok']).toBe(true);
    const settled = await client.callTool({
      name: 'argus_resolve',
      arguments: {
        argus_dir: dir, id: 'already-done', outcome: 'held',
        what_happened: 'twenty-two teams', today_override: iso(settleDay),
      },
    });
    expect(structured(settled)['ok']).toBe(true);
    const missed = await client.callTool({
      name: 'argus_resolve',
      arguments: { argus_dir: dir, id: 'no-such-id', outcome: 'missed', what_happened: 'x' },
    });
    const saved = (structured(missed)['data'] as Record<string, unknown>)?.['saved_ids'] as string[];
    expect(saved).not.toContain('already-done');
  });

  it('an invalid argument with no date at fault carries no clock', async () => {
    // The date belongs in the refusals it can act on. Everywhere else it is
    // noise, and noise in an error is how the actionable line gets skimmed.
    const bad = await client.callTool({ name: 'argus_patterns', arguments: { view: 'not-a-view' } });
    expect(bad.isError).toBe(true);
    expect(structured(bad)['today']).toBeUndefined();
  });

  it('rejects an invalid nested premise before writing any part of action=open', async () => {
    const id = 'atomic-invalid-open';
    const invalid = await client.callTool({
      name: 'argus_capture',
      arguments: {
        argus_dir: dir,
        action: 'open',
        id,
        decision: 'whether to commit to the annual plan',
        stakes: 'moderate',
        reversibility: 'costly_to_reverse',
        status_quo: 'keep the monthly plan',
        premises: [{
          text: 'annual churn will be lower',
          kind: 'premise',
          source: 'ai_surfaced',
          // ai_original deliberately omitted
        }],
      },
    });
    expect(invalid.isError).toBe(true);
    expect(JSON.stringify(invalid.content)).toContain('ai_original');
    expect(fs.existsSync(path.join(dir, 'sessions', id, 'session.json'))).toBe(false);
    const ledgerPath = path.join(dir, 'ledger', 'ledger.jsonl');
    const events = fs.existsSync(ledgerPath)
      ? fs.readFileSync(ledgerPath, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as { id?: string })
      : [];
    expect(events.filter((event) => event.id === id)).toEqual([]);
  });

  it('offers one attention resource and no prompt surface', async () => {
    expect(client.getServerCapabilities()?.prompts).toBeUndefined();
    const listed = await client.listResources();
    expect(listed.resources.map((resource) => resource.uri)).toEqual([
      'argus://attention',
      'ui://argus/settle-picker',
    ]);
    const resource = await client.readResource({ uri: 'argus://attention' });
    expect(resource.contents).toHaveLength(1);
  });
});
