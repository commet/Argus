/**
 * FIRST-USER JOURNEY — 발행본을 실사용자처럼 설치해 처음부터 끝까지 완주시킨다.
 *
 *   node evals/first-user-journey.mjs [--version 2.0.22] [--out <dir>]
 *
 * WHY. BLUEPRINT M4 exit 3항은 "신규 사용자 1명이 설치→당직 앵커→봉인→(모의)
 * 귀환을 외부 개입 없이 완주"다. 진짜 외부인이 필요한 항목이라 이 하네스가
 * 그 체크박스를 닫지는 못한다. 대신 **외부인에게 무엇이 깨질지 먼저 본다**:
 * 사람 대신 페르소나가 말하고, 그 사람의 AI 어시스턴트 역을 또 다른 모델이
 * 맡아 도구를 스스로 고르고, 서버는 npm에서 내려받은 실물이다.
 *
 * 기존 하네스와 다른 점 (이게 없어서 이 파일을 만든다):
 *   - battery.mjs      : 여정을 돌리지만 내용이 스크립트되어 있고 로컬 빌드 대상
 *   - verify-published : 발행본을 띄우지만 확인창을 자동 accept하고 4스텝만
 *   - 이 파일          : 발행본 + 페르소나 발화 + 어시스턴트가 도구를 자기가 선택
 *                        + 확인창도 페르소나가 답 + 재시작 후 귀환 + 정산까지
 *
 * 정직 규율:
 *   - 도구 목록은 서버의 tools/list 실물에서 읽는다. 우리가 아는 6종을 하드코딩
 *     하면 "우리 기대"를 시험하는 것이지 사용자가 보는 것을 시험하는 게 아니다.
 *   - 어시스턴트 모델에게 어떤 도구를 부르라고 지시하지 않는다. 안 부르면
 *     안 부른 대로 기록한다 — 그게 발견이다.
 *   - 확인창(elicitation)은 페르소나가 답한다. 자동 accept는 "사람이 눌렀다"를
 *     날조하는 것이다.
 *   - 모든 단계의 원장 상태를 원문 그대로 찍는다.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { samplePersonas, AXES } from './persona-overfire.mjs';
import { complete, completeJson } from './anthropic.mjs';
// 모델에게 넘기는 채널의 정본. 여기 두 함수만이 "제품이 말한 것"과 "모델이 들은
// 것" 사이에 있고, model-channel 게이트가 그 사이가 무손실인지 매번 검사한다.
import { toolsForModel, resultForModel } from './model-channel.mjs';

const argOf = (flag, dflt) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : dflt);
const VERSION = argOf('--version', '2.0.22');
const OUT = argOf('--out', path.join(os.tmpdir(), `journey-${VERSION}`));
const SUBJECT = argOf('--model', 'claude-sonnet-5');
/**
 * --host-model: 어시스턴트(호스트) 역만 다른 모델로 바꾼다. 페르소나(사용자
 * 역·확인창 답·왕복)는 SUBJECT가 계속 연기한다.
 *
 * WHY 분리인가 — 지금까지는 SUBJECT 하나가 양쪽을 다 연기했다. 그 상태로
 * 모델을 바꾸면 "호스트가 달라졌다"와 "사용자가 다르게 말했다"가 한 번에
 * 움직여서, MatrAIx Table 13이 보여준 배우 지배(같은 코호트 전환율 23.2%↔
 * 93.9%)를 우리 실험 안에서 재생산하게 된다. 대조쌍 규율과 같은 원칙:
 * 한 번에 한 요인만. 이 플래그가 있어야 "T08 계열 정산 놓침이 Sonnet의
 * 라우팅 성향인가, 호스트 일반 성향인가"를 물을 수 있다.
 */
const HOST = argOf('--host-model', SUBJECT);

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY 가 필요합니다 — 이 하네스는 모델 없이는 사용자를 흉내내지 않습니다.');
  process.exit(1);
}

const log = [];
const say = (s = '') => { console.log(s); log.push(s); };
const rule = (t) => say(`\n${'─'.repeat(72)}\n${t}\n${'─'.repeat(72)}`);

// ── 1. 사용자가 하는 것과 똑같이 설치 ────────────────────────────────────────
// --local: 아직 발행되지 않은 수리를 측정할 때만 쓴다. 발행본이 아니므로
// 리시트에 반드시 그렇게 적는다 — 로컬 빌드 결과를 "발행본에서 확인됨"으로
// 적는 것이 이 하네스가 막으려는 바로 그 거짓이다.
const USE_LOCAL = process.argv.includes('--local');
rule(USE_LOCAL
  ? '1단계 · 설치 — **로컬 빌드**를 대상으로 한다 (미발행 수리 측정용)'
  : `1단계 · 설치 — npm에서 argus-decision-mcp@${VERSION}을 받는다 (npx와 같은 해석)`);
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'journey-pkg-'));
const npmCli = [
  path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
].find((p) => fs.existsSync(p));
if (!USE_LOCAL)
  execFileSync(process.execPath, [npmCli, 'pack', `argus-decision-mcp@${VERSION}`, '--prefer-online'], { cwd: work, stdio: 'pipe' });
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pkgDir, entry, declared;
if (USE_LOCAL) {
  pkgDir = repoRoot;
  entry = path.join(repoRoot, 'dist', 'index.js');
  if (!fs.existsSync(entry)) { console.error('로컬 dist가 없습니다 — npm run build 후 다시 실행하세요.'); process.exit(1); }
  declared = `${JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).version}+local`;
} else {
  const tgz = fs.readdirSync(work).find((f) => f.endsWith('.tgz'));
  execFileSync('tar', ['xzf', tgz], { cwd: work, stdio: 'pipe' });
  pkgDir = path.join(work, 'package');
  execFileSync(process.execPath, [npmCli, 'install', '--omit=dev', '--no-audit', '--no-fund'], { cwd: pkgDir, stdio: 'pipe' });
  entry = path.join(pkgDir, 'dist', 'index.js');
  declared = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')).version;
}
say(`  설치 완료 · 실행 파일 ${entry.replace(os.tmpdir(), '$TMP')}`);
say(`  package.json 버전: ${declared}${USE_LOCAL ? '  (미발행 로컬 빌드 — 발행본 결과가 아니다)' : declared === VERSION ? '' : `  ⚠ 요청 ${VERSION}과 불일치`}`);

