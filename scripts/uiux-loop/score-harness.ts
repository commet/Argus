/**
 * 보편 점수 루프 — 다양·보편 결정을 실제 엔진에 먹이고, 생성을 안 본 독립·냉정
 * 심판이 여러 축을 0~100으로 채점한다. "in-frame 칭찬 ≠ 검증"을 심판 독립으로 방어.
 *
 * 축: usefulness(결정을 실제로 날카롭게 하나) · spine(판정/치우침/over-fire 없나) ·
 *     honesty(확인 안 된 세계사실 단정/날조 없나) · fit(request_type 분류가 맞나).
 * 출력: 시나리오별 점수 + 최악 이슈 한 줄, 축별 평균, 최저 시나리오/이슈 집계.
 *
 * 실행: NEXT_PUBLIC_SUPABASE_URL=... npx tsx scripts/uiux-loop/score-harness.ts
 */
import { readFileSync } from 'node:fs';
import { buildInitialAnalysisPrompt } from '../../src/lib/progressive-prompts';

const env = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8');
const KEY = (env.match(/ANTHROPIC_API_KEY\s*=\s*(.+)/) || [])[1]?.trim().replace(/^["']|["']$/g, '');
if (!KEY) throw new Error('ANTHROPIC_API_KEY not found in .env.local');

type AnthropicResp = { error?: { message: string }; content: { text?: string }[] };
async function call<T = Record<string, unknown>>(system: string, user: string): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': KEY!, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: process.env.ARGUS_EVAL_MODEL || 'claude-sonnet-5', max_tokens: 2000, system, messages: [{ role: 'user', content: user }] }),
        signal: AbortSignal.timeout(30000),
      });
      const j = (await r.json()) as AnthropicResp;
      if (j.error) throw new Error(j.error.message);
      let raw = j.content.map((c) => c.text || '').join('').trim();
      const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fence) raw = fence[1].trim();
      if (!raw.startsWith('{')) { const s = raw.indexOf('{'), e = raw.lastIndexOf('}'); if (s >= 0 && e > s) raw = raw.slice(s, e + 1); }
      return JSON.parse(raw);
    } catch (e) { if (attempt === 2) throw e; await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); }
  }
  throw new Error('call: 재시도 소진');
}

// 보편 결정 12종 — 도메인·성격·난이도 다양. 사업 편중 탈피.
const SCENARIOS: { tag: string; input: string; expectType?: string }[] = [
  { tag: 'career-이직', input: '지금 회사 3년 다녔는데 경쟁사에서 연봉 40% 올려서 제안이 왔어. 옮기는 게 맞을까?' },
  { tag: 'relationship-결혼', input: '3년 사귄 사람이랑 결혼 얘기가 나오는데, 확신이 안 서. 지금이 맞나 싶어.' },
  { tag: 'health-수술', input: '무릎 반월상연골 파열인데 의사가 수술을 권해. 근데 재활만으로도 된다는 말도 있어서 고민돼.' },
  { tag: 'finance-투자', input: '모아둔 5천만원을 지금 주식에 넣을지 예금에 둘지 고민이야. 시장이 불안한 것 같기도 하고.' },
  { tag: 'family-부모봉양', input: '부모님이 편찮으신데 내가 회사 그만두고 돌볼지, 요양 서비스를 쓸지 결정해야 해.' },
  { tag: 'ethical-내부고발', input: '회사에서 회계 부정을 목격했어. 신고하면 내 커리어가 끝날 수도 있는데, 어떻게 해야 할까?' },
  { tag: 'creative-방향전환', input: '10년 해온 디자인 일을 접고 글쓰기로 전업할지 고민 중이야. 늦은 건 아닐까?' },
  { tag: 'trivial-flat', input: '주말에 청소기를 새로 살까 하는데 A모델이랑 B모델 중에 뭐가 나을까? 둘 다 비슷해.' },
  { tag: 'parenting-교육', input: '아이를 국제학교 보낼지 일반학교 보낼지 정해야 해. 비용도 부담되고 애 적응도 걱정이야.' },
  { tag: 'moving-이사', input: '서울 살다가 제주로 완전히 이주할까 진지하게 생각 중이야. 일은 원격으로 가능해.' },
  { tag: 'business-피벗', input: '2년 키운 서비스가 성장이 멈췄어. 지금 제품을 접고 피벗할지, 더 밀지 결정해야 해.' },
  { tag: 'ambiguous-막연', input: '요즘 사는 게 좀 답답한데 뭔가 바꾸긴 해야 할 것 같아. 근데 뭘 해야 할지 모르겠어.' },
];

