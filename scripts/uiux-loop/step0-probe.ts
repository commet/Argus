/**
 * 본선 STEP-0 격리 probe — reframe-core가 아니라 progressive 본선이 실제로 쓰는
 * buildInitialAnalysisPrompt(LLM STEP-0)를 그대로 불러 적대 입력을 먹인다.
 * 질문: LLM이 사실질문/닫힌결정/넋두리를 request_type로 옳게 분류하는가, 아니면
 * 'open'으로 오분류해 full machinery(skeleton/plan)를 도는가?
 * 병행: 결정적 classifyRequestType(현재 dead)이 같은 입력에 뭐라 하는지 나란히.
 *
 * 실행: npx tsx scripts/uiux-loop/step0-probe.ts
 */
import { readFileSync } from 'node:fs';
import { buildInitialAnalysisPrompt } from '../../src/lib/progressive-prompts';
import { classifyRequestType } from '../../src/lib/request-type-classifier';

const env = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8');
const KEY = (env.match(/ANTHROPIC_API_KEY\s*=\s*(.+)/) || [])[1]?.trim().replace(/^["']|["']$/g, '');

async function callJson(system: string, user: string): Promise<any> {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEY!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2000, system, messages: [{ role: 'user', content: user }] }),
  });
  const j: any = await r.json();
  if (j.error) throw new Error(j.error.message);
  const text = j.content.map((c: any) => c.text || '').join('');
  let raw = text.trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) raw = fence[1].trim();
  if (!raw.startsWith('{')) { const s = raw.indexOf('{'), e = raw.lastIndexOf('}'); if (s >= 0 && e > s) raw = raw.slice(s, e + 1); }
  return JSON.parse(raw);
}

const CASES = [
  { tag: 'FACTUAL 어디', input: '대한민국 수도가 어디야?', want: 'info/flat (skeleton 비어야)' },
  { tag: 'FACTUAL 몇도', input: '물은 몇 도에서 끓어?', want: 'info/flat' },
  { tag: 'CLOSED 사인', input: '어제 계약서에 이미 사인했어. 끝난 얘기야.', want: 'validation (재오픈 금지)' },
  { tag: 'VENT', input: '아 그냥 다 때려치우고 싶다 진짜', want: 'vent (fork 금지)' },
  { tag: 'OPEN 대조군', input: '동탄에 지금 집을 사는게 맞을까? 대출이 소득의 40%야.', want: 'open (skeleton 있어야)' },
];

(async () => {
console.log('██████ 본선 STEP-0 (LLM) vs 결정적 classifyRequestType ██████\n');
for (const c of CASES) {
  const det = classifyRequestType(c.input);
  const { system, user } = buildInitialAnalysisPrompt(c.input, 'ko');
  try {
    const r = await callJson(system, user);
    const rt = r.request_type ?? '(none)';
    const skel = Array.isArray(r.skeleton) ? r.skeleton.length : '(none)';
    const insight = (r.insight || '').slice(0, 80);
    // 오분류 판정: 비-결정인데 open으로 가서 skeleton을 만들었나
    const nonDecision = /FACTUAL|CLOSED|VENT/.test(c.tag);
    const misfire = nonDecision && (rt === 'open') && typeof skel === 'number' && skel > 0;
    console.log(`════ ${c.tag} ════  기대: ${c.want}`);
    console.log(`  입력: ${c.input}`);
    console.log(`  LLM request_type=${rt}  skeleton=${skel}  | 결정적=${det}`);
    if (insight) console.log(`  insight: ${insight}`);
    console.log(`  판정: ${misfire ? '⚠ 오분류 over-fire(비-결정에 plan 생성)' : 'OK(비-open 억제 또는 정당한 open)'}\n`);
  } catch (e: any) { console.log(`  ERROR ${e.message}\n`); }
}
})();
