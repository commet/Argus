/**
 * Eval Engine — Phase 1 (autoresearch 패턴)
 *
 * Binary eval 프레임워크: 리프레이밍 품질을 측정하고
 * 어떤 전략이 어떤 맥락에서 효과적인지 학습한다.
 *
 * autoresearch-skill의 원칙:
 * - 모든 eval은 binary (yes/no)
 * - 3-6개 범위
 * - 각 eval은 겹치지 않아야 함
 * - "게임할 수 있는" eval 금지
 */

import type {
  ReframeItem,
  RecastItem,
  FeedbackRecord,
  Persona,
  PersonaAccuracyRating,
} from '@/stores/types';
import type { ReframingStrategy, InterviewSignals } from '@/lib/reframing-strategy';
import { getStorage, setStorage } from '@/lib/storage';
import { extractInterviewSignals as extractSignals } from '@/lib/context-chain';
import { recordSignal } from '@/lib/signal-recorder';
import { buildStageFingerprint } from '@/lib/judgment-vitality';

const EVAL_STORAGE_KEY = 'argus_eval_results';
const RECAST_EVAL_KEY = 'argus_eval_recast';
const REHEARSAL_EVAL_KEY = 'argus_eval_rehearsal';
const REFINE_EVAL_KEY = 'argus_eval_refine';

export type EvalTool = 'reframe' | 'recast' | 'rehearse' | 'refine';

/* ────────────────────────────────────
   Binary Eval Definitions
   ──────────────────────────────────── */

export interface BinaryEval {
  id: string;
  question: string;
  measure: (item: ReframeItem) => boolean;
}

export const REFRAME_EVALS: BinaryEval[] = [
  {
    id: 'question_accepted',
    question: '사용자가 AI 제안 질문을 수정 없이 채택했는가?',
    measure: (item) => {
      if (!item.analysis || !item.selected_question) return false;
      // Phase 2A: user_edited_question 플래그로 복사-붙여넣기 우회 방지
      if (item.user_edited_question) return false;
      return item.analysis.hidden_questions.some(
        hq => hq.question === item.selected_question
      );
    },
  },
  {
    id: 'assumptions_engaged',
    question: '사용자가 전제에 관여했는가? (1개 이상 평가함)',
    measure: (item) => {
      if (!item.analysis) return false;
      return item.analysis.hidden_assumptions.some(
        a => typeof a !== 'string' && (a.evaluation === 'likely_true' || a.evaluation === 'doubtful' || a.evaluation === 'uncertain')
      );
    },
  },
  {
    id: 'no_immediate_reanalyze',
    question: '사용자가 즉시 재분석을 요청하지 않았는가?',
    measure: (item) => {
      // Phase 2A: 재분석 횟수 추적으로 정확한 측정
      return item.status === 'done' && (item.reanalysis_count || 0) <= 1;
    },
  },
  {
    id: 'has_useful_assumptions',
    question: '미확인 전제가 1개 이상 남아있는가? (AI가 의미 있는 전제를 찾음)',
    measure: (item) => {
      if (!item.analysis) return false;
      return item.analysis.hidden_assumptions.some(
        a => !a.verified
      );
    },
  },
  {
    id: 'assumptions_diverse',
    question: '전제들이 서로 다른 축(고객/실행/사업/조직)에서 나왔는가?',
    measure: (item) => {
      if (!item.analysis) return false;
      const axes = item.analysis.hidden_assumptions
        .map(a => typeof a !== 'string' ? a.axis : undefined)
        .filter(Boolean);
      if (axes.length < 2) return true; // too few to judge
      const unique = new Set(axes);
      return unique.size >= Math.min(axes.length, 3); // at least 3 different axes for 3-4 assumptions
    },
  },
];

/* ────────────────────────────────────
   Eval Result Recording
   ──────────────────────────────────── */

export interface EvalResult {
  id: string;
  item_id: string;
  tool?: EvalTool;
  strategy: ReframingStrategy | null;
  interview_signals: InterviewSignals | null;
  evals: Record<string, boolean>;
  pass_rate: number;
  recorded_at: string;
}

/**
 * Record eval results for a completed reframe item.
 * Called when user confirms (status → done).
 */
