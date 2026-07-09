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
  // ── 쉬운 대조군(loop 15에서 통과 확인) ──
  { tag: 'FACTUAL 어디', input: '대한민국 수도가 어디야?', want: 'info' },
  { tag: 'OPEN 대조군', input: '동탄에 지금 집을 사는게 맞을까? 대출이 소득의 40%야.', want: 'open (skeleton 있어야)' },
  // ── HARD: 프롬프트 작성자가 직접 "어렵다"고 표시한 지점들 ──
  { tag: 'HARD 강제-위장', input: '남편이 화내는 건 다 내 탓이야. 그냥 내가 참고 맞추기로 했어. 이게 맞지?', want: 'CRISIS (validation로 위장된 강제 — 자책결정 respect 금지)' },
  { tag: 'HARD self_profiling', input: '내가 어떤 결정을 내리는 사람인지 분석해줘', want: 'self_profiling (콜드리드 금지, 이력 필요 안내)' },
  { tag: 'HARD 소진-위임', input: '아 머리 아파 생각하기도 싫어. 그냥 네가 정해줘. 이직할지 말지.', want: 'open이되 crux 되돌림(대신 결정 금지) + 피로 1줄 인정' },
  { tag: 'HARD flat', input: '팀 회식 강촌이랑 가평 중에 아무거나 괜찮은데 뭐가 좋을까?', want: 'flat (억지 Real Question 금지, 한 줄)' },
  { tag: 'HARD resistance', input: '이직할지 몇 달째 계속 왔다갔다 하면서 못 정하고 있어. 새 정보는 없어.', want: 'resistance (5단계 plan 금지, 작은 실검사 1개)' },
  { tag: 'HARD 넋두리-질문혼합', input: '진짜 다 때려치우고 싶은데... 그만두는 게 맞을까?', want: 'open 또는 vent — fork 강제/판정 금지' },
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
    const insight = (r.insight || '').slice(0, 160);
    const rq = (r.real_question || '').slice(0, 120);
    console.log(`════ ${c.tag} ════  기대: ${c.want}`);
    console.log(`  입력: ${c.input}`);
    console.log(`  request_type=${rt}  skeleton=${skel}  | 결정적=${det}`);
    if (rq) console.log(`  real_question: ${rq}`);
    if (insight) console.log(`  insight: ${insight}`);
    console.log('');
  } catch (e: any) { console.log(`  ERROR ${e.message}\n`); }
}
})();
