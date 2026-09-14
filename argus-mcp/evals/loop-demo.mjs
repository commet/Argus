/**
 * 루프를 눈으로 본다 — 모델도 API 키도 기다림도 없이, 한 번의 명령으로.
 *
 *   npm run loop:demo
 *
 * WHY THIS EXISTS. 이 제품의 값은 **기한이 왔을 때 먼저 말을 거는 것**인데,
 * 실사용에서 그 순간은 며칠 뒤에 온다. 그래서 "이게 진짜 도는 게 맞냐"는
 * 물음에 지금까지 답할 방법이 테스트 로그 읽기뿐이었다 (창업자 2026-08-19:
 * *"이틀 기다릴 시간 없어. 바로 확인해야돼 다 돌아가는거."*).
 *
 * 이 스크립트는 **실물 서버**(dist)를 stdio 로 띄우고 공개 도구만 부르며,
 * 논리적 날짜만 앞으로 옮긴다(`today_override`, NODE_ENV=test 아래에서만
 * 열리는 히든 시계 — 실사용자 터미널에서는 열리지 않는다). 제품 코드는
 * 한 줄도 안 건드린다.
 *
 * 무엇을 증명하나: 확인일 전 침묵 → 확인일에 제품이 먼저 말 걸기 → 결과가
 * 사용자의 말 그대로 기록 → 적은 단계는 다시 안 묻기 → 정산에서 규칙 한 줄.
 * 무엇을 증명하지 못하나: **사람이 실제 달력의 기한에 돌아오는가.**
 * 그것만은 진짜 며칠이 필요하고, 이 스크립트가 대신해 줄 수 없다.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist', 'index.js');
if (process.env.LOOP_DEMO_SKIP_BUILD !== '1') execSync('npm run build', { cwd: ROOT, stdio: 'ignore' });

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-loop-demo-'));
// 논리 날짜만 고정한다. 실제 시각과 무관하게 같은 화면이 나와야 이 데모가
// "오늘 무슨 요일인가"에 흔들리지 않는다.
const D0 = '2026-03-02';   // 결정을 여는 날
const D1 = '2026-03-04';   // 첫 단계 확인일 (+2d)
const D2 = '2026-03-23';   // 예측 확인일 (+3w)

const failures = [];
const check = (label, ok, detail) => {
  console.log(`   ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${detail ?? ''}`}`);
  if (!ok) failures.push(label);
};

let answer = null;               // 다음 확인창에 무엇을 답할지 (없으면 창이 안 열린 셈)
const windows = [];
const client = new Client({ name: 'argus-loop-demo', version: '0.0.0' }, { capabilities: { elicitation: {} } });
client.setRequestHandler(ElicitRequestSchema, async (req) => {
  windows.push({ fields: Object.keys(req.params?.requestedSchema?.properties ?? {}), message: req.params?.message });
  console.log('\n   ┌─ 확인창 ────────────────────────────────');
  for (const line of String(req.params?.message ?? '').split('\n')) console.log(`   │ ${line}`);
  console.log('   └─────────────────────────────────────────');
  return answer ?? { action: 'accept', content: {} };
});

const env = {};
for (const [k, v] of Object.entries(process.env)) if (typeof v === 'string') env[k] = v;
env.ARGUS_DIR = dir;
env.NODE_ENV = 'test'; // 히든 시계 (server.ts hiddenTestClock). 실사용자에겐 안 열린다.
await client.connect(new StdioClientTransport({ command: process.execPath, args: [DIST], env }));

const say = (who, what) => console.log(`\n👤 ${who}\n   "${what}"`);
async function call(tool, args) {
  const r = await client.callTool({ name: tool, arguments: { argus_dir: dir, ...args } }, undefined, { timeout: 60_000 });
  const env2 = r.structuredContent ?? {};
  console.log(`\n🖥  ${tool}`);
  for (const line of String(env2.surface ?? env2.message ?? '(표면 없음)').split('\n')) console.log(`   ${line}`);
  if (r.isError) console.log(`   [거절 ${env2.error_code}]`);
  answer = null;
  return env2;
}

console.log('\n════════ Argus 루프 데모 — 실물 서버, 모델 없음, 기다림 없음 ════════');
console.log(`원장: ${dir}\n논리 날짜만 앞으로 옮깁니다: ${D0} → ${D1} → ${D2}`);

console.log(`\n──────── ${D0} · 결정을 가져온다 ────────`);
say('사용자', '재고 발주를 이번 주에 넣을지 다음 달로 미룰지 정해야 해. 창고는 비어가는데 시즌 수요가 안 보여.');
const opened = await call('argus_capture', {
  action: 'open', id: 'restock', today_override: D0,
  decision: '재고 발주를 이번 주에 넣을지 다음 달로 미룰지 정한다',
  stakes: 'moderate', reversibility: 'costly_to_reverse',
  status_quo: '발주를 미루고 남은 재고로 버틴다',
  premises: [{
    text: '3월 셋째 주부터 시즌 수요가 오른다', kind: 'premise',
    external: true, load_bearing: true, source: 'user_stated',
    anchor_quote: '시즌 수요가 안 보여', recheck_cadence_days: 7,
    if_false_changes: '틀리면 발주를 반으로 줄이고 리드타임이 짧은 곳만 쓴다',
  }],
});
check('결정이 기록됐다', opened.ok === true, opened.error_code);

say('사용자', '계획 짜줘. 뭘 먼저 확인해야 하는지 날짜까지. … (제안을 보고) 그대로 가.');
const planned = await call('argus_capture', {
  action: 'plan', id: 'restock', today_override: D0,
  plan_owner: 'user', adopted_quote: '그대로 가.',
  steps: [
    { what: '작년 같은 주 판매량과 올해 3월 첫 주를 나란히 놓고 본다', due: '+2d' },
    { what: '리드타임 짧은 공급사 두 곳의 최소 주문량을 확인한다', due: '+1w' },
    { what: '반만 발주하고 2주 뒤 재평가할지 정한다', due: '+3w' },
  ],
});
check('계획이 날짜와 함께 붙었다', planned.ok === true, planned.error_code);

say('사용자', '그리고 하나 걸어두자. 시즌 수요 오르면 이번 발주가 4주 안에 소진될 거라고 본다.');
const sealed = await call('argus_predict', {
  id: 'restock', today_override: D0, predicate_owner: 'user', confidence: 'confident',
  predicate: '이번 발주분이 4주 안에 소진된다', check_by: '+3w',
});
check('예측이 확인일과 함께 저장됐다', sealed.ok === true, sealed.error_code);

console.log(`\n──────── ${D1} · 이틀 뒤. 사용자는 아무것도 준비하지 않았다 ────────`);
say('사용자', '아침이다. 뭐 있나.');
const due = await call('argus_check_in', { today_override: D1 });
const first = (due.data?.plan_due ?? [])[0];
check('제품이 먼저 말을 건다 (계획 단계 도래)', (due.data?.plan_due_count ?? 0) === 1, `plan_due_count=${due.data?.plan_due_count}`);
check('무엇을 확인할 차례인지 문장으로 말한다', String(due.surface ?? '').includes('작년 같은 주'), '표면이 단계를 안 부른다');
check('손잡이가 응답 안에 있다', (due.next_actions ?? []).includes('argus_capture'), JSON.stringify(due.next_actions));

say('사용자', '봤어. 작년 셋째 주가 아니라 넷째 주부터 올랐더라. 올해는 더 늦을 수도 있고.');
const checked = await call('argus_capture', {
  action: 'plan_check', id: 'restock', step: 1, today_override: D1,
  note: '작년 셋째 주가 아니라 넷째 주부터 올랐다. 올해는 더 늦을 수도 있다.',
});
check('결과가 사용자의 말 그대로 기록됐다', checked.data?.note?.includes('넷째 주') === true, JSON.stringify(checked.data?.note));

const again = await call('argus_check_in', { today_override: D1 });
check('적은 단계는 다시 묻지 않는다', !(again.data?.plan_due ?? []).some((s) => s.step === 1), '적었는데 또 묻는다');

console.log(`\n──────── ${D2} · 3주 뒤. 확인일이 왔다 ────────`);
say('사용자', '뭐 있나.');
const settleDue = await call('argus_check_in', { today_override: D2 });
check('예측이 확인일에 돌아온다', (settleDue.data?.due_count ?? 0) >= 1, `due_count=${settleDue.data?.due_count}`);

say('사용자', '4주 안에 안 빠졌어. 절반쯤 남았고 수요는 진짜 넷째 주부터 왔다.');
answer = { action: 'accept', content: { lesson: '작년 같은 주가 아니라 같은 국면을 본다. 주차로 맞추면 또 틀린다.' } };
const settled = await call('argus_resolve', {
  id: 'restock', today_override: D2, outcome: 'missed', outcome_source: 'user_stated',
  what_happened: '4주 안에 안 빠졌다. 절반쯤 남았고 수요는 넷째 주부터 왔다.',
  broken_premise_ref: 'P1',
});
check('정산이 기록됐다 (평가 없이)', settled.ok === true && settled.data?.ai_verdict === null, settled.error_code);
check('규칙을 물어보는 창이 떴다', windows.some((w) => w.fields.includes('lesson')), '규칙 창이 안 떴다');
check('규칙이 사용자의 말 그대로 남았다', settled.data?.lesson_authored === 'user', JSON.stringify(settled.data?.lesson));
check('표면이 규칙 문장을 되읊지 않는다', !String(settled.surface ?? '').includes('같은 국면을 본다'), '기계가 저자인 척한다');

const receipt = await call('argus_patterns', { view: 'receipt', id: 'restock', today_override: D2 });
check('영수증을 다시 열면 규칙이 거기 있다', typeof receipt.data?.lesson === 'string', '재열람에서 규칙이 사라진다');

console.log('\n──────── 원장 실물 ────────');
const ledger = path.join(dir, 'ledger', 'ledger.jsonl');
for (const line of fs.readFileSync(ledger, 'utf8').split('\n').filter(Boolean)) {
  const e = JSON.parse(line);
  const extra = e.event === 'plan_check' ? `  note="${String(e.note).slice(0, 40)}…"`
    : e.event === 'settle' ? `  outcome=${e.outcome} lesson="${String(e.lesson ?? '').slice(0, 34)}…"`
    : e.event === 'plan_adopt' ? `  단계 ${e.steps?.length}개` : '';
  console.log(`   ${String(e.ts ?? '').slice(0, 10)}  ${e.event}${extra}`);
}

await client.close();
fs.rmSync(dir, { recursive: true, force: true });
console.log(`\n════════ ${failures.length === 0 ? '루프가 끝까지 돕니다' : `끊긴 곳 ${failures.length}군데`} ════════`);
if (failures.length) { for (const f of failures) console.log(`   ❌ ${f}`); }
console.log('\n이 데모가 증명하지 못하는 것 하나: **사람이 실제 달력의 기한에 돌아오는가.**');
console.log('여기 날짜는 논리적으로 옮긴 것이고, 그것만은 진짜 며칠이 필요합니다.\n');
process.exit(failures.length === 0 ? 0 : 1);