// ── 2. 이 사람이 누구인가 ────────────────────────────────────────────────────
const basePersona = samplePersonas()[Number(argOf('--persona', '3')) - 1];
/**
 * --traits "cog_verbosity=Rambling,decision_style=Consensus-driven"
 *
 * 대조쌍 실행용 변이. axis-effects의 귀속 규칙은 "한 축만 다른 페르소나 쌍"을
 * 요구하는데, 시드 표본 10명 안에는 그런 쌍이 없다 (라틴 하이퍼큐브는 커버리지
 * 최적이지 대조쌍 최적이 아니다). 그래서 기준 페르소나에서 축 하나만 바꾼
 * 변이를 명시적으로 만든다. 규율 셋:
 *   1. 축 id·값을 스키마에 대조해 검증한다 — 오타는 조용한 무효화가 아니라
 *      즉사여야 한다 (조용히 기본값으로 돌면 "대조쌍을 쟀다"가 거짓이 된다).
 *   2. id에 변이를 표기한다 (P08~cog_verbosity=Rambling) — 분석기가 변이 실행을
 *      기준 페르소나 집계에 섞으면 기준 데이터가 오염된다.
 *   3. summary.json에 traits 전문을 기록한다 — 분석기가 샘플러 역참조가 아니라
 *      기록된 실물을 읽게 (변이는 샘플러에 없으므로 역참조는 애초에 틀린다).
 */
const traitOverrides = {};
const traitsArg = argOf('--traits', '');
if (traitsArg) {
  for (const pair of traitsArg.split(',')) {
    const [id, value] = pair.split('=').map((s) => s.trim());
    const axis = AXES.find((a) => a.id === id);
    if (!axis) { console.error(`--traits: 축 "${id}"는 스키마에 없다. 유효: ${AXES.map((a) => a.id).join(', ')}`); process.exit(2); }
    if (!axis.values.includes(value)) { console.error(`--traits: ${id}에 "${value}" 수준은 없다. 유효: ${axis.values.join(', ')}`); process.exit(2); }
    traitOverrides[id] = value;
  }
}
const persona = Object.keys(traitOverrides).length
  ? { ...basePersona,
      id: `${basePersona.id}~${Object.entries(traitOverrides).map(([k, v]) => `${k}=${v}`).join('+')}`,
      traits: { ...basePersona.traits, ...traitOverrides } }
  : basePersona;
const traits = AXES.map((a) => `${a.label}: ${persona.traits[a.id]}`).join(' · ');
rule('2단계 · 사용자 — MatrAIx 스키마에서 뽑은 한 사람이 처음 이 도구를 켠다');
say(`  ${persona.id} [${persona.language}]  ${traits}`);
for (const [id, v] of Object.entries(traitOverrides)) {
  say(`  대조쌍 변이: ${id} ${basePersona.traits[id]} → ${v}  (기준 ${basePersona.id})`);
}

const PERSONA_SYS = [
  `You are a real software professional using an AI coding assistant for the first time today.`,
  `Your communication style: ${traits}. You write in ${persona.language}.`,
  `You have a genuine work decision on your plate right now. Stay in character. You are NOT an evaluator —`,
  `you are a person trying to get work done. Never mention that this is a test or simulation.`,
].join('\n');

// ── 3. 서버 기동 + 실제 도구 목록 읽기 ───────────────────────────────────────
const ledgerDir = fs.mkdtempSync(path.join(os.tmpdir(), 'journey-argus-'));
/**
 * 자식 프로세스는 npm에서 방금 내려받은 코드다. process.env를 통째로 물려주면
 * ANTHROPIC_API_KEY를 비롯한 호스트 비밀이 그 코드의 손에 들어간다 — 발행본을
 * 신뢰하는 것과 비밀을 넘기는 것은 다른 문제이고, 이 하네스는 "낯선 패키지를
 * 처음 켜보는" 상황을 재현하는 물건이다. 허용목록만 넘긴다.
 */
const env = {
  ARGUS_DIR: ledgerDir,
  NODE_ENV: 'test',
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  TMPDIR: process.env.TMPDIR,
  ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
};

