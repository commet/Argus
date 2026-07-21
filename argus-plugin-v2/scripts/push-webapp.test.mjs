// Functional test for the webapp bridge connect flow (BLUEPRINT §9.9 V1).
// Run: node argus-plugin-v2/scripts/push-webapp.test.mjs
//
// "Would a broken wire turn red?" guard for the effortless-connect path: the
// plugin no longer takes a pasted PAT — `connect` runs an OAuth flow and stores
// the returned argus_pat_. We spin up a FAKE oauth+ingest server on 127.0.0.1
// (no internal mocking, no real network) and drive the device-code flow, which
// needs no browser. Also pins the spine restraint: a declined auto-tab is never
// re-opened, and an explicit connect clears the decline.
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const CLI = join(dirname(fileURLToPath(import.meta.url)), 'push-webapp.js');

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.error(`  FAIL ${name}`); } };

function freshProject() {
  const dir = mkdtempSync(join(tmpdir(), 'argus-push-'));
  mkdirSync(join(dir, '.argus', 'ledger'), { recursive: true });
  return dir;
}
// MUST be async spawn, not spawnSync: the fake server below runs in THIS process,
// and the child calls back into it. spawnSync would block this event loop, the
// server could never answer, and the child would deadlock (learned the hard way).
function run(cwd, args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], { cwd });
    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (status) => resolve({ status, stdout, stderr }));
    child.on('error', (e) => resolve({ status: -1, stdout, stderr: String(e) }));
  });
}
function pushConfig(cwd) {
  const p = join(cwd, '.argus', 'ledger', 'push.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
}
const declinedPath = (cwd) => join(cwd, '.argus', 'ledger', 'connect-declined');

// ── Fake Argus server: OAuth device flow + plugin ingest ───────────────────
// Tracks how many times each endpoint was hit so we can assert "no nag".
const hits = { device: 0, token: 0, ingest: 0 };
function makeServer() {
  return http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const json = (obj, code = 200) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
      if (req.url === '/api/mcp/oauth/device') {
        hits.device += 1;
        return json({ device_code: 'dev_abc', user_code: 'WXYZ-1234', verification_uri: 'http://127.0.0.1/verify', interval: 1, expires_in: 600 });
      }
      if (req.url === '/api/mcp/oauth/token') {
        hits.token += 1;
        // First poll: pending (exercise the loop). Second: mint a plugin_tokens PAT.
        if (hits.token < 2) return json({ error: 'authorization_pending' }, 400);
        return json({ access_token: 'argus_pat_faketoken1234567890', token_type: 'Bearer', scope: 'plugin', expires_at: '2099-01-01T00:00:00Z' });
      }
      if (req.url === '/api/plugin/ingest') {
        hits.ingest += 1;
        return json({ summary: { decisions: { written: 1 }, bearings: { written: 0 }, skipped: [] } });
      }
      return json({ error: 'not_found' }, 404);
    });
  });
}

const server = makeServer();
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const URL_BASE = `http://127.0.0.1:${server.address().port}`;

