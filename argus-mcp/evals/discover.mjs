#!/usr/bin/env node
/**
 * 발견 하네스 — 실제 stdio 서버를 띄우고, 호스트가 실제로 받는 elicitation
 * 페이로드(메시지+스키마)와 툴 표면/에러/로케일을 그대로 찍는다. "화면에 뭐가
 * 뜨는지"를 사람이 보듯 판단하기 위한 것 (게이트 아님).
 *   node evals/discover.mjs node <path/dist/index.js>
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';

const [cmd, ...args] = process.argv.slice(2);
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-disc-'));

let elicits = [];
let respond = () => ({ action: 'decline' });
const client = new Client({ name: 'disc', version: '1' }, { capabilities: { elicitation: {} } });
client.setRequestHandler(ElicitRequestSchema, async (req) => {
  elicits.push({ message: req.params?.message, schema: req.params?.requestedSchema });
  return respond(req.params);
});
const t = new StdioClientTransport({ command: cmd, args, env: { ...process.env, ARGUS_HOME: work } });
await client.connect(t);

const dir = path.join(work, '.argus'); fs.mkdirSync(dir, { recursive: true });
const call = async (name, a) => {
  const r = await client.callTool({ name, arguments: { argus_dir: dir, ...a } });
  const sc = r.structuredContent ?? JSON.parse(r.content?.[0]?.text ?? '{}');
  return sc;
};
const hr = (s) => console.log(`\n${'━'.repeat(70)}\n${s}\n${'━'.repeat(70)}`);
const showElicit = (label) => {
  const e = elicits[elicits.length - 1];
  if (!e) { console.log(`  (elicitation 안 뜸) — ${label}`); return; }
  console.log(`  ▸ ${label}`);
  console.log(`    message: ${JSON.stringify(e.message)}`);
  const props = e.schema?.properties ?? {};
  console.log(`    required: ${JSON.stringify(e.schema?.required ?? [])}`);
  for (const [k, v] of Object.entries(props)) {
    console.log(`    field "${k}": type=${v.type}${v.enum ? ` enum=${JSON.stringify(v.enum)}` : ''}${v.enumNames ? ` names=${JSON.stringify(v.enumNames)}` : ''}`);
    console.log(`        desc: ${JSON.stringify(v.description ?? '')}`);
  }
};

hr('1. 예측 픽커 (한국어) — keep 응답 시 페이로드 + 결과');
respond = () => ({ action: 'accept', content: { choice: 'keep' } });
elicits = [];
let r = await call('argus_predict', { id: 'ko-pred', predicate: '무료 티어 폐지 3개월 뒤, 유료 MRR이 폐지 직전 달 대비 늘어 있다', check_by: '2026-11-30', predicate_owner: 'ai_surfaced' });
showElicit('예측 확인 픽커 (KO)');
console.log(`    → 결과: status=${r?.data?.status} owner=${r?.data?.predicate_owner}`);

hr('2. 예측 픽커 (영어)');
respond = () => ({ action: 'decline' });
elicits = [];
await call('argus_predict', { id: 'en-pred', predicate: 'signup conversion passes 5% within two weeks', check_by: '2026-09-01', predicate_owner: 'ai_surfaced' });
showElicit('예측 확인 픽커 (EN)');

hr('3. 전제(capture) 픽커 (한국어)');
await call('argus_capture', { action: 'open', id: 'ko-dec', decision: '무료 티어를 다음 달에 폐지', stakes: 'high', reversibility: 'easily_reversible', status_quo: '무료 유지' });
respond = () => ({ action: 'decline' });
elicits = [];
await call('argus_capture', { action: 'add_context', id: 'ko-dec', premises: [{ text: '무료 사용자가 압박받으면 유료로 전환된다', kind: 'premise', external: true, load_bearing: true, source: 'ai_surfaced', ai_original: '무료 사용자가 압박받으면 유료로 전환된다' }] });
showElicit('전제 확인 픽커 (KO)');

hr('4. 정산(resolve) 결과 픽커 (한국어)');
respond = () => ({ action: 'decline' });
elicits = [];
await call('argus_resolve', { id: 'ko-pred' });
showElicit('정산 결과 픽커 (KO)');

hr('5. 첫 실행 온보딩 표면 (빈 원장)');
const work2 = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-fresh-'));
const dir2 = path.join(work2, '.argus'); fs.mkdirSync(dir2, { recursive: true });
const fr = await client.callTool({ name: 'argus_check_in', arguments: { argus_dir: dir2 } });
const frsc = fr.structuredContent ?? JSON.parse(fr.content?.[0]?.text ?? '{}');
console.log(`  surface: ${JSON.stringify(frsc?.surface)}`);
console.log(`  next_actions: ${JSON.stringify(frsc?.next_actions)}  picker=${frsc?.data?.picker}`);

hr('6. 에러 회복 품질 — 과거 날짜 예측');
const e1 = await call('argus_predict', { id: 'bad-date', predicate: 'this ships fine and works', check_by: '2020-01-01', predicate_owner: 'user' });
console.log(`  code=${e1?.error_code}\n  message=${JSON.stringify(e1?.message)}\n  recovery=${JSON.stringify(e1?.recovery)}`);

hr('7. 에러 회복 품질 — 검증불가(vibe) 예측');
const e2 = await call('argus_predict', { id: 'vibe', predicate: '느낌이 좋다', check_by: '2026-12-01', predicate_owner: 'user' });
console.log(`  code=${e2?.error_code}\n  message=${JSON.stringify(e2?.message)}\n  recovery=${JSON.stringify(e2?.recovery)}`);

hr('8. reword 왕복 — 폼에 쓴 문장이 그대로 저장되나 (KO)');
respond = () => ({ action: 'accept', content: { choice: 'reword', your_wording: '무료 폐지 뒤 3개월 안에 유료 전환율이 두 배가 된다' } });
elicits = [];
const rw = await call('argus_predict', { id: 'rw-pred', predicate: 'conversion doubles', check_by: '2026-12-31', predicate_owner: 'ai_surfaced' });
console.log(`  → predicate="${rw?.data?.predicate}" owner=${rw?.data?.predicate_owner} status=${rw?.data?.status}`);

await client.close();
console.log('\n발견 하네스 끝.');
