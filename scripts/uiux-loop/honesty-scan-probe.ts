/**
 * honesty-scan 고정밀 검증: 본선 분석을 생성 → honesty-scan을 걸어
 * (a) loop-16이 찾은 진짜 위반을 잡는가(recall), (b) 멀쩡/조건부 문장을 오탐하지
 * 않는가(precision), (c) flag.text가 산출에 verbatim 존재해 locateFlag가 찾는가.
 * 실행: npx tsx scripts/uiux-loop/honesty-scan-probe.ts
 */
import { readFileSync } from 'node:fs';
import { buildInitialAnalysisPrompt } from '../../src/lib/progressive-prompts';
import { buildHonestyScanPrompt, coerceHonestyFlags, locateFlag, HONESTY_SCAN_TOOL_NAME, HONESTY_SCAN_SCHEMA } from '../../src/lib/honesty-scan';

const env = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8');
const KEY = (env.match(/ANTHROPIC_API_KEY\s*=\s*(.+)/) || [])[1]?.trim().replace(/^["']|["']$/g, '');
if (!KEY) throw new Error('ANTHROPIC_API_KEY not found in .env.local');

async function callJson(system: string, user: string): Promise<any> {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': KEY!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2000, system, messages: [{ role: 'user', content: user }] }),
  });
  const j: any = await r.json(); if (j.error) throw new Error(j.error.message);
  let raw = j.content.map((c: any) => c.text || '').join('').trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/); if (fence) raw = fence[1].trim();
  if (!raw.startsWith('{')) { const s = raw.indexOf('{'), e = raw.lastIndexOf('}'); if (s >= 0 && e > s) raw = raw.slice(s, e + 1); }
  return JSON.parse(raw);
}
async function callTool(system: string, user: string): Promise<any> {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': KEY!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1500, system, messages: [{ role: 'user', content: user }],
      tools: [{ name: HONESTY_SCAN_TOOL_NAME, input_schema: HONESTY_SCAN_SCHEMA }], tool_choice: { type: 'tool', name: HONESTY_SCAN_TOOL_NAME } }),
  });
  const j: any = await r.json(); if (j.error) throw new Error(j.error.message);
  return j.content.find((c: any) => c.type === 'tool_use')?.input;
}

const CASES = [
  '동탄에 지금 집을 사는게 맞을까? 대출이 소득의 40%야.',
  '개발자 2명을 더 뽑을지 외주를 쓸지 고민이야. 시리즈A 직후라 런웨이는 18개월.',
  '경쟁사가 구독 가격을 30% 내렸어. 우리도 따라내려야 하나? B2B SaaS, 고객 80곳.',
];

(async () => {
  console.log('██████ honesty-scan 고정밀 검증 ██████\n');
  for (const problem of CASES) {
    console.log('════ ', problem);
    try {
      const { system, user } = buildInitialAnalysisPrompt(problem, 'ko');
      const a = await callJson(system, user);
      const rendered = [a.real_question, ...(a.hidden_assumptions || []).map((h: any) => typeof h === 'string' ? h : (h.assumption || h.point || '')), ...(a.skeleton || []), a.insight].filter(Boolean).join('\n');
      const scan = buildHonestyScanPrompt(problem, a, 'ko');
      const raw = await callTool(scan.system, scan.user);
      const flags = coerceHonestyFlags(raw);
      console.log(`  flags: ${flags.length}`);
      let located = 0, missing = 0;
      for (const f of flags) {
        const hit = locateFlag(rendered, f.text) >= 0;
        if (hit) located++; else missing++;
        console.log(`   [${f.kind}] ${hit ? '📍' : '❓NOMATCH'} "${f.text.slice(0, 55)}"`);
        console.log(`        하중: ${f.stake || '(없음 ⚠)'}`);
        if (f.where) console.log(`        확인: ${f.where}`);
        console.log(`        → 툴팁: "${(f.stake || '아직 확인 안 된 바깥 사실이에요')}${f.where ? ` — 확인: ${f.where}` : ' — 직접 확인해 보세요'}"`);
      }
      console.log(`  verbatim 매칭: ${located}/${flags.length}${missing ? ` (❓ ${missing}개 산출에 없음 — 정밀도 위험)` : ' (전부 위치 확인)'}\n`);
    } catch (e: any) { console.log(`  ERROR ${e.message}\n`); }
  }
})();
