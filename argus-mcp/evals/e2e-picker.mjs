#!/usr/bin/env node
/**
 * 진짜 끝단(E2E) 검증 — 단위테스트가 아니라 실제 사용자 경로 그대로:
 * 실제 서버 프로세스를 stdio로 spawn하고, elicitation capability를 선언한
 * 실제 MCP 클라이언트로 다음을 실증한다:
 *  1. initialize + tools/list (서버 기동, 공개 툴 노출)
 *  2. argus_check_in → data.picker === 'one_tap' (픽커 가용성 가시화)
 *  3. argus_predict (ai_surfaced) → 서버가 elicitation 요청을 실제로 보냄
 *     → keep 응답 → sealed + owner=user
 *  4. argus_capture add_context (ai_surfaced 전제) → 전제 픽커 실제 발사
 *     → keep 응답 → 기록 + provenance ai_surfaced 유지
 *  5. reword 왕복: 폼에 쓴 문장이 그대로 user_stated로 저장
 *  6. skip: 아무것도 기록 안 됨
 * 사용법: node e2e-picker.mjs <server-command...> (예: node /path/dist/index.js)
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) { console.error('need server command'); process.exit(2); }

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-e2e-'));
const argusDir = path.join(work, '.argus');
fs.mkdirSync(argusDir, { recursive: true });

let elicitCount = 0;
// native Accept/Decline model: keep = accept w/ empty content, reword/date =
// accept w/ that field, skip = decline.
let nextResp = { action: 'accept', content: {} };
let lastElicitMessage = '';

const client = new Client({ name: 'e2e-picker', version: '1.0.0' }, { capabilities: { elicitation: {} } });
client.setRequestHandler(
  ElicitRequestSchema,
  async (req) => {
    elicitCount++;
    lastElicitMessage = String(req.params?.message ?? '');
    return nextResp;
  },
);

const transport = new StdioClientTransport({ command: cmd, args, env: { ...process.env, ARGUS_HOME: work } });
await client.connect(transport);

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

// 1. tools/list
const tools = await client.listTools();
const names = tools.tools.map((t) => t.name);
check('서버 기동 + 공개 툴 노출', ['argus_predict', 'argus_capture', 'argus_check_in', 'argus_resolve'].every((n) => names.includes(n)), names.join(','));

const callData = async (name, args2) => {
  const r = await client.callTool({ name, arguments: { argus_dir: argusDir, ...args2 } });
  const sc = r.structuredContent ?? JSON.parse(r.content?.[0]?.text ?? '{}');
  return sc;
};

// 2. check_in → picker 가시화
const ci = await callData('argus_check_in', {});
check('check_in data.picker=one_tap (호스트가 픽커 지원)', ci?.data?.picker === 'one_tap', String(ci?.data?.picker));

// 3. 예측 픽커: ai_surfaced → elicitation 실발사 → keep → sealed, owner=user
elicitCount = 0; nextResp = { action: 'accept', content: {} };
const seal = await callData('argus_predict', { id: 'e2e-pred', predicate: 'signup conversion passes 5% within two weeks', check_by: '2026-09-01', predicate_owner: 'ai_surfaced' });
check('예측 픽커 실발사 (elicitation 왕복)', elicitCount === 1, `count=${elicitCount} msg="${lastElicitMessage.slice(0, 50)}"`);
check('keep → sealed + owner=user', seal?.data?.status === 'sealed' && seal?.data?.predicate_owner === 'user', JSON.stringify({ st: seal?.data?.status, ow: seal?.data?.predicate_owner }));

// 4. 전제 픽커: open → add_context(ai_surfaced) → keep → 기록 + ai_surfaced 유지
await callData('argus_capture', { action: 'open', id: 'e2e-dec', decision: 'migrate payment routing this sprint with no rollback', stakes: 'high', reversibility: 'one_way_door', status_quo: 'keep current router' });
elicitCount = 0; nextResp = { action: 'accept', content: {} };
const prem = await callData('argus_capture', { action: 'add_context', id: 'e2e-dec', premises: [{ text: 'the old router can be re-enabled within an hour if the migration fails', kind: 'premise', external: true, load_bearing: true, source: 'ai_surfaced', ai_original: 'the old router can be re-enabled within an hour if the migration fails' }] });
check('전제 픽커 실발사', elicitCount === 1, `count=${elicitCount} msg="${lastElicitMessage.slice(0, 50)}"`);
const echo1 = prem?.data?.premises?.[0];
check('keep → 기록 + provenance ai_surfaced 유지', prem?.ok === true && echo1?.source === 'ai_surfaced', JSON.stringify(echo1 ? { src: echo1.source } : prem?.error_code));

// 5. reword 왕복: 폼 입력이 그대로 user_stated로
elicitCount = 0; nextResp = { action: 'accept', content: { reword: '옛 라우터로 1시간 안에 되돌릴 수 있다 (스위치 검증됨)' } };
const prem2 = await callData('argus_capture', { action: 'add_context', id: 'e2e-dec', premises: [{ text: 'traffic can be replayed against the new router before cutover', kind: 'premise', external: true, load_bearing: true, source: 'ai_surfaced', ai_original: 'traffic can be replayed against the new router before cutover' }] });
const echo2 = prem2?.data?.premises?.[0];
check('reword → 그 말 그대로 user_stated + ai_original 보존', echo2?.text === '옛 라우터로 1시간 안에 되돌릴 수 있다 (스위치 검증됨)' && echo2?.source === 'user_stated' && !!echo2?.ai_original, JSON.stringify(echo2 ? { t: echo2.text?.slice(0, 20), s: echo2.source } : prem2?.error_code));

// 6. skip: 기록 없음
elicitCount = 0; nextResp = { action: 'decline' };
const prem3 = await callData('argus_capture', { action: 'add_context', id: 'e2e-dec', premises: [{ text: 'the payment provider sandbox mirrors production behavior', kind: 'premise', external: true, load_bearing: true, source: 'ai_surfaced', ai_original: 'the payment provider sandbox mirrors production behavior' }] });
check('skip → 기록 안 됨 (정직한 no)', prem3?.data?.recorded === false, JSON.stringify(prem3?.data));

// 7. 날짜 조정: Accept + check_by → 문장 유지, 확인일만 이동 (그 날짜 쎄 탈출구)
elicitCount = 0; nextResp = { action: 'accept', content: { check_by: '2027-03-01' } };
const seal2 = await callData('argus_predict', { id: 'e2e-date', predicate: 'weekly active users climb above 10k', check_by: '2026-10-01', predicate_owner: 'ai_surfaced' });
check('날짜 조정 → 문장 유지 + 확인일 이동', seal2?.data?.status === 'sealed' && String(seal2?.data?.check_by) === '2027-03-01' && seal2?.data?.predicate === 'weekly active users climb above 10k', JSON.stringify({ cb: seal2?.data?.check_by, p: (seal2?.data?.predicate||'').slice(0,20) }));

await client.close();
const fails = results.filter((r) => !r.ok).length;
console.log(`\nE2E: ${results.length - fails} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