export function recordReframeEval(
  item: ReframeItem,
  strategy: ReframingStrategy | null
): EvalResult {
  const evals: Record<string, boolean> = {};
  let passed = 0;

  for (const evalDef of REFRAME_EVALS) {
    const result = evalDef.measure(item);
    evals[evalDef.id] = result;
    if (result) passed++;
  }

  const signals = extractSignals(item.input_text) || null;

  const evalResult: EvalResult = {
    id: crypto.randomUUID ? crypto.randomUUID() : `eval_${Date.now()}`,
    item_id: item.id,
    strategy,
    interview_signals: signals as InterviewSignals | null,
    evals,
    pass_rate: passed / REFRAME_EVALS.length,
    recorded_at: new Date().toISOString(),
  };

  // Persist to localStorage
  const history = getStorage<EvalResult[]>(EVAL_STORAGE_KEY, []);
  history.push(evalResult);
  // Keep last 200 results
  if (history.length > 200) history.splice(0, history.length - 200);
  setStorage(EVAL_STORAGE_KEY, history);

  // Sync to Supabase via quality_signals (fire-and-forget)
  recordSignal({
    tool: 'reframe',
    signal_type: 'eval_result',
    signal_data: {
      item_id: evalResult.item_id,
      strategy: evalResult.strategy,
      interview_signals: evalResult.interview_signals,
      evals: evalResult.evals,
      pass_rate: evalResult.pass_rate,
    },
  });

  // Vitality: record stage fingerprint
  try {
    const fp = buildStageFingerprint('reframe', item);
    recordSignal({ tool: 'reframe', signal_type: 'stage_fingerprint', signal_data: { ...fp } as Record<string, unknown>, project_id: item.project_id });
  } catch { /* non-critical */ }

  return evalResult;
}

/* ────────────────────────────────────
   Recast Evals (선원 배치 품질 측정)
   ──────────────────────────────────── */

export interface RecastEvalInput {
  item: RecastItem;
  actorOverrideCount: number;
}

export const RECAST_EVALS: Array<{ id: string; question: string; measure: (input: RecastEvalInput) => boolean }> = [
  { id: 'steps_accepted', question: 'AI의 워크플로우 구조를 대체로 유지했는가?', measure: ({ item }) => { if (!item.analysis) return false; return Math.abs(item.analysis.steps.length - item.steps.length) <= 2; } },
  { id: 'actor_overrides_low', question: '역할 배정을 대부분 수용했는가?', measure: ({ item, actorOverrideCount }) => { if (!item.analysis) return true; const t = item.analysis.steps.length; return t === 0 || actorOverrideCount / t < 0.3; } },
  { id: 'has_key_assumptions', question: 'AI가 핵심 가정을 2개 이상 도출했는가?', measure: ({ item }) => (item.analysis?.key_assumptions?.length || 0) >= 2 },
  { id: 'has_design_rationale', question: 'AI가 설계 근거를 제시했는가?', measure: ({ item }) => !!item.analysis?.design_rationale && item.analysis.design_rationale.length > 20 },
];

export function recordRecastEval(item: RecastItem, actorOverrideCount: number): EvalResult {
  const evals: Record<string, boolean> = {};
  let passed = 0;
  for (const e of RECAST_EVALS) { const r = e.measure({ item, actorOverrideCount }); evals[e.id] = r; if (r) passed++; }
  const evalResult: EvalResult = { id: crypto.randomUUID ? crypto.randomUUID() : `eval_${Date.now()}`, item_id: item.id, tool: 'recast', strategy: null, interview_signals: null, evals, pass_rate: passed / RECAST_EVALS.length, recorded_at: new Date().toISOString() };
  const history = getStorage<EvalResult[]>(RECAST_EVAL_KEY, []); history.push(evalResult); if (history.length > 200) history.splice(0, history.length - 200); setStorage(RECAST_EVAL_KEY, history);
  recordSignal({ tool: 'recast', signal_type: 'eval_result', signal_data: { item_id: evalResult.item_id, evals: evalResult.evals, pass_rate: evalResult.pass_rate }, project_id: item.project_id });
  try { const fp = buildStageFingerprint('recast', item); recordSignal({ tool: 'recast', signal_type: 'stage_fingerprint', signal_data: { ...fp } as Record<string, unknown>, project_id: item.project_id }); } catch { /* non-critical */ }
  return evalResult;
}

/* ────────────────────────────────────
   Rehearsal Evals (리허설 품질 측정)
   ──────────────────────────────────── */