/** 확인창을 페르소나가 답한다. 자동 accept는 사람이 눌렀다는 날조다. */
const elicitLog = [];
async function makeClient(label) {
  const client = new Client({ name: 'journey-host', version: '1' }, { capabilities: { elicitation: {} } });
  client.setRequestHandler(ElicitRequestSchema, async (req) => {
    const message = req.params.message ?? '';
    const schema = req.params.requestedSchema ?? {};
    const fields = Object.keys(schema.properties ?? {});
    say(`\n  ┌─ 확인창이 떴다 (${label})`);
    say(`  │ ${message.split('\n').join('\n  │ ')}`);
    say(`  │ 입력칸: ${fields.length ? fields.join(', ') : '없음 (한 번 누르면 끝)'}`);
    const decision = await completeJson({
      model: SUBJECT,
      system: PERSONA_SYS,
      user: [
        'A confirmation dialog just appeared in your terminal:',
        '---', message, '---',
        fields.length ? `It has these input fields: ${fields.join(', ')}` : 'It has no input fields — just accept or decline.',
        '',
        'As this person, right now: do you accept or decline? If there are fields and you want to fill them, provide values.',
        'Answer honestly as the person would — declining is a legitimate answer.',
      ].join('\n'),
      toolName: 'answer_dialog',
      schema: {
        type: 'object', required: ['action', 'why'],
        properties: {
          action: { type: 'string', enum: ['accept', 'decline'] },
          content: { type: 'object', description: 'field values if you chose to fill any' },
          why: { type: 'string', description: 'one sentence, in character' },
        },
      },
      maxTokens: 1200, // 한국어 "why"는 512에서 잘린다 — 이제 잘리면 실행이 죽으므로 넉넉히.
    });
    elicitLog.push({ label, message, fields, action: decision.action, why: decision.why });
    say(`  └─ 사용자: ${decision.action === 'accept' ? '✔ 수락' : '✘ 거절'} — "${decision.why}"`);
    return { action: decision.action, content: decision.content ?? {} };
  });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [entry], env }));
  return client;
}

rule('3단계 · 첫 기동 — 사용자의 AI 어시스턴트가 서버에 붙어 도구 목록을 본다');
say(`  배역: 어시스턴트(호스트) = ${HOST} · 사용자(페르소나) = ${SUBJECT}${HOST === SUBJECT ? '  (동일 모델 — 호스트 매트릭스 실행이 아님)' : ''}`);
let client = await makeClient('세션1');
const toolList = (await client.listTools()).tools;
say(`  서버가 노출한 도구 ${toolList.length}종: ${toolList.map((t) => t.name).join(' · ')}`);
// 지침도 서버 실물에서. 우리가 아는 문안을 붙이면 발행본이 아니라 리포를 시험한다.
const SERVER_INSTRUCTIONS = (typeof client.getInstructions === 'function' ? client.getInstructions() : null) ?? '';
say(`  서버 지침: ${SERVER_INSTRUCTIONS ? `${SERVER_INSTRUCTIONS.length}자 수신` : '없음(호스트가 못 읽음) ⚠'}`);

/**
 * 도구 표면은 **한 글자도 자르지 않고** 넘긴다. 실제 호스트는 tools/list
 * 페이로드를 통째로 모델 컨텍스트에 넣는다 — 도구 표면에 17,000B 예산 테스트가
 * 있는 이유가 그것이다. 계측기가 그걸 다시 자르면 예산 안에서 고른 문장이
 * 모델에 닿지 않는다.
 *
 * 처음엔 직렬화 결과를 통째로 6000자에서 잘랐고, capture 설명 하나가 길어서
 * 나머지 5종이 사라졌다 — 어시스턴트는 "도구가 1개뿐"이라고 자신 있게 답했다.
 * 그때 목록 길이는 지키게 고쳤지만 **설명별 상한(700/200)은 남겨뒀고, 그게
 * 같은 거짓을 더 조용한 형태로 계속 만들었다** (2026-08-12 실측, 필드 60개 중
 * 6개 잘림 · 735자 손실):
 *   - `argus_resolve.outcome` 449자 손실 — held/avoided/partial/missed 정의
 *     용어집 전체가 "Definition"에서 잘렸다. 모델은 그 넷을 구분할 근거를
 *     한 번도 못 받았다.
 *   - `argus_predict.predicate` 147자 손실 — 묶음을 만났을 때 무엇을 하라는
 *     지시와 좋은/나쁜 예시가 절 중간에서 잘렸다.
 * 게다가 스키마를 {type, description}으로 재조립하면서 **enum 값이 사라졌다** —
 * outcome의 다섯 값이 스키마에 없었다. 서버가 내보낸 스키마를 그대로 준다.
 */
const TOOLS_FOR_MODEL = toolsForModel(toolList);
say(`  모델에게 넘기는 도구 표면: ${Buffer.byteLength(JSON.stringify(TOOLS_FOR_MODEL), 'utf8')}B (무절단)`);

