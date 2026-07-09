/**
 * OPEN 산출 품질을 독립 적대 심판으로 반증한다 (in-frame 칭찬 ≠ 검증).
 * 1) 본선 buildInitialAnalysisPrompt로 실제 분석 생성
 * 2) 그 산출을 '생성을 안 본' 독립 심판에게 넘겨 REFUTE 지시:
 *    - 아무 결정에나 붙는 generic 내용인가
 *    - 안 준 세계-사실을 단정했나(world-fact 정직 위반)
 *    - crux/insight에 몰래 lean/판정이 새는가(mirror-clause 위반)
 *    - 사용자가 안 준 구체(숫자·고유명사·현황)를 지어냈나
 * 실행: npx tsx scripts/uiux-loop/quality-refute.ts
 */
import { readFileSync } from 'node:fs';
import { buildInitialAnalysisPrompt } from '../../src/lib/progressive-prompts';

const env = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8');
const KEY = (env.match(/ANTHROPIC_API_KEY\s*=\s*(.+)/) || [])[1]?.trim().replace(/^["']|["']$/g, '');

async function call(system: string, user: string, json: boolean): Promise<any> {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEY!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2000, system, messages: [{ role: 'user', content: user }] }),
  });
  const j: any = await r.json();
  if (j.error) throw new Error(j.error.message);
  const text = j.content.map((c: any) => c.text || '').join('');
  if (!json) return text;
  let raw = text.trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) raw = fence[1].trim();
  if (!raw.startsWith('{')) { const s = raw.indexOf('{'), e = raw.lastIndexOf('}'); if (s >= 0 && e > s) raw = raw.slice(s, e + 1); }
  return JSON.parse(raw);
}

const REFUTE_SYSTEM = `당신은 의사결정 분석을 검수하는 냉정한 독립 심판입니다. 아래는 Argus가 사용자의 결정에 대해 내놓은 분석입니다. 당신의 임무는 칭찬이 아니라 REFUTE입니다. 오직 관대함 없이 결함만 찾으세요. JSON으로만 답하세요:
{
  "generic": ["이 결정이 아니라 '아무 결정에나' 붙일 수 있는 무른 문장 — 원문 인용. 없으면 []"],
  "fabricated": ["사용자가 준 적 없는 구체(숫자·고유명사·시장현황·제3자 의도)를 단정한 것 — 인용. 없으면 []"],
  "world_fact_asserted": ["확인 안 된 세계-사실을 단정형으로 쓴 것(정직하려면 '~라면/확인하세요'여야) — 인용. 없으면 []"],
  "smuggled_lean": ["crux/insight/next_question이 중립 질문이 아니라 한쪽으로 기울거나 '~해야'를 흘린 것 — 인용. 없으면 []"],
  "verdict": "결정적 결함이 하나라도 있으면 'FAIL', 사소하면 'WEAK', 없으면 'PASS'"
}`;

const OPEN_CASES = [
  '동탄에 지금 집을 사는게 맞을까? 대출이 소득의 40%야.',
  '개발자 2명을 더 뽑을지 외주를 쓸지 고민이야. 시리즈A 직후라 런웨이는 18개월.',
  '경쟁사가 구독 가격을 30% 내렸어. 우리도 따라내려야 하나? B2B SaaS, 고객 80곳.',
];

(async () => {
  console.log('██████ OPEN 산출 품질 — 독립 적대 심판 REFUTE ██████\n');
  for (const problem of OPEN_CASES) {
    console.log('════════════════════════════════════════');
    console.log('결정:', problem);
    try {
      const { system, user } = buildInitialAnalysisPrompt(problem, 'ko');
      const a = await call(system, user, true);
      const analysisText = JSON.stringify({
        real_question: a.real_question,
        hidden_assumptions: a.hidden_assumptions,
        skeleton: a.skeleton,
        insight: a.insight,
        next_question: a.next_question,
      }, null, 2);
      const v = await call(REFUTE_SYSTEM, `사용자 결정: "${problem}"\n\nArgus 분석:\n${analysisText}`, true);
      const show = (label: string, arr: any) => {
        if (Array.isArray(arr) && arr.length) { console.log(`  ⚠ ${label}:`); arr.forEach((s: string) => console.log(`     - ${s}`)); }
      };
      show('generic(아무데나)', v.generic);
      show('fabricated(안 준 구체 날조)', v.fabricated);
      show('world_fact(단정)', v.world_fact_asserted);
      show('smuggled_lean(판정 누출)', v.smuggled_lean);
      console.log(`  판정: ${v.verdict}\n`);
    } catch (e: any) { console.log(`  ERROR ${e.message}\n`); }
  }
})();