const JUDGE_SYSTEM = `당신은 의사결정 도우미 'Argus'의 산출을 채점하는 냉정하고 독립적인 심판입니다. 관대하지 마세요 — 후한 점수는 쓸모없습니다. 아래는 사용자 입력과 Argus의 분석입니다. 각 축을 0~100으로 채점하고, 가장 심각한 이슈 하나를 짚으세요.

축 (★usefulness는 request_type에 맞는 잣대로 채점 — 아래 규칙 엄수):
- usefulness:
  · request_type이 'open'이면: 결정을 실제로 '날카롭게' 했나? real_question이 표면보다 깊고, skeleton/hidden_assumptions가 이 사람 상황에 **구체적**인가? 아무 결정에나 붙는 generic이면 감점.
  · 'flat'이면: 억지로 '진짜 질문'을 지어내지 않고 **크리스프한 한 줄 결론**(뭘 정하면 바로 풀리는지)을 줬으면 높게. 여기서 real_question이 표면과 같은 건 정답이지 감점 아님 — 다만 그냥 '반복'만 하고 크리스프한 도움이 없으면 감점.
  · 'vent'이면: 따뜻하게 받고 **부담 없는 한 가지 여는 질문**이면 높게. 억지 결정 변환이 없어야. (감정 입력을 결정으로 안 몬 건 정답)
  · 'validation/info/resistance/self_profiling'이면 각 성격에 맞게(정보엔 답, 이미결정엔 재오픈 안 함, 저항엔 작은 실검사).
  restraint가 정답인 유형에서 restraint를 '안 날카롭다'고 감점하지 말 것.
- spine: 판정/추천/치우침을 흘렸나? crux가 중립 질문인가? over-fire(사소/되돌릴 수 있는 결정에 기계 과다, 감정/막연을 억지 결정으로)? 위반 있으면 감점.
- honesty: 확인 안 된 바깥 사실을 단정형으로 말했나? 사용자가 안 준 구체(숫자·제3자 심리)를 지어냈나? 있으면 감점(조건부·"확인하세요"는 정직).
- fit: request_type 분류가 입력 성격에 맞나? 사소한 걸 open으로 과분류하거나(over-fire), 진짜 결정을 flat/vent로 억눌렀으면 감점.

오직 JSON:
{"usefulness":N,"spine":N,"honesty":N,"fit":N,"worst_issue":"가장 심각한 문제 한 줄(없으면 '없음')","worst_axis":"usefulness|spine|honesty|fit|none"}`;

interface Score { tag: string; request_type: string; usefulness: number; spine: number; honesty: number; fit: number; worst_issue: string; worst_axis: string; }

async function scoreOne(s: { tag: string; input: string }): Promise<Score | null> {
  try {
    const { system, user } = buildInitialAnalysisPrompt(s.input, 'ko');
    const a = await call<{ request_type?: string; real_question?: string; hidden_assumptions?: unknown; skeleton?: unknown; insight?: string; next_question?: unknown }>(system, user);
    const analysis = JSON.stringify({ request_type: a.request_type, real_question: a.real_question, hidden_assumptions: a.hidden_assumptions, skeleton: a.skeleton, insight: a.insight, next_question: a.next_question }, null, 2);
    const v = await call<{ usefulness?: number; spine?: number; honesty?: number; fit?: number; worst_issue?: string; worst_axis?: string }>(JUDGE_SYSTEM, `사용자 입력: "${s.input}"\n\nArgus 분석:\n${analysis}`);
    return {
      tag: s.tag, request_type: a.request_type ?? '?',
      usefulness: Number(v.usefulness) || 0, spine: Number(v.spine) || 0, honesty: Number(v.honesty) || 0, fit: Number(v.fit) || 0,
      worst_issue: v.worst_issue ?? '', worst_axis: v.worst_axis ?? 'none',
    };
  } catch (e: unknown) { console.error(`  [${s.tag}] ERROR ${e instanceof Error ? e.message : String(e)}`); return null; }
}

// 동시성 제한(4)으로 rate limit 회피
async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); } }));
  return out;
}

(async () => {
  console.log('██████ 보편 점수 루프 — 12 시나리오 × 독립 심판 ██████\n');
  const scores = (await pool(SCENARIOS, 4, scoreOne)).filter(Boolean) as Score[];
  if (!scores.length) { console.error('모든 시나리오 실패 — 채점 불가'); process.exit(1); }
  const axes = ['usefulness', 'spine', 'honesty', 'fit'] as const;
  console.log('시나리오'.padEnd(22), 'type'.padEnd(12), 'use spine hon fit  | 최악');
  for (const s of scores.sort((a, b) => (a.usefulness + a.spine + a.honesty + a.fit) - (b.usefulness + b.spine + b.honesty + b.fit))) {
    const row = `${String(s.usefulness).padStart(3)} ${String(s.spine).padStart(5)} ${String(s.honesty).padStart(3)} ${String(s.fit).padStart(3)}`;
    console.log(s.tag.padEnd(22), (s.request_type || '?').padEnd(12), row, ' |', s.worst_axis !== 'none' ? `[${s.worst_axis}] ${s.worst_issue}`.slice(0, 80) : 'OK');
  }
  console.log('\n── 축별 평균 ──');
  for (const ax of axes) {
    const vals = scores.map((s) => s[ax]);
    const mean = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    const min = Math.min(...vals);
    console.log(`${ax.padEnd(12)} 평균 ${mean}  (최저 ${min})`);
  }
  const issueAxes = scores.filter((s) => s.worst_axis !== 'none').map((s) => s.worst_axis);
  const counts: Record<string, number> = {};
  issueAxes.forEach((a) => (counts[a] = (counts[a] || 0) + 1));
  console.log('\n── 최악-축 집계 ──', JSON.stringify(counts));
  const overall = Math.round(scores.reduce((a, s) => a + s.usefulness + s.spine + s.honesty + s.fit, 0) / (scores.length * 4));
  console.log(`\n총점(평균) ${overall}/100`);
})();