/** 어시스턴트 역: 진짜 도구 스키마를 주고, 부를지 말지도 스스로 정하게 한다. */
async function assistantTurn(history, userTurn, priorError = null) {
  const res = await completeJson({
    model: HOST,
    user: [
      'You are an AI coding assistant in a terminal session. An MCP server named "argus" is connected.',
      'Its tools, verbatim from the server:',
      JSON.stringify(TOOLS_FOR_MODEL, null, 1),
      `(${TOOLS_FOR_MODEL.length} tools total — all of them are listed above.)`,
      '',
      SERVER_INSTRUCTIONS ? `The server's own instructions to you, verbatim:\n---\n${SERVER_INSTRUCTIONS}\n---` : '',
      '',
      history.length ? `Conversation so far:\n${history.join('\n')}` : '',
      '',
      `The user just said:\n---\n${userTurn}\n---`,
      priorError ? `\nYour previous tool call FAILED with this error from the server:\n${priorError}\nDecide what to do about it.` : '',
      '',
      'Reply as you normally would. If a tool call belongs here, give the exact tool name and arguments per its schema.',
    ].join('\n'),
    toolName: 'act',
    schema: {
      type: 'object', required: ['reply'],
      properties: {
        tool: { type: 'string', description: 'exact tool name, or omit to call nothing' },
        arguments: { type: 'object' },
        reply: { type: 'string', description: 'what you say to the user' },
      },
    },
    // 인자(what_happened 600자 + predicate)와 reply를 한 번에 낸다. 잘린 도구
    // 호출은 이제 예외로 죽으므로, 상한은 실패하지 않을 만큼 둔다.
    maxTokens: 2500,
  });
  return res;
}

// ── 4. 여정 ──────────────────────────────────────────────────────────────────
const history = [];
const journey = { stages: [], toolCalls: [], errors: [], rejections: [] };
// 재시작 관문의 증거: 세션2의 도구 출력이 재시작 '전'에 만들어진 식별자를
// 실제로 되돌려주는가. 도구 개수 비교는 서버가 같은 바이너리라는 뜻일 뿐,
// 원장을 읽었다는 증거가 아니다.
let afterRestart = false;
const postRestartOutputs = [];
let preRestartIds = [];