export interface RehearsalEvalInput { record: FeedbackRecord; personas: Persona[]; accuracyRatings: PersonaAccuracyRating[] }

export const REHEARSAL_EVALS: Array<{ id: string; question: string; measure: (input: RehearsalEvalInput) => boolean }> = [
  { id: 'critical_risks_found', question: '핵심 리스크가 1개 이상 식별됐는가?', measure: ({ record }) => record.results.some(r => (r.classified_risks || []).some(risk => risk.category === 'critical')) },
  { id: 'unspoken_risks_surfaced', question: '미언급 리스크가 1개 이상 발견됐는가?', measure: ({ record }) => record.results.some(r => (r.classified_risks || []).some(risk => risk.category === 'unspoken')) },
  { id: 'persona_views_diverse', question: '페르소나들이 다양한 관점을 제시했는가?', measure: ({ record }) => { if (record.results.length < 2) return true; const all = record.results.flatMap(r => (r.classified_risks || []).map(risk => risk.text.toLowerCase().trim())); if (all.length === 0) return true; return new Set(all).size / all.length > 0.6; } },
  { id: 'approval_conditions_clear', question: '승인 조건이 2개 이상 도출됐는가?', measure: ({ record }) => record.results.reduce((s, r) => s + (r.approval_conditions?.length || 0), 0) >= 2 },
];

export function recordRehearsalEval(record: FeedbackRecord, personas: Persona[], accuracyRatings: PersonaAccuracyRating[] = []): EvalResult {
  const evals: Record<string, boolean> = {};
  let passed = 0;
  for (const e of REHEARSAL_EVALS) { const r = e.measure({ record, personas, accuracyRatings }); evals[e.id] = r; if (r) passed++; }
  const evalResult: EvalResult = { id: crypto.randomUUID ? crypto.randomUUID() : `eval_${Date.now()}`, item_id: record.id, tool: 'rehearse', strategy: null, interview_signals: null, evals, pass_rate: passed / REHEARSAL_EVALS.length, recorded_at: new Date().toISOString() };
  const history = getStorage<EvalResult[]>(REHEARSAL_EVAL_KEY, []); history.push(evalResult); if (history.length > 200) history.splice(0, history.length - 200); setStorage(REHEARSAL_EVAL_KEY, history);
  recordSignal({ tool: 'rehearse', signal_type: 'eval_result', signal_data: { record_id: evalResult.item_id, evals: evalResult.evals, pass_rate: evalResult.pass_rate, persona_count: record.results.length }, project_id: record.project_id });
  try { const fp = buildStageFingerprint('rehearse', record); recordSignal({ tool: 'rehearse', signal_type: 'stage_fingerprint', signal_data: { ...fp } as Record<string, unknown>, project_id: record.project_id }); } catch { /* non-critical */ }
  return evalResult;
}

/* ────────────────────────────────────
   Cross-Stage Eval Summary
   ──────────────────────────────────── */

export function getStageEvalSummary(tool: EvalTool): { tool: EvalTool; total_sessions: number; avg_pass_rate: number; worst_eval: string | null; per_eval_rates: Record<string, number> } {
  const keyMap: Record<EvalTool, string> = { reframe: EVAL_STORAGE_KEY, recast: RECAST_EVAL_KEY, 'rehearse': REHEARSAL_EVAL_KEY, refine: REFINE_EVAL_KEY };
  const history = getStorage<EvalResult[]>(keyMap[tool], []);
  if (history.length === 0) return { tool, total_sessions: 0, avg_pass_rate: 0, worst_eval: null, per_eval_rates: {} };
  const avgPassRate = history.reduce((s, r) => s + r.pass_rate, 0) / history.length;
  const evalPassRates: Record<string, number[]> = {};
  for (const result of history) { for (const [evalId, passed] of Object.entries(result.evals)) { if (!evalPassRates[evalId]) evalPassRates[evalId] = []; evalPassRates[evalId].push(passed ? 1 : 0); } }
  const perEvalRates: Record<string, number> = {};
  let worstEval: string | null = null; let worstRate = 1;
  for (const [id, rates] of Object.entries(evalPassRates)) { const avg = rates.reduce((a, b) => a + b, 0) / rates.length; perEvalRates[id] = avg; if (avg < worstRate) { worstRate = avg; worstEval = id; } }
  return { tool, total_sessions: history.length, avg_pass_rate: avgPassRate, worst_eval: worstEval, per_eval_rates: perEvalRates };
}

