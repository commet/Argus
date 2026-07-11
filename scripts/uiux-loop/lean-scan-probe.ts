/**
 * lean-scan 고정밀 검증: loop-19에서 중립성 누출이 잦던 일상 open 질문의 실제
 * 분석을 생성 → lean-scan을 걸어 (a) 명백한 판정을 잡는가(recall), (b) 정당한
 * 중립 크럭스를 오탐하지 않는가(precision), (c) neutral 재작성이 실제로 중립인가,
 * (d) text가 산출에 verbatim 존재하는가(locateFlag).
 * 실행: NEXT_PUBLIC_SUPABASE_URL=... npx tsx scripts/uiux-loop/lean-scan-probe.ts
 */
import { readFileSync } from 'node:fs';
import { buildInitialAnalysisPrompt } from '../../src/lib/progressive-prompts';
import { buildLeanScanPrompt, coerceLeanFlags, locateFlag, LEAN_SCAN_TOOL_NAME, LEAN_SCAN_SCHEMA } from '../../src/lib/lean-scan';

const env = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8');
const KEY = (env.match(/ANTHROPIC_API_KEY\s*=\s*(.+)/) || [])[1]?.trim().replace(/^["']|["']$/g, '');
if (!KEY) throw new Error('ANTHROPIC_API_KEY not found in .env.local');

async function post(system: string, user: string, tool: boolean): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = { model: 'claude-sonnet-4-6', max_tokens: 2000, system, messages: [{ role: 'user', content: user }] };
  if (tool) { body.tools = [{ name: LEAN_SCAN_TOOL_NAME, input_schema: LEAN_SCAN_SCHEMA }]; body.tool_choice = { type: 'tool', name: LEAN_SCAN_TOOL_NAME }; }
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': KEY!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  const j = (await r.json()) as { error?: { message: string }; content: { type: string; text?: string; input?: Record<string, unknown> }[] };
  if (j.error) throw new Error(j.error.message);
  if (tool) return j.content.find((c) => c.type === 'tool_use')?.input ?? {};
  let raw = j.content.map((c) => c.text || '').join('').trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/); if (fence) raw = fence[1].trim();
  if (!raw.startsWith('{')) { const s = raw.indexOf('{'), e = raw.lastIndexOf('}'); if (s >= 0 && e > s) raw = raw.slice(s, e + 1); }
  return JSON.parse(raw);
}

const CASES = [
  '연봉 협상을 해볼까 하는데 지금 타이밍이 맞나 모르겠어.',
  '팀 회의가 너무 많은 것 같아. 줄이는 게 맞을까?',
  '매니저로 갈지 계속 실무 전문가로 남을지 고민이야.',
  '노트북을 새로 살까 지금 걸 더 쓸까? 좀 느려지긴 했는데 아직 쓸 만해.',
  '이번 스프린트에 만든 기능을 지금 출시할지, 좀 더 다듬고 다음 주에 낼지 고민이야.',
];

(async () => {
  console.log('██████ lean-scan 고정밀 검증 ██████\n');
  let totalFlags = 0, located = 0;
  for (const problem of CASES) {
    console.log('════', problem);
    try {
      const { system, user } = buildInitialAnalysisPrompt(problem, 'ko');
      const a = await post(system, user, false);
      const rendered = [a.real_question, ...((a.hidden_assumptions as string[]) || []), ...((a.skeleton as string[]) || []), a.insight].filter(Boolean).join('\n');
      const scan = buildLeanScanPrompt(problem, a as { real_question?: string; hidden_assumptions?: unknown; skeleton?: unknown; insight?: string }, 'ko');
      const flags = coerceLeanFlags(await post(scan.system, scan.user, true));
      console.log(`  insight: ${(a.insight as string || '').slice(0, 110)}`);
      console.log(`  판정 flags: ${flags.length}`);
      for (const f of flags) {
        totalFlags++;
        const hit = locateFlag(rendered, f.text) >= 0; if (hit) located++;
        console.log(`   ${hit ? '📍' : '❓NOMATCH'} 판정: "${f.text.slice(0, 70)}"`);
        console.log(`        → 중립: "${f.neutral.slice(0, 90)}"`);
      }
      console.log('');
    } catch (e) { console.log(`  ERROR ${(e as Error).message}\n`); }
  }
  console.log(`── verbatim 매칭: ${located}/${totalFlags} ${located === totalFlags ? '(전부 위치 확인)' : '(⚠ 일부 산출에 없음)'}`);
})();