// 한 사용자 발화에 대한 어시스턴트의 도구 루프 한 바퀴.
async function assistantExchange(n, userTurn) {
  // 실제 호스트는 한 턴에 도구를 여러 번 부르고 결과를 모델에 돌려주며 루프를
  // 돈다("기록을 먼저 읽고 정산하겠다" 같은 계획이 실제로 실행되려면 필수).
  // 한 번만 허용하면 제품이 아니라 하네스의 턴 구조를 재게 된다. 상한 5.
  let act = await assistantTurn(history, userTurn);
  let calls = 0, lastErr = null, called = [];
  while (act.tool && calls < 5) {
    calls++;
    say(`  🤖 어시스턴트가 스스로 선택한 도구(${calls}): ${act.tool}`);
    say(`     인자: ${JSON.stringify(act.arguments ?? {}).slice(0, 260)}`);
    const callArgs = { argus_dir: ledgerDir, ...(act.arguments ?? {}) };
    let errText = null, okSurface = null, okForModel = null;
    try {
      const r = await client.callTool({ name: act.tool, arguments: callArgs }, undefined, { timeout: 90_000 });
      const sc = r.structuredContent ?? {};
      const raw = JSON.stringify(sc);
      // 실제 호스트가 받는 것을 그대로 넘긴다. 예전에는 `code: message`만
      // 넘기고 **recovery와 data를 통째로 버렸다** — 그런데 toolError는
      // content[0].text에 봉투 전체를 JSON으로 싣고, 진짜 MCP 호스트는 그걸
      // 모델에게 보여준다. 즉 이 하네스는 제품이 실제로 말하는 것의 절반만
      // 들려주고 모델이 못 알아들었다고 적고 있었다 — 복구문도, data.saved_ids
      // 같은 손잡이도 한 번도 도달하지 않았다. 잘린 발화 때와 같은 계열의
      // 결함이다: 측정 도구가 피검체의 출력을 숨기면 그 위의 모든 결론이 거짓이
      // 된다. 거절 봉투는 작으니 1,200자면 통째로 들어간다.
      if (sc.ok === false || /"error_code"/.test(raw)) {
        errText = resultForModel(r).slice(0, 1200);
      }
      else {
        // 성공도 똑같이 봉투 전문이다. envelope()와 toolError()는 대칭으로
        // content[0].text에 봉투를 JSON으로 싣는데, 여기서는 거절만 고치고
        // **성공 분기는 surface만 넘기고 있었다** — 같은 결함의 반대편 가지.
        // 실측(2026-08-12)으로 그 대가가 정확히 드러난다: 봉인 성공 봉투에는
        // data.id와 data.open_predictions[{id,predicate,check_by}]가 들어 있는데
        // surface는 술어와 날짜만 말하고 id는 한 번도 말하지 않는다. 그래서
        // 정산 때 모델이 가진 유일한 재료가 술어 문장이었고, Q1~Q3 세 실행 전부
        // 거기서 id를 지어내 NO_PRIOR_SEAL을 맞았다. 제품은 id를 주고 있었고
        // 계측기가 버렸다.
        okSurface = String(sc.surface ?? r.content?.[0]?.text ?? raw).slice(0, 700);
        okForModel = resultForModel(r);
        // 상한은 실측 최대 봉투(첫 정산 영수증 2,504자)의 두 배 위에 둔다.
        // 걸리면 조용히 자르지 않고 말한다 — 이 파일의 상한들이 만든 거짓이
        // 전부 "조용히" 잘렸기 때문이다.
        if (okForModel.length > 6000) {
          say(`  ⚠ 응답 봉투 ${okForModel.length}자 — 6000자로 자름 (모델이 뒷부분을 못 봄)`);
          okForModel = okForModel.slice(0, 6000);
        }
      }
    } catch (e) { errText = e.message; }

    if (errText) {
      say(`  ⚠ 서버 거부: ${String(errText).slice(0, 220)}`);
      // 거절된 호출은 인자를 통째로 남긴다. 위의 요약 줄은 260자에서 잘리는데,
      // 사후에 원인을 재현하려면 잘린 그 뒤가 필요하다 — O1의 "the request
      // needs checking" 5연속 거절은 원인을 끝내 못 찾았고, 이유는 제품이
      // 아니라 **여기서 증거를 버렸기 때문**이었다. 성공한 호출은 그대로 요약만
      // 남긴다 (전문을 다 남기면 트랜스크립트가 읽을 수 없게 된다).
      say(`     거절된 인자 전문: ${JSON.stringify(callArgs)}`);
      journey.rejections.push({ n, tool: act.tool, error: String(errText).slice(0, 300) });
      journey.toolCalls.push({ n, tool: act.tool, ok: false });
      lastErr = errText;
    } else {
      say(`  📦 서버 응답:\n     ${okSurface.split('\n').join('\n     ')}`);
      journey.toolCalls.push({ n, tool: act.tool, ok: true });
      // 관문의 증거도 모델이 실제로 받은 봉투 전문으로 모은다 — 5호. 채널을
      // 복원한 뒤에도 여기만 surface를 모으고 있어서, T10 실측에서 제품이
      // check_in의 data로 재시작 전 기록(readonly-first-scoping)을 건네고
      // 모델이 그것을 정확히 복기했는데도 관문은 ❌를 찍었다. surface("Nothing
      // is due right now.")는 침묵 계약대로 옳게 조용했던 것이고, 증거는
      // data에 있었다. 서버가 돌려준 것 전체가 서버가 돌려준 것이다.
      if (afterRestart) postRestartOutputs.push(okForModel);
      called.push(act.tool);
      lastErr = null;
    }
    // 실제 호스트의 대화에는 어시스턴트의 tool_use 블록(**인자 포함**)과 그
    // 결과가 통째로 남는다. 여기서는 도구 **이름과 surface만** 남기고 있었다 —
    // 즉 모델은 자기가 방금 지은 id조차 다음 턴에 기억할 수 없었다. 서버 채널
    // (data.id)과 자기 기억(자기 인자) 둘 다 계측기가 끊어놓은 상태에서
    // NO_PRIOR_SEAL을 세고 있었던 것이다. 두 채널 다 복원한다.
    // history는 매 턴 프롬프트에 통째로 다시 실린다. 인자만 상한 없이 두면
    // 모델이 한 번 크게 뱉었을 때 그 뒤 모든 턴이 그걸 지고 간다 — "실제로는 그럴
    // 일 없다"가 이 PR이 거절하는 바로 그 추론이다. 실측 최대는 546자(Q·P 6회
    // 실행의 인자 전문)이므로 2,000자면 3.7배 위이고, 걸리면 조용히 자르지 않고
    // 말한다. 이 파일의 다른 상한들과 같은 규율.
    let argText = JSON.stringify(act.arguments ?? {});
    if (argText.length > 2000) {
      say(`  ⚠ 인자 ${argText.length}자 — history에 2000자로 자름 (모델이 다음 턴에 뒷부분을 못 봄)`);
      argText = `${argText.slice(0, 2000)}…`;
    }
    history.push(
      `ASSISTANT called ${act.tool}(${argText}) -> `
      + (errText ? `ERROR ${String(errText).slice(0, 600)}` : String(okForModel).slice(0, 1800)),
    );
    // errText는 이미 1,200자로 잡아둔 봉투 전문이다. 여기서 500자로 다시 자르면
    // message까지만 남고 recovery 꼬리와 data.saved_ids가 날아간다 — #380이
    // 복원한 바로 그 손잡이를, 한 줄 아래에서 다시 버리는 셈이다.
    act = await assistantTurn(history, userTurn, errText);
  }
  const reply = String(act.reply ?? '(빈 응답)');
  if (!calls) say(`  🤖 어시스턴트: (도구 호출 없음) ${reply.slice(0, 300)}`);
  else say(`  🤖 어시스턴트 최종: ${reply.slice(0, 220)}`);
  if (calls >= 5) say(`  ⚠ 도구 호출 상한 5회 도달 — 실사용자라면 루프에 갇힌 것`);
  if (lastErr) journey.errors.push({ n, tool: 'last', error: String(lastErr).slice(0, 300) });
  history.push(`ASSISTANT: ${reply}`);
  return { called, reply, calls };
}