export function getAllStagesSummary() { return (['reframe', 'recast', 'rehearse', 'refine'] as EvalTool[]).map(getStageEvalSummary).filter(s => s.total_sessions > 0); }

/* ────────────────────────────────────
   Strategy Performance Analysis
   ──────────────────────────────────── */

export interface StrategyPerformance {
  strategy: ReframingStrategy;
  sample_count: number;
  avg_pass_rate: number;
  per_eval_pass_rates: Record<string, number>;
}

/**
 * Analyze which strategy works best for a given signal combination.
 * Returns performance data for each strategy used with similar signals.
 */
export function analyzeStrategyPerformance(
  signalKey?: string
): StrategyPerformance[] {
  const history = getStorage<EvalResult[]>(EVAL_STORAGE_KEY, []);
  if (history.length < 3) return [];

  // Filter by signal key — supports partial matching (e.g., "_why_" matches any origin/success)
  const filtered = signalKey
    ? history.filter(r => {
        if (!r.interview_signals) return false;
        const fullKey = makeSignalKey(r.interview_signals);
        // Exact match first
        if (fullKey === signalKey) return true;
        // v2 partial match: nature-only (e.g., "v2_no_answer__")
        if (signalKey.startsWith('v2_') && signalKey.endsWith('__')) {
          const nature = signalKey.slice(3, -2);
          return r.interview_signals.nature === nature;
        }
        // v1 partial match: uncertainty-only (e.g., "_why_")
        if (signalKey.startsWith('_') && signalKey.endsWith('_')) {
          const uncertainty = signalKey.slice(1, -1);
          return r.interview_signals.uncertainty === uncertainty;
        }
        return false;
      })
    : history;

  // Group by strategy
  const grouped: Record<string, EvalResult[]> = {};
  for (const result of filtered) {
    const key = result.strategy || 'unknown';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(result);
  }

  return Object.entries(grouped).map(([strategy, results]) => {
    const avgPassRate = results.reduce((sum, r) => sum + r.pass_rate, 0) / results.length;

    const perEval: Record<string, number> = {};
    for (const evalDef of REFRAME_EVALS) {
      const passCount = results.filter(r => r.evals[evalDef.id]).length;
      perEval[evalDef.id] = passCount / results.length;
    }

    return {
      strategy: strategy as ReframingStrategy,
      sample_count: results.length,
      avg_pass_rate: avgPassRate,
      per_eval_pass_rates: perEval,
    };
  });
}

/**
 * Get the best-performing strategy for given signals.
 * Micro Loop: uncertainty 단독으로 먼저 시도 (4 조합, 3 샘플이면 충분)
 * → 부족하면 전체 신호 조합으로 시도 (fallback)
 * → 부족하면 null (rule-based fallback은 호출자가 처리)
 */
export function getBestStrategy(signals: InterviewSignals): ReframingStrategy | null {
  // v2: nature as primary micro-key
  if (signals.nature) {
    const microKey = `v2_${signals.nature}__`;
    const microPerf = analyzeStrategyPerformance(microKey);
    const viable = microPerf.filter(p => p.sample_count >= 3);
    if (viable.length > 0) {
      return viable.sort((a, b) => b.avg_pass_rate - a.avg_pass_rate)[0].strategy;
    }
  }

  // v1: uncertainty 단독으로 매칭 (가장 빠르게 데이터 축적)
  if (signals.uncertainty) {
    const microKey = `_${signals.uncertainty}_`;
    const microPerf = analyzeStrategyPerformance(microKey);
    const viable = microPerf.filter(p => p.sample_count >= 3);
    if (viable.length > 0) {
      return viable.sort((a, b) => b.avg_pass_rate - a.avg_pass_rate)[0].strategy;
    }
  }

  // Full key (v1 or v2)
  const fullKey = makeSignalKey(signals);
  const fullPerf = analyzeStrategyPerformance(fullKey);
  const fullViable = fullPerf.filter(p => p.sample_count >= 3);
  if (fullViable.length > 0) {
    return fullViable.sort((a, b) => b.avg_pass_rate - a.avg_pass_rate)[0].strategy;
  }

  return null;
}

