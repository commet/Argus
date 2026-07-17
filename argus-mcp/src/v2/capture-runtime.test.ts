import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { registerRepository, readLedger } from './ledger.js';
import { drainCaptureOnCheckIn } from './capture-runtime.js';
import { enqueue, readQueue } from './queue.js';

let home: string;
let repo: string;
let dataDir: string;
let repositoryId: string;
let oldHome: string | undefined;
let oldData: string | undefined;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-capture-runtime-home-'));
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-capture-runtime-repo-'));
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-capture-runtime-data-'));
  fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  fs.mkdirSync(path.join(repo, '.argus'), { recursive: true });
  repositoryId = registerRepository(home, path.join(repo, '.git'));
  oldHome = process.env['ARGUS_HOME'];
  oldData = process.env['CLAUDE_PLUGIN_DATA'];
  process.env['ARGUS_HOME'] = home;
  process.env['CLAUDE_PLUGIN_DATA'] = dataDir;
});

afterEach(() => {
  if (oldHome === undefined) delete process.env['ARGUS_HOME'];
  else process.env['ARGUS_HOME'] = oldHome;
  if (oldData === undefined) delete process.env['CLAUDE_PLUGIN_DATA'];
  else process.env['CLAUDE_PLUGIN_DATA'] = oldData;
  for (const dir of [home, repo, dataDir]) fs.rmSync(dir, { recursive: true, force: true });
});

function transcript(): string {
  const file = path.join(repo, 'session.jsonl');
  fs.writeFileSync(file, JSON.stringify({
    type: 'user',
    message: { role: 'user', content: '저장 계층은 postgres로 가기로 했다.' },
  }) + '\n');
  return file;
}

describe('production check-in capture consumer', () => {
  it('drains one opted-in queue item through the canonical capture writer', async () => {
    fs.writeFileSync(path.join(home, 'config.json'), JSON.stringify({ harvest: { opt_in: true } }));
    enqueue(dataDir, {
      itemId: 'harvest-session-1', transcriptPath: transcript(), sessionId: 'session-1',
    }, '2026-07-18T01:00:00.000Z');

    const status = await drainCaptureOnCheckIn(path.join(repo, '.argus'), '2026-07-18');

    expect(status).toMatchObject({
      enabled: true,
      consumer: 'check_in_bounded',
      queue_counts: { succeeded: 1 },
      last_drain: { ran: true, candidates_created: 1, failed: false },
    });
    expect(readQueue(dataDir).items[0]?.status).toBe('succeeded');
    expect(readLedger(home, repositoryId).events.filter((event) => event.event === 'candidate_created')).toHaveLength(1);
  });

  it('opt-out reports status but leaves queued work untouched', async () => {
    enqueue(dataDir, {
      itemId: 'harvest-session-2', transcriptPath: transcript(), sessionId: 'session-2',
    }, '2026-07-18T01:00:00.000Z');

    const status = await drainCaptureOnCheckIn(path.join(repo, '.argus'), '2026-07-18');

    expect(status).toMatchObject({ enabled: false, queue_counts: { pending: 1 } });
    expect(status.last_drain).toBeUndefined();
    expect(readLedger(home, repositoryId).events).toEqual([]);
  });
});