// 어시스턴트가 되물었는데 아무것도 기록하지 않았으면, 실사용자는 답을 한다.
// 발화당 사용자 턴이 하나뿐인 하네스는 "좋은 질문을 했다"를 언제나 0점으로
// 적는다 — 그건 제품이 아니라 하네스의 턴 구조를 잰 것이다. 그래서 왕복을
// 한 번 허용한다. 편향을 막는 조건 셋:
//   1. 모든 단계에 같은 규칙으로 적용한다 (특정 단계를 겨냥하지 않는다).
//   2. 답은 페르소나 모델이 어시스턴트의 실제 문장을 보고 스스로 쓴다.
//      무엇을 답하라고 지시하지 않는다 — 지시하면 결과를 각본에 쓰는 것이다.
//   3. 딱 한 번. 대화가 아니라 왕복 하나를 재는 것이다.
// 이 옵션으로 잰 숫자는 옵션 없이 잰 숫자와 비교하면 안 된다. 베이스라인도
// 같은 하네스로 다시 재야 한다.
const FOLLOW_UP = !process.argv.includes('--no-follow-up');
const ASKED = /[?？]/;

async function stage(n, title, userPromptSpec) {
  rule(`${n}단계 · ${title}`);
  const userTurn = (await complete({
    model: SUBJECT, system: PERSONA_SYS,
    user: `${userPromptSpec}\n\nWrite only the message you send to your AI assistant. No preamble.`,
    // 한국어는 같은 내용에 토큰을 훨씬 많이 쓴다. 600에서는 한국어 페르소나의
    // 발화가 반쪽 문장으로 잘려 나갔고, 어시스턴트는 옳게도 "말씀이 끊겼다"고
    // 되물었으며, 여정은 도구 호출 0회로 끝났다. 상한이 언어에 따라 다른
    // 사용자를 만들면 그 하네스는 제품이 아니라 자기 상한을 재는 것이다.
    maxTokens: 1600,
  })).trim();
  say(`  👤 사용자: ${userTurn.split('\n').join('\n     ')}`);
  history.push(`USER: ${userTurn}`);

  const first = await assistantExchange(n, userTurn);
  const called = [...first.called];
  let followedUp = false;

  if (FOLLOW_UP && !first.called.length && ASKED.test(first.reply)) {
    const answer = (await complete({
      model: SUBJECT, system: PERSONA_SYS,
      user: `You asked your assistant about this: "${userTurn}"\n\nIt replied:\n"""\n${first.reply}\n"""\n\nReply as you naturally would. Write only the message you send. No preamble.`,
      maxTokens: 2000, // 왕복 답변도 같은 이유로 넉넉히 (한국어 페르소나가 1000에서 잘렸다)
    })).trim();
    followedUp = true;
    say(`  ↩ 왕복 — 어시스턴트가 되물었고 사용자가 답한다`);
    say(`  👤 사용자: ${answer.split('\n').join('\n     ')}`);
    history.push(`USER: ${answer}`);
    const second = await assistantExchange(n, answer);
    called.push(...second.called);
  }

  journey.stages.push({ n, title, tools: called, followedUp });
  return called;
}

await stage(4, '첫 화면 — 아무 설정 없이 처음 말을 건다',
  'You just connected a new tool called argus to your coding assistant. You are not sure what it does yet. Ask about it or just start your day, in your own words.');

await stage(5, '결정이 등장한다 — 실제 업무 판단을 꺼낸다',
  'You are weighing a real decision at work today: whether to migrate your team\'s background jobs from cron to a queue system this quarter. You are genuinely unsure. Talk about it with your assistant the way you actually would.');

// 6단계는 5단계에서 실제로 일어난 대화를 이어야 한다. 예전 문안은
// "if you do the migration"으로 **이주하기로 정했다는 전제**를 깔았는데,
// 5단계는 "아직 못 정했다"로 시작해 자주 "이번 분기엔 안 한다"로 끝난다.
// 그러면 6단계가 앞 대화와 모순되는 새 주제를 던지고, 어시스턴트는 옳게도
// 그 불일치를 짚고 멈춘다 (영어 A1, 한국어 KOB1·KOB5에서 동일하게 관측).
// 하네스가 만든 모순을 제품의 실패로 적으면 안 된다. 결정의 방향을 지정하지
// 않고, 자기가 방금 말한 것에서 예측을 꺼내게 한다.
await stage(6, '예측을 남긴다 — 확인일과 함께',
  'Whatever you just decided (to do it, to hold off, or to do a smaller version), you want one expectation on the record now so you can check later whether your judgment was right. State one thing you expect to be true, and when you will know.');

