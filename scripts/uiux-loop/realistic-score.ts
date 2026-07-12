/**
 * 대중 질문 품질 루프 — 드라마틱한 특이 케이스가 아니라, 정말 사용자들이 매일
 * 치는 평범·고빈도 질문을 실제 엔진에 먹이고, 생성을 안 본 독립·냉정 심판이
 * 내용 품질을 채점한다. score-harness.ts(보편/특이 12종)의 자매 하네스.
 *
 * 축(창업자 지정): level(수준 — 이 질문에 맞는 깊이인가, 뻔하지도 과잉지성화도
 * 아닌가) · coherence(연결성 — real_question→가정→skeleton→insight가 한 실로
 * 이어지나) · soundness(타당성 — 추론이 실제로 옳은가, 그럴듯-틀림 아닌가) ·
 * neutrality(중립성 — 판정/치우침 없이 중립 질문인가).
 *
 * 실행: NEXT_PUBLIC_SUPABASE_URL=... npx tsx scripts/uiux-loop/realistic-score.ts
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
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2000, system, messages: [{ role: 'user', content: user }] }),
        signal: AbortSignal.timeout(60000),
      });
      const j = (await r.json()) as AnthropicResp;
      if (j.error) throw new Error(j.error.message);
      let raw = j.content.map((c) => c.text || '').join('').trim();
      const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fence) raw = fence[1].trim();
      if (!raw.startsWith('{')) { const s = raw.indexOf('{'), e = raw.lastIndexOf('}'); if (s >= 0 && e > s) raw = raw.slice(s, e + 1); }
      return JSON.parse(raw) as T;
    } catch (e) { if (attempt === 2) throw e; await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); }
  }
  throw new Error('call: 재시도 소진');
}

// 대중이 실제로 매일 치는 고빈도·평범 질문. 일·소비·개인·사소를 고루.
const SCENARIOS: { tag: string; input: string }[] = [
  { tag: '일-기능출시', input: '이번 스프린트에 만든 기능을 지금 출시할지, 좀 더 다듬고 다음 주에 낼지 고민이야.' },
  { tag: '일-회의줄이기', input: '팀 회의가 너무 많은 것 같아. 줄이는 게 맞을까?' },
  { tag: '일-연봉협상', input: '연봉 협상을 해볼까 하는데 지금 타이밍이 맞나 모르겠어.' },
  { tag: '일-재택vs출근', input: '재택을 계속할지 사무실로 나갈지 고민 중이야.' },
  { tag: '커리어-매니저트랙', input: '매니저로 갈지 계속 실무 전문가로 남을지 고민이야.' },
  { tag: '소비-노트북', input: '노트북을 새로 살까 지금 걸 더 쓸까? 좀 느려지긴 했는데 아직 쓸 만해.' },
  { tag: '소비-강의결제', input: '20만원짜리 온라인 강의를 결제할까 말까 고민이야.' },
  { tag: '개인-운동시작', input: '운동을 시작하려는데 헬스장 등록이랑 홈트 중에 뭐가 나을까?' },
  { tag: '개인-주말', input: '이번 주말에 여행을 갈지 그냥 집에서 쉴지 고민이야.' },
  { tag: '개인-이직준비', input: '당장은 아니어도 슬슬 이직 준비를 시작해볼까 하는데.' },
  { tag: '사소-저녁', input: '오늘 저녁 뭐 먹지?' },
  { tag: '사소-영화', input: '주말에 볼 만한 영화 뭐 없을까?' },
];

const JUDGE_SYSTEM = `당신은 의사결정 도우미 'Argus'의 산출을 채점하는 냉정하고 독립적인 심판입니다. 관대하지 마세요. 아래는 '보통 사용자'가 일상적으로 던진 질문과 Argus의 분석입니다. 평범한 질문일수록 '과하게 무겁게 다루는 것'과 '너무 뻔하게 답하는 것' 둘 다 감점입니다.

각 축을 0~100으로 채점(★request_type 성격에 맞는 잣대로):
- level(수준): 이 질문에 맞는 깊이인가? 사소·flat한 질문(저녁 뭐먹지)에 5단계 기계를 돌리면 감점(과잉). 반대로 진짜 고민(연봉협상·이직)에 뻔한 상식만 주면 감점(얕음). 딱 맞는 무게 = 높게.
- coherence(연결성): real_question → hidden_assumptions → skeleton → insight가 '한 실'로 이어지나? 진짜 질문이 A인데 skeleton은 B를 다루는 식의 따로 놀기가 있으면 감점.
- soundness(타당성): 추론이 실제로 옳은가? '그럴듯하지만 틀린' 인과·전제, 확인 안 된 사실 단정, 안 준 구체 날조가 있으면 감점.
- neutrality(중립성): ★request_type별 잣대. 'open'이면 엄격 — insight/skeleton/next_question이 한쪽을 추천/암시하면 안 됨('~하는 게 낫다', '사실 답은 정해진 듯', 특정 방향 반복 프레이밍 = 감점). 'flat/info'면 크리스프한 직답 한 줄은 설계상 정답이니 그걸 lean으로 감점하지 말 것(단 open을 flat로 착각해 진짜 결정을 가볍게 눌러버린 거면 감점). 'vent'면 따뜻함은 OK.

오직 JSON:
{"level":N,"coherence":N,"soundness":N,"neutrality":N,"worst_issue":"가장 심각한 문제 한 줄(없으면 '없음')","worst_axis":"level|coherence|soundness|neutrality|none"}`;

interface Score { tag: string; request_type: string; level: number; coherence: number; soundness: number; neutrality: number; worst_issue: string; worst_axis: string; }

async function scoreOne(s: { tag: string; input: string }): Promise<Score | null> {
  try {
    const { system, user } = buildInitialAnalysisPrompt(s.input, 'ko');
    const a = await call<{ request_type?: string; real_question?: string; hidden_assumptions?: unknown; skeleton?: unknown; insight?: string; next_question?: unknown }>(system, user);
    const analysis = JSON.stringify({ request_type: a.request_type, real_question: a.real_question, hidden_assumptions: a.hidden_assumptions, skeleton: a.skeleton, insight: a.insight, next_question: a.next_question }, null, 2);
    const v = await call<{ level?: number; coherence?: number; soundness?: number; neutrality?: number; worst_issue?: string; worst_axis?: string }>(JUDGE_SYSTEM, `사용자 질문: "${s.input}"\n\nArgus 분석:\n${analysis}`);
    return {
      tag: s.tag, request_type: a.request_type ?? '?',
      level: Number(v.level) || 0, coherence: Number(v.coherence) || 0, soundness: Number(v.soundness) || 0, neutrality: Number(v.neutrality) || 0,
      worst_issue: v.worst_issue ?? '', worst_axis: v.worst_axis ?? 'none',
    };
  } catch (e: unknown) { console.error(`  [${s.tag}] ERROR ${e instanceof Error ? e.message : String(e)}`); return null; }
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); } }));
  return out;
}

(async () => {
  console.log('██████ 대중 질문 품질 루프 — 12 일상 질문 × 독립 심판 ██████\n');
  const scores = (await pool(SCENARIOS, 4, scoreOne)).filter(Boolean) as Score[];
  if (!scores.length) { console.error('모든 시나리오 실패 — 채점 불가'); process.exit(1); }
  if (scores.length !== SCENARIOS.length) {
    console.error(`일부 시나리오 실패 — ${scores.length}/${SCENARIOS.length}만 채점됨`);
    process.exit(1);
  }
  const axes = ['level', 'coherence', 'soundness', 'neutrality'] as const;
  console.log('질문'.padEnd(20), 'type'.padEnd(12), 'lvl coh snd ntr | 최악');
  for (const s of scores.sort((a, b) => (a.level + a.coherence + a.soundness + a.neutrality) - (b.level + b.coherence + b.soundness + b.neutrality))) {
    const row = `${String(s.level).padStart(3)} ${String(s.coherence).padStart(3)} ${String(s.soundness).padStart(3)} ${String(s.neutrality).padStart(3)}`;
    console.log(s.tag.padEnd(20), (s.request_type || '?').padEnd(12), row, '|', s.worst_axis !== 'none' ? `[${s.worst_axis}] ${s.worst_issue}`.slice(0, 76) : 'OK');
  }
  console.log('\n── 축별 평균 ──');
  for (const ax of axes) {
    const vals = scores.map((s) => s[ax]);
    console.log(`${ax.padEnd(12)} 평균 ${Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)}  (최저 ${Math.min(...vals)})`);
  }
  const counts: Record<string, number> = {};
  scores.filter((s) => s.worst_axis !== 'none').forEach((s) => (counts[s.worst_axis] = (counts[s.worst_axis] || 0) + 1));
  console.log('\n── 최악-축 집계 ──', JSON.stringify(counts));
  const overall = Math.round(scores.reduce((a, s) => a + s.level + s.coherence + s.soundness + s.neutrality, 0) / (scores.length * 4));
  console.log(`\n총점(평균) ${overall}/100`);
})();