/* ────────────────────────────────────
   1-Session Feedback: 이전 세션 요약
   ──────────────────────────────────── */

export interface SessionInsight {
  type: 'last_strategy' | 'pattern' | 'tip';
  message: string;
}

/**
 * Get personalized insights from past sessions.
 * Returns messages to display BEFORE analysis starts.
 * Works from 1 session — no minimum threshold.
 */
export function getSessionInsights(): SessionInsight[] {
  const history = getStorage<EvalResult[]>(EVAL_STORAGE_KEY, []);
  if (history.length === 0) return [];

  const insights: SessionInsight[] = [];
  const last = history[history.length - 1];

  // 1세션: 지난번 전략 + 결과
  if (last.strategy) {
    const label = STRATEGY_DISPLAY[last.strategy];
    const success = last.pass_rate >= 0.75;
    insights.push({
      type: 'last_strategy',
      message: success
        ? `지난 분석에서 "${label}" 접근이 효과적이었습니다.`
        : `지난 분석에서 "${label}" 접근을 사용했습니다.`,
    });
  }

  // 3세션+: 패턴 감지
  if (history.length >= 3) {
    const strategies = history.slice(-5).map(h => h.strategy).filter(Boolean);
    const counts: Record<string, number> = {};
    strategies.forEach(s => { if (s) counts[s] = (counts[s] || 0) + 1; });
    const dominant = Object.entries(counts).sort(([, a], [, b]) => b - a)[0];
    if (dominant && dominant[1] >= 2) {
      insights.push({
        type: 'pattern',
        message: `최근 "${STRATEGY_DISPLAY[dominant[0] as ReframingStrategy]}" 접근을 자주 사용하고 있습니다.`,
      });
    }

    // 성공률 트렌드
    const recentPassRate = history.slice(-5).reduce((s, h) => s + h.pass_rate, 0) / Math.min(history.length, 5);
    if (recentPassRate >= 0.8) {
      insights.push({
        type: 'tip',
        message: `최근 분석 결과의 활용도가 높습니다. 현재 접근 방식을 유지하세요.`,
      });
    }
  }

  return insights;
}

const STRATEGY_DISPLAY: Record<ReframingStrategy, string> = {
  challenge_existence: '존재 의심',
  narrow_scope: '범위 집중',
  diagnose_root: '원인 진단',
  redirect_angle: '관점 전환',
};

/* ────────────────────────────────────
   Helpers
   ──────────────────────────────────── */

function makeSignalKey(signals: InterviewSignals): string {
  if (signals.version === 2 || signals.nature) {
    return `v2_${signals.nature || '_'}_${signals.goal || '_'}_${signals.stakes || '_'}`;
  }
  return `${signals.origin || '_'}_${signals.uncertainty || '_'}_${signals.success || '_'}`;
}

/**
 * Get summary stats for display.
 */
export function getEvalSummary(): {
  total_sessions: number;
  avg_pass_rate: number;
  best_strategy: string | null;
  worst_eval: string | null;
} {
  const history = getStorage<EvalResult[]>(EVAL_STORAGE_KEY, []);
  if (history.length === 0) {
    return { total_sessions: 0, avg_pass_rate: 0, best_strategy: null, worst_eval: null };
  }

  const avgPassRate = history.reduce((sum, r) => sum + r.pass_rate, 0) / history.length;

  // Find worst-performing eval
  const evalPassRates: Record<string, number[]> = {};
  for (const result of history) {
    for (const [evalId, passed] of Object.entries(result.evals)) {
      if (!evalPassRates[evalId]) evalPassRates[evalId] = [];
      evalPassRates[evalId].push(passed ? 1 : 0);
    }
  }
  const evalAvgs = Object.entries(evalPassRates).map(([id, rates]) => ({
    id,
    avg: rates.reduce((a, b) => a + b, 0) / rates.length,
  }));
  const worstEval = evalAvgs.sort((a, b) => a.avg - b.avg)[0]?.id || null;

  // Best strategy overall
  const perf = analyzeStrategyPerformance();
  const bestStrat = perf.sort((a, b) => b.avg_pass_rate - a.avg_pass_rate)[0];

  return {
    total_sessions: history.length,
    avg_pass_rate: avgPassRate,
    best_strategy: bestStrat?.strategy || null,
    worst_eval: worstEval,
  };
}