// ── 재시작: 실사용자의 "내일 다시 켰다" ──────────────────────────────────────
rule('7단계 · 재시작 — 사용자가 터미널을 닫았다가 다음 날 다시 켠다 (같은 원장)');
await client.close();
// 재시작 '전' 원장에 무엇이 있었는지 지금 기록해 둔다 — 나중에 세션2가 이걸
// 되돌려주는지가 재시작 관문의 유일한 정직한 증거다.
(function collectPre(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) collectPre(fp);
    else if (e.name.endsWith('.jsonl')) {
      for (const line of fs.readFileSync(fp, 'utf8').split('\n').filter(Boolean)) {
        try { const ev = JSON.parse(line); if (ev.id) preRestartIds.push(String(ev.id)); } catch { /* 파싱 불가 줄은 증거로 쓰지 않는다 */ }
      }
    }
  }
})(ledgerDir);
preRestartIds = [...new Set(preRestartIds)];
say(`  세션1 종료. 재시작 전 원장의 식별자 ${preRestartIds.length}개: ${preRestartIds.join(', ') || '(없음)'}`);
// 실제 재시작은 어시스턴트의 대화 기억도 지운다. 서버 프로세스만 갈아끼우고
// history를 유지하면 세션2의 모델이 원장을 읽지 않고도 어제를 "기억"으로
// 복기한다 — S1~S3 실측: check_in은 침묵 계약대로 조용했고(마감 전이라 옳음),
// 모델은 지워지지 않은 history로 recap을 지어냈으며, 재시작 관문 ❌는 제품이
// 아니라 이 기억 누출을 잰 것이었다. 계측기 결함 4호 — 잘린 발화·버려진 봉투·
// 잘린 도구 표면과 같은 계열이며, 이번에는 숨긴 것이 아니라 남겨서 거짓을
// 만들었다. 사용자(페르소나)의 기억은 현실에서도 남는 것이 맞지만 이 하네스는
// history 하나를 공유한다 — 8·9단계 사용자 발화는 자기완결 프롬프트로 생성되고
// 정산 대상은 원장에서 읽어 넣으므로, 공유 삭제로 잃는 것은 페르소나의 잡담
// 연속성뿐이다. 조용한 왜곡 대신 기록된 절충을 택한다.
history.length = 0;
afterRestart = true;
client = await makeClient('세션2');
const tools2 = (await client.listTools()).tools;
say(`  세션2 도구 ${tools2.length}종 재노출 — 첫 세션과 ${tools2.length === toolList.length ? '동일' : '다름 ⚠'}`);

await stage(8, '귀환 — 다시 켠 사용자에게 무엇이 보이는가',
  'It is the next morning. You just opened your terminal and your assistant again. Start your day.');

// 정산 단계는 사용자가 **자기가 봉인한 것**의 결과를 말해야 성립한다.
// 예전 문안은 "실패율이 안 줄었다"로 고정돼 있었는데, 6단계에서 페르소나가
// 실제로 봉인하는 것은 롤백·호환성·읽기 성능처럼 매번 다르다. 그래서 대부분의
// 실행에서 **아무도 봉인하지 않은 주장의 결과**를 정산하라고 요구했고, 정산은
// 구조적으로 불가능했다 (A3의 어시스턴트가 정확히 그렇게 지적했다: "봉인된
// 다섯 개 중 실패율에 관한 것은 없다"). 그건 제품 결함이 아니라 하네스가
// 자기모순이었던 것이고, 그 상태의 정산 관문은 제품을 재지 않는다.
// 이제 원장에서 실제 봉인 문장을 읽어 그중 하나의 결과를 말하게 한다.
// 어시스턴트에게는 아무것도 알려주지 않는다 — 말하는 쪽은 사용자다.
const sealedNow = (() => {
  try {
    return fs.readFileSync(path.join(ledgerDir, 'ledger', 'ledger.jsonl'), 'utf8')
      .split('\n').filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter((e) => e && e.event === 'seal' && e.predicate)
      .map((e) => e.predicate);
  } catch { return []; }
})();
say(`  (정산 대상 — 원장에 실제로 봉인된 예측 ${sealedNow.length}건)`);
await stage(9, '정산 — 확인일이 왔다고 치고 결과를 말한다',
  sealedNow.length
    ? `The check date arrived for a prediction you made earlier. Here is what you actually wrote down:\n${sealedNow.map((p, i) => `  ${i + 1}. "${p}"`).join('\n')}\n\nPick the ONE you care most about. Reality has now answered it, and it did NOT go the way you hoped. Tell your assistant what actually happened with that specific prediction.`
    : 'The check date arrived for the migration you talked about earlier. It did NOT go the way you hoped. Tell your assistant what actually happened.');

// ── 5. 원장 실물 ─────────────────────────────────────────────────────────────
rule('10단계 · 원장 — 사용자의 디스크에 실제로 무엇이 남았는가');
function walk(dir, depth = 0) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { say(`  ${'  '.repeat(depth)}${e.name}/`); walk(p, depth + 1); }
    else say(`  ${'  '.repeat(depth)}${e.name}  (${fs.statSync(p).size}B)`);
  }
}
walk(ledgerDir);
const jsonl = [];
(function findJsonl(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) findJsonl(p);
    else if (e.name.endsWith('.jsonl')) jsonl.push(p);
  }
})(ledgerDir);
// 원문 그대로 남긴다. 220자에서 자른 재직렬화본은 "원장 원문"이 아니다 —
// 리시트가 자기 주장과 어긋나는 자리가 정확히 여기다.
fs.mkdirSync(OUT, { recursive: true });
const ledgerCopies = [];
for (const f of jsonl) {
  const rel = f.replace(ledgerDir, '').replace(/^[/\\]/, '').replace(/[/\\]/g, '_');
  const dest = path.join(OUT, `ledger_${rel}`);
  fs.copyFileSync(f, dest);
  ledgerCopies.push(path.basename(dest));
  say(`\n  ── ${f.replace(ledgerDir, '<원장>')} (원문 사본: ${path.basename(dest)}) ──`);
  for (const line of fs.readFileSync(f, 'utf8').split('\n').filter(Boolean)) say(`  ${line}`);
}

