/**
 * WHAT THE USER ACTUALLY SEES. Not "the resource exists" — the words and the
 * pixels. Dumps every picker exactly as a host would render it, and writes the
 * card HTML to disk so it can be opened in a real browser and looked at.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const BIN = process.argv[2];
const OUT = process.argv[3];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'surf-'));
const env = { ...process.env, ARGUS_DIR: dir, NODE_ENV: 'test' };
delete env.ARGUS_TOKEN;

const seen = [];
const c = new Client({ name: 'looker', version: '1' }, {
  capabilities: { elicitation: {}, extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } } },
});
c.setRequestHandler(ElicitRequestSchema, async (req) => {
  seen.push(req.params);
  return { action: 'decline' }; // just looking
});
await c.connect(new StdioClientTransport({ command: process.execPath, args: [BIN], env }));
const call = async (n, a) => (await c.callTool({ name: n, arguments: { argus_dir: dir, ...a } })).structuredContent ?? {};

// 1) the AI-drafted prediction confirm
await call('argus_predict', {
  id: 'p1', predicate: '신규 온보딩 개편으로 첫 주 활성화율이 도입 전보다 오른다',
  check_by: '2026-08-20', predicate_owner: 'ai_surfaced', confirm_draft: true, today_override: '2026-07-02',
});
// 2) the premise confirm
await call('argus_predict', { id: 'p2', predicate: '4분기 마진 20%를 지킨다', check_by: '2026-12-31', predicate_owner: 'user', today_override: '2026-07-02' });
await call('argus_capture', {
  id: 'p2', action: 'add_context', today_override: '2026-07-02',
  premises: [{ text: '환율이 1,400원 아래에 머문다', kind: 'premise', external: true, load_bearing: true, source: 'ai_surfaced', ai_original: '환율이 1,400원 아래에 머문다' }],
});
// 3) the out-of-band ask
await call('argus_predict', { id: 'p3', predicate: '리뉴얼 후 첫 달 재구매율이 20%를 넘는다', check_by: '2026-07-10', predicate_owner: 'user', today_override: '2026-07-02' });
await call('argus_patterns', { view: 'all', today_override: '2026-07-20' });
await sleep(1200);

for (const [i, p] of seen.entries()) {
  console.log(`\n${'━'.repeat(72)}\n【픽커 ${i + 1}】 사용자가 보는 문구\n${'━'.repeat(72)}`);
  console.log(p.message);
  const props = p.requestedSchema?.properties ?? {};
  if (Object.keys(props).length === 0) console.log('\n  (입력 칸 없음)');
  for (const [k, spec] of Object.entries(props)) {
    console.log(`\n  ▸ 칸 "${k}"${spec.enum ? ` (선택지 ${spec.enum.length}개)` : ' (자유 입력)'}`);
    console.log(`    설명: ${spec.description ?? '(없음)'}`);
    if (spec.enumNames) console.log(`    보기: ${spec.enumNames.join(' / ')}`);
  }
  console.log(`\n  필수 칸: ${JSON.stringify(p.requestedSchema?.required ?? null)}`);
}

// the card, written out so it can be opened in a browser
const read = await c.readResource({ uri: 'ui://argus/settle-picker' });
const html = String(read.contents?.[0]?.text ?? '');
// Feed it the exact awaiting_picker payload the server sends, so the page that
// opens is the page a user gets — not an empty shell.
const harness = `<!doctype html><html><head><meta charset="utf-8"><title>Argus settle card</title>
<style>html,body{margin:0;background:#0b0e13;} iframe{border:0;width:100%;height:100vh;display:block}</style></head><body>
<iframe id="f"></iframe><script>
var host = document.getElementById('f');
window.addEventListener('message', function (ev) {
  var m = ev.data; if (!m || m.jsonrpc !== '2.0') return;
  if (m.method === 'ui/initialize') {
    host.contentWindow.postMessage({ jsonrpc:'2.0', id:m.id, result:{ protocolVersion:'2026-01-26', hostContext:{ theme:'dark' } } }, '*');
    host.contentWindow.postMessage({ jsonrpc:'2.0', method:'ui/notifications/tool-input', params:{ arguments:{ argus_dir:'D:/demo/.argus', id:'ret' } } }, '*');
    host.contentWindow.postMessage({ jsonrpc:'2.0', method:'ui/notifications/tool-result', params:{ structuredContent:{ ok:true, data:{
      status:'awaiting_picker', id:'ret', predicate:'광고 ROAS가 7월 안에 300%를 회복한다',
      check_by:'2026-07-10', days_overdue:5, locale:'ko', argus_dir:'D:/demo/.argus' } } } }, '*');
  }
});
host.srcdoc = ${JSON.stringify(html)};
</script></body></html>`;
fs.writeFileSync(OUT, harness, 'utf8');
console.log(`\n\n카드 HTML 하네스: ${OUT}`);

await c.close();
fs.rmSync(dir, { recursive: true, force: true });
