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
    // 두갈래 포크: 명시 vs/택일 어휘 OR "A인가[,]? 아니면 B(인가|일까|하는가)" 문형
    if (/\bvs\b|둘 중|택일|골라(라|야)|중 하나를 (골|선택)/.test(crux)
        || /인가[,\s]*아니면[\s\S]*?(인가|일까|하는가|는가)\s*\?/.test(crux))
      flags.push('두갈래 포크 프레이밍');
    console.log('  스파인:', flags.length ? '⚠ ' + flags.join(', ') : 'OK(질문형·중립)');
  } catch (e) { console.log('  ERROR', e.message); }
}
