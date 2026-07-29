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
    expect(JSON.stringify(tools.map((tool) => tool.inputSchema))).not.toContain('"description":');
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
