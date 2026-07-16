/**
 * Out-of-band elicitation SPIKE — settles the protocol-layer half of the
 * "ambient question during the user's wait" question (BLUEPRINT §9 orbit):
 *
 *   The MCP wire is bidirectional JSON-RPC and elicitation/create is a
 *   server→client REQUEST. Nothing in the spec ties it to an in-flight tool
 *   call. If that holds in the SDK, an Argus server can ask the user a premise
 *   question while their main work runs — no tool call needed at that moment.
 *
 *   node spikes/ambient-elicit/spike.mjs
 *
 * Scenarios (client side = SDK Client declaring the elicitation capability,
 * exactly what evals/elicit.mjs uses — a stand-in for a supporting host):
 *
 *   S1 UNSOLICITED  — server fires elicitInput ~200ms after initialize; the
 *                     client has never called a tool. Does it arrive?
 *   S2 AFTER-RETURN — client calls `arm`, the tool RETURNS, and ~300ms later
 *                     the server fires. Does the question arrive strictly
 *                     after the tool result was already in hand?
 *   S3 DECLINE      — out-of-band question declined by the user resolves
 *                     cleanly on the server (no hang, no crash).
 *   S4 NO-CAPABILITY— a plain client (no elicitation declared): the server's
 *                     out-of-band elicitInput must FAIL LOUD server-side
 *                     (thrown + logged), never hang or crash the connection.
 *
 * PASS here proves protocol + SDK. It does NOT prove real hosts render an
 * out-of-band picker — that needs probe-server.mjs registered in each real
 * host (see README.md). Honest structure: the two claims stay separate.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.join(HERE, 'server-oob.mjs');

let failures = 0;
function check(name, cond, detail) {
  if (!cond) failures++;
  console.log(`  ${cond ? '✓' : '✗ FAIL'} ${name}${cond ? '' : `  — ${detail ?? ''}`}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Client that answers every elicit and timestamps its arrival. */
function makeElicitingClient(responder) {
  const seen = [];
  const client = new Client({ name: 'oob-spike', version: '1' }, { capabilities: { elicitation: {} } });
  client.setRequestHandler(ElicitRequestSchema, async (req) => {
    seen.push({ at: Date.now(), message: req.params.message });
    return responder(req.params);
  });
  return { client, seen };
}

/** Collect the server's stderr JSON lines (its own log of what fired/threw). */
function tapServerLog(transport) {
  const lines = [];
  transport.stderr?.on('data', (chunk) => {
    for (const l of String(chunk).split('\n')) {
      if (!l.trim()) continue;
      try { lines.push(JSON.parse(l)); } catch { /* non-JSON stderr noise */ }
    }
  });
  return lines;
}

async function main() {
  console.log('Out-of-band elicitation spike — can the server speak first?\n');

  // S1 — unsolicited: no tool call, server fires 200ms after initialize.
  {
    const { client, seen } = makeElicitingClient(() => ({ action: 'accept', content: { answer: 'saw-it' } }));
    const transport = new StdioClientTransport({
      command: process.execPath, args: [SERVER],
      env: { ...process.env, ARGUS_SPIKE_AUTOFIRE: '200' }, stderr: 'pipe',
    });
    const slog = tapServerLog(transport);
    await client.connect(transport);
    await sleep(900);
    check('S1 unsolicited elicit ARRIVES with zero tool calls', seen.length === 1, `saw ${seen.length}`);
    const resolved = slog.find((l) => l.event === 'elicit_resolved' && l.label === 'autofire');
    check('S1 server sees the answer round-trip', resolved?.content?.answer === 'saw-it', JSON.stringify(resolved));
    await client.close();
  }

  // S2 — after-return: arm returns first, question arrives strictly later.
  {
    const { client, seen } = makeElicitingClient(() => ({ action: 'accept', content: { answer: 'saw-it' } }));
    const transport = new StdioClientTransport({ command: process.execPath, args: [SERVER], stderr: 'pipe' });
    const slog = tapServerLog(transport);
    await client.connect(transport);
    const res = await client.callTool({ name: 'arm', arguments: { delay_ms: 300 } });
    const toolReturnedAt = Date.now();
    const body = JSON.parse(res.content[0].text);
    check('S2 arm returns immediately (armed=true, no question yet)', body.armed === true && seen.length === 0, JSON.stringify({ body, seen: seen.length }));
    await sleep(900);
    check('S2 question arrives AFTER the tool result was already delivered', seen.length === 1 && seen[0].at > toolReturnedAt, JSON.stringify({ seen, toolReturnedAt }));
    const resolved = slog.find((l) => l.event === 'elicit_resolved' && l.label === 'armed');
    check('S2 server round-trips the out-of-band answer', resolved?.action === 'accept', JSON.stringify(resolved));
    await client.close();
  }

  // S3 — decline resolves cleanly (no hang / crash on the ambient path).
  {
    const { client, seen } = makeElicitingClient(() => ({ action: 'decline' }));
    const transport = new StdioClientTransport({
      command: process.execPath, args: [SERVER],
      env: { ...process.env, ARGUS_SPIKE_AUTOFIRE: '150' }, stderr: 'pipe',
    });
    const slog = tapServerLog(transport);
    await client.connect(transport);
    await sleep(800);
    const resolved = slog.find((l) => l.event === 'elicit_resolved');
    check('S3 declined out-of-band question resolves server-side (no hang)', seen.length === 1 && resolved?.action === 'decline', JSON.stringify({ seen: seen.length, resolved }));
    // Connection still alive after a decline:
    const res = await client.callTool({ name: 'arm', arguments: { delay_ms: 60_000 } });
    check('S3 connection survives (tool call still works after decline)', JSON.parse(res.content[0].text).armed === true);
    await client.close();
  }

  // S4 — plain client (no elicitation capability): server must fail LOUD, not hang.
  {
    const client = new Client({ name: 'oob-plain', version: '1' }); // no capability
    const transport = new StdioClientTransport({
      command: process.execPath, args: [SERVER],
      env: { ...process.env, ARGUS_SPIKE_AUTOFIRE: '150' }, stderr: 'pipe',
    });
    const slog = tapServerLog(transport);
    await client.connect(transport);
    await sleep(700);
    const threw = slog.find((l) => l.event === 'elicit_threw');
    const resolved = slog.find((l) => l.event === 'elicit_resolved');
    check('S4 no-capability host: elicitInput throws server-side (loud, catchable)', Boolean(threw) && !resolved, JSON.stringify({ threw, resolved }));
    const res = await client.callTool({ name: 'arm', arguments: { delay_ms: 60_000 } });
    check('S4 connection unaffected (tools keep working)', JSON.parse(res.content[0].text).armed === true);
    await client.close();
  }

  console.log(`\n${failures === 0
    ? '✅ protocol + SDK allow out-of-band elicitation — remaining unknown is per-HOST rendering (see README)'
    : `❌ ${failures} check(s) failed — out-of-band elicitation is NOT safe to build on`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