try {
  // 1. connect --headless: device flow saves an argus_pat_ (no browser, no paste).
  {
    const p = freshProject();
    const r = await run(p, ['connect', '--headless', '--url', URL_BASE]);
    const cfg = pushConfig(p);
    ok('connect --headless saves argus_pat_ credential', !!cfg && typeof cfg.token === 'string' && cfg.token.startsWith('argus_pat_'));
    ok('connect stores the given url', !!cfg && cfg.url === URL_BASE);
    ok('connect polled the token endpoint through the pending state', hits.token >= 2);
    ok('connect exits 0', r.status === 0);
    rmSync(p, { recursive: true, force: true });
  }

  // 2. Spine restraint: a prior decline makes push --ensure-connect silent (no tab).
  {
    hits.device = 0;
    const p = freshProject();
    writeFileSync(declinedPath(p), '2026-01-01T00:00:00Z');
    const r = await run(p, ['push', '--ensure-connect', '--headless', '--url', URL_BASE]);
    ok('declined + ensure-connect does NOT re-open the flow (no device hit)', hits.device === 0);
    ok('declined + ensure-connect writes no credential', pushConfig(p) === null);
    ok('declined + ensure-connect exits 0 (seal stays safe locally)', r.status === 0);
    rmSync(p, { recursive: true, force: true });
  }

  // 3. First seal: push --ensure-connect auto-connects (device) then reaches ingest.
  {
    hits.device = 0; hits.token = 0; hits.ingest = 0;
    const p = freshProject();
    writeFileSync(join(p, '.argus', 'ledger', 'ledger.jsonl'), `${JSON.stringify({ event: 'seal', id: 'x:v1', predicate: 'test', check_by: '2099-01-01', at: '2026-01-01T00:00:00Z' })}\n`);
    const r = await run(p, ['push', '--ensure-connect', '--headless', '--url', URL_BASE]);
    const cfg = pushConfig(p);
    ok('ensure-connect (no prior decline) connects and saves credential', !!cfg && cfg.token.startsWith('argus_pat_'));
    ok('ensure-connect pushes the sealed decision to ingest', hits.ingest >= 1);
    ok('ensure-connect leaves NO decline marker on success', !existsSync(declinedPath(p)));
    ok('ensure-connect exits 0', r.status === 0);
    rmSync(p, { recursive: true, force: true });
  }

  // 3b. Opt-out switch (founder correction): auto-sync is ON by default after the
  // first connect, and `--auto off` silences ONLY the automatic post-seal path;
  // an explicit /argus:push still works. `--auto on` re-enables. The connect
  // credential must survive the toggle.
  {
    const p = freshProject();
    const cfgPath = join(p, '.argus', 'ledger', 'push.json');
    writeFileSync(cfgPath, JSON.stringify({ token: 'argus_pat_existing', url: URL_BASE }));
    writeFileSync(join(p, '.argus', 'ledger', 'ledger.jsonl'), `${JSON.stringify({ event: 'seal', id: 'y:v1', predicate: 'p', check_by: '2099-01-01', at: '2026-01-01T00:00:00Z' })}\n`);

    await run(p, ['push', '--auto', 'off']);
    ok('--auto off persists auto:false in push.json', JSON.parse(readFileSync(cfgPath, 'utf8')).auto === false);
    ok('--auto off keeps the credential', JSON.parse(readFileSync(cfgPath, 'utf8')).token === 'argus_pat_existing');

    hits.ingest = 0;
    await run(p, ['push', '--ensure-connect', '--headless', '--url', URL_BASE]);
    ok('auto off → the automatic post-seal path is a silent no-op', hits.ingest === 0);

    hits.ingest = 0;
    await run(p, ['push', '--url', URL_BASE]);
    ok('auto off → an EXPLICIT push still syncs', hits.ingest >= 1);

    await run(p, ['push', '--auto', 'on']);
    ok('--auto on re-enables', JSON.parse(readFileSync(cfgPath, 'utf8')).auto === true);
    hits.ingest = 0;
    await run(p, ['push', '--ensure-connect', '--headless', '--url', URL_BASE]);
    ok('auto on → the automatic post-seal path syncs again', hits.ingest >= 1);
    rmSync(p, { recursive: true, force: true });
  }

  // 4. Explicit connect clears a prior decline (user changed their mind).
  {
    const p = freshProject();
    writeFileSync(declinedPath(p), '2026-01-01T00:00:00Z');
    hits.token = 0;
    await run(p, ['connect', '--headless', '--url', URL_BASE]);
    ok('explicit connect clears the decline marker', !existsSync(declinedPath(p)));
    ok('explicit connect saves credential', !!pushConfig(p));
    rmSync(p, { recursive: true, force: true });
  }
} finally {
  server.close();
}

console.log(`\npush-webapp: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
