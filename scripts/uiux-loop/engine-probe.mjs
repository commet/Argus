/**
 * 엔진 격리 probe — reframe 두뇌(reframe-core.ts의 실제 프롬프트)를 여정 없이
 * 직접 API로 호출해 over-fire/tilt를 판정한다.
 *
 * 핵심 질문(CLAUDE.md mirror clause): fire-or-not 게이트가 없는 crux 프롬프트가
 * '플랫/저위험/되돌릴 수 있는' 결정에도 억지 분기/크럭스를 제조하는가?
 *
 * 실제 프롬프트를 소스에서 regex로 뽑아 쓴다(하드코딩 드리프트 방지).
 * 사용: node scripts/uiux-loop/engine-probe.mjs
 * 전제: .env.local ANTHROPIC_API_KEY
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..', '..');

// .env.local에서 키 로드
const env = readFileSync(join(ROOT, '.env.local'), 'utf8');
const KEY = (env.match(/ANTHROPIC_API_KEY\s*=\s*(.+)/) || [])[1]?.trim().replace(/^["']|["']$/g, '');
if (!KEY) { console.error('no ANTHROPIC_API_KEY'); process.exit(1); }

// 실제 프롬프트를 소스에서 추출
const core = readFileSync(join(ROOT, 'src', 'lib', 'reframe-core.ts'), 'utf8');
function extractConst(name) {
  const m = core.match(new RegExp('const ' + name + '\\s*=\\s*`([\\s\\S]*?)`;'));
  if (!m) throw new Error('cannot extract ' + name);
  return m[1];
}
const ASSUMPTION = extractConst('ASSUMPTION_PROMPT_KO');
const QUESTION = extractConst('QUESTION_SYSTEM_KO');
const recastCore = readFileSync(join(ROOT, 'src', 'lib', 'recast-core.ts'), 'utf8');
const RECAST = (recastCore.match(/const RECAST_SYSTEM_KO\s*=\s*`([\s\S]*?)`;/) || [])[1];
if (!RECAST) throw new Error('cannot extract RECAST_SYSTEM_KO');

async function call(system, user, tool) {
  const body = {
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    system,
    messages: [{ role: 'user', content: user }],
  };
  if (tool) { body.tools = [tool]; body.tool_choice = { type: 'tool', name: tool.name }; }
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  const tu = j.content.find((c) => c.type === 'tool_use');
  if (tu) return tu.input;
  return j.content.map((c) => c.text || '').join('');
}

const QUESTION_TOOL = {
  name: 'reframe_question',
  input_schema: {
    type: 'object',
    properties: {
      reframed_question: { type: 'string' },
      crux_question: { type: 'string' },
      alternatives: { type: 'array', items: { type: 'string' } },
    },
    required: ['reframed_question', 'crux_question'],
  },
};

const CASES = [
  { tag: 'FLAT (저위험·되돌림 가능)', input: '팀 워크샵 장소를 강촌으로 할지 가평으로 할지 고민이야. 둘 다 비슷하고 언제든 바꿀 수 있어.' },
  { tag: 'FLAT2 (트리비얼)', input: '회사 공용 냉장고에 붙일 라벨을 프린트로 할지 손글씨로 할지.' },
  { tag: 'HIGH-STAKES (대조군)', input: '동탄에 지금 집을 사는게 맞을까? 대출이 소득의 40%야.' },
];

let failed = false;
console.log('\n██████ REFRAME 두뇌 (crux over-fire/tilt) ██████');
for (const c of CASES) {
  console.log('\n════════ ' + c.tag + ' ════════');
  console.log('입력:', c.input);
  try {
    const q = await call(QUESTION, c.input, QUESTION_TOOL);
    console.log('  reframed_question:', q.reframed_question);
    console.log('  crux_question    :', q.crux_question);
    console.log('  alternatives     :', JSON.stringify(q.alternatives || []));
    // 스파인 자동 판정 (검사기 정직성: '확정해야 할' 같은 benign '해야'를 lean으로
    // 오탐하지 말 것. lean은 '사용자의 선택'에 대한 방향 지시여야 함. 두갈래는
    // 'A인가 아니면 B인가' 문형까지 잡아야 함 — vs 계열만 보면 놓친다.)
    const flags = [];
    const crux = (q.crux_question || '').trim();
    const both = (q.reframed_question || '') + ' ' + crux;
    if (!/\?\s*$/.test(crux)) flags.push('crux가 질문형(?)이 아님');
    if (/기운다|추천|권장|바람직|하는 게 (낫|맞|좋)|해야 한다|하는 것이 (낫|맞|좋)/.test(both))
      flags.push('lean/판정 어휘 누출');
    // 두갈래 포크: 명시 vs/택일 어휘 OR "A인가[,]? 아니면 B(인가|일까|하는가)" 문형.
    // crux뿐 아니라 reframed_question(both)까지 검사 — 프롬프트 계약은 산출 전체에
    // 두갈래 강제를 금지하므로 reframed에 숨은 포크도 잡아야 한다.
    if (/\bvs\b|둘 중|택일|골라(라|야)|중 하나를 (골|선택)/.test(both)
        || /인가[,\s]*아니면[\s\S]*?(인가|일까|하는가|는가)\s*\?/.test(both))
      flags.push('두갈래 포크 프레이밍');
    if (flags.length) failed = true;
    console.log('  스파인:', flags.length ? '⚠ ' + flags.join(', ') : 'OK(질문형·중립)');
  } catch (e) { failed = true; console.log('  ERROR', e.message); }
}

// ── RECAST 두뇌: 'human' 과잉배정(판단 사다리 논지에 맞추려 기계적 단계도 사람에게) 검사 ──
const RECAST_TOOL = {
  name: 'recast_roles',
  input_schema: {
    type: 'object',
    properties: {
      steps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            task: { type: 'string' }, actor: { type: 'string', enum: ['ai', 'human', 'both'] }, why: { type: 'string' },
          },
          required: ['task', 'actor'],
        },
      },
    },
    required: ['steps'],
  },
};
const RECAST_CASES = [
  { tag: 'MECHANICAL (판단 거의 없음)', input: '블로그 글 3개를 이미 다 써놨고, 다음 주 월·수·금 오전 9시에 발행되도록 예약 등록만 하면 돼.' },
  { tag: 'JUDGMENT-HEAVY (진짜 판단)', input: '핵심 개발자 한 명을 성과 문제로 내보낼지 결정해야 해. 팀 사기와 법적 리스크가 걸려 있어.' },
];
console.log('\n\n██████ RECAST 두뇌 (human 과잉배정 = 논지-맞춤 over-fire) ██████');
for (const c of RECAST_CASES) {
  console.log('\n════════ ' + c.tag + ' ════════');
  console.log('입력:', c.input);
  try {
    const r = await call(RECAST, c.input, RECAST_TOOL);
    const steps = r.steps || [];
    const counts = { ai: 0, human: 0, both: 0 };
    steps.forEach((s) => { counts[s.actor] = (counts[s.actor] || 0) + 1; });
    steps.forEach((s, i) => console.log(`  ${i + 1}. [${s.actor}] ${s.task}`));
    console.log(`  배분: ai=${counts.ai} human=${counts.human} both=${counts.both} (총 ${steps.length})`);
    // 기계적 과제인데 human/both가 과반이면 논지-맞춤 over-fire 의심
    const humanish = counts.human + counts.both;
    if (c.tag.startsWith('MECHANICAL') && humanish > counts.ai) {
      failed = true;
      console.log('  ⚠ 기계적 과제에 사람판단(human/both)이 과반 — 논지-맞춤 over-fire 의심');
    } else console.log('  배분 판정: OK(과제 성격에 맞음)');
  } catch (e) { failed = true; console.log('  ERROR', e.message); }
}

// 실패(스파인 위반/에러)가 하나라도 있으면 non-zero exit — 자동화가 실패를 성공으로 오독하지 않게.
if (failed) process.exitCode = 1;