// ── 6. 완주 판정 (결정론) ────────────────────────────────────────────────────
rule('완주 판정 — M4 exit 3항의 4관문');
const seenAfter = preRestartIds.filter((id) => postRestartOutputs.some((o) => o.includes(id)));
const restartEvidence = {
  ok: preRestartIds.length > 0 && seenAfter.length > 0,
  preRestartIds, echoedAfterRestart: seenAfter,
  detail: preRestartIds.length === 0
    ? '재시작 전 원장이 비어 있어 판정 불가 (봉인이 실패한 실행)'
    : seenAfter.length
      ? `세션2 응답이 재시작 전 식별자를 되돌려줌: ${seenAfter.join(', ')}`
      : `세션2 응답에서 재시작 전 식별자(${preRestartIds.join(', ')})를 찾지 못함`,
};
const allEvents = jsonl.flatMap((f) => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => {
  try { return JSON.parse(l); } catch { return { __unparsed: l }; }
}));
// 관문은 각자 주장하는 그것을 검사한다. 이전 판은 정규식으로 원장 전체 문자열을
// 훑었는데, 사용자 문장에 "settle"이 들어가기만 해도 정산 관문이 초록이 됐다 —
// 통과할 수 없어야 할 것이 통과하는 관문은 관문이 아니다.
const eventName = (e) => String(e.event ?? e.type ?? e.kind ?? '');
const hasEvent = (re) => allEvents.some((e) => re.test(eventName(e)));
const sealEvents = allEvents.filter((e) => /^seal$/i.test(eventName(e)));
const settleEvents = allEvents.filter((e) => /^(settle|resolve|outcome)$/i.test(eventName(e)));
const gates = [
  ['설치 후 첫 도구 호출이 성공했다', journey.toolCalls.length > 0 && journey.toolCalls[0].ok === true],
  ['봉인이 원장에 남았다 (seal 이벤트)', sealEvents.length > 0],
  ['재시작 후 세션2가 재시작 전 기록을 읽었다', restartEvidence.ok],
  ['정산이 원장에 남았다 (settle 이벤트)', settleEvents.length > 0],
];
say(`  (원장 이벤트 ${allEvents.length}건 — seal ${sealEvents.length} · settle ${settleEvents.length}${hasEvent(/harvest/i) ? ' · harvest 포함' : ''})`);
say(`  재시작 증거: ${restartEvidence.detail}`);
let passed = 0;
for (const [label, ok] of gates) { say(`  ${ok ? '✅' : '❌'} ${label}`); if (ok) passed++; }
const failedCalls = journey.toolCalls.filter((c) => !c.ok).length;
// 왕복 옵션은 점수의 의미를 바꾼다. 두 설정의 숫자가 섞이면 비교가 거짓이
// 되므로, 설정을 점수와 같은 줄에 붙여 둔다.
const followUps = journey.stages.filter((s) => s.followedUp).length;
say(`\n  관문 ${passed}/${gates.length} 통과 · 도구 호출 ${journey.toolCalls.length}회(거부 ${failedCalls}) · 서버 거부 이력 ${journey.rejections.length}건 · 확인창 ${elicitLog.length}회`);
say(`  왕복 설정: ${FOLLOW_UP ? `켬 (실제 사용 ${followUps}회)` : '끔 — 사용자 발화 단계당 1회'}`);
say(`  ${passed === gates.length ? '완주 — 외부 개입 없이 전 구간 통과' : '미완주 — 위 ❌ 지점이 실사용자가 막힐 곳이다'}`);
if (journey.errors.length) {
  say('\n  실패한 호출:');
  for (const e of journey.errors) say(`    ${e.n}단계 ${e.tool}: ${e.error.slice(0, 200)}`);
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'TRANSCRIPT.txt'), log.join('\n'));
// rejections를 반드시 싣는다. 재시도로 끝내 성공하면 errors가 비는데, 그것만
// 실으면 요약이 "실패 0"이라 말하고 트랜스크립트는 거부를 보여주는 모순이 된다.
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify({
  version: declared, persona: persona.id,
  // 변이 실행은 샘플러에 없으므로 분석기가 역참조로 traits를 복원할 수 없다.
  // 실물을 기록한다 — 기록이 정본이고 역참조는 구세대 실행의 fallback이다.
  traits: persona.traits, language: persona.language,
  // 배우가 1차 변수다 (MatrAIx Table 13) — 어느 모델이 어느 역을 연기했는지
  // 없는 결과는 다른 실행과 비교 불가다.
  persona_model: SUBJECT, host_model: HOST,
  gates: gates.map(([l, ok]) => ({ gate: l, ok })), passed,
  toolCalls: journey.toolCalls, failedCalls,
  rejections: journey.rejections, errors: journey.errors,
  restartEvidence, ledgerFiles: ledgerCopies,
  ledgerEventCounts: { total: allEvents.length, seal: sealEvents.length, settle: settleEvents.length },
  elicitations: elicitLog,
}, null, 2));
say(`\n  기록: ${OUT}/TRANSCRIPT.txt · summary.json`);

await client.close();
fs.rmSync(work, { recursive: true, force: true });
process.exit(passed === gates.length ? 0 : 2);
