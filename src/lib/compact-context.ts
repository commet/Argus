/**
 * Context Compaction — Semantic-Aware Truncation
 *
 * Progressive Flow에서 Q&A가 쌓일수록 컨텍스트가 커짐.
 * 오래된 Q&A를 요약하되 핵심 조건절(caveat)을 보존함.
 *
 * 전략:
 * - 최근 N라운드는 원문 유지 (N = 2, 라운드 3+에서는 3)
 * - 그 이전은 완전한 문장 2~3개 + 조건절 추출
 * - snapshot은 최신 것만 전체, 이전은 delta만 기록
 */

import type { FlowQuestion, FlowAnswer, AnalysisSnapshot } from '@/stores/types';

type Locale = 'ko' | 'en';

interface QAPair {
  question: FlowQuestion;
  answer: FlowAnswer;
}

// ─── Locale-specific labels (injected into LLM context) ───

const LABELS = {
  ko: {
    previousRounds: '[이전 라운드 요약]',
    recentConversation: '[최근 대화]',
    noAnalysis: '(분석 없음)',
    insightFlow: '[인사이트 흐름]',
    realQuestion: '진짜 질문',
    hiddenAssumptions: '숨겨진 전제',
    skeleton: '뼈대',
    executionPlan: '실행계획',
    latestInsight: '최신 인사이트',
    committedDirection: '사용자가 택한 방향',
    nextThreeDays: '사용자가 정한 3일 계획',
  },
  en: {
    previousRounds: '[Previous rounds — summarized]',
    recentConversation: '[Recent conversation]',
    noAnalysis: '(no analysis yet)',
    insightFlow: '[Insight flow]',
    realQuestion: 'Real question',
    hiddenAssumptions: 'Hidden assumptions',
    skeleton: 'Skeleton',
    executionPlan: 'Execution plan',
    latestInsight: 'Latest insight',
    committedDirection: 'Direction the user committed to',
    nextThreeDays: "User's chosen 3-day plan",
  },
};

// ─── Caveat extraction ───

/** 답변에서 조건절/단서를 추출 (놓치면 안 되는 핵심 조건) */
function extractCaveats(answer: string): string[] {
  const patterns = [
    // 한국어 조건절
    /(?:단,|다만|단지|만약|다만,)\s*[^.!?\n]+/g,
    /(?:~인 경우|~일 때|~하면|~한다면)[^.!?\n]*/g,
    /(?:조건은|전제는|단서는)[^.!?\n]+/g,
    // 영어 조건절
    /(?:but |however |only if |unless |provided that |as long as )[^.!?\n]+/gi,
  ];

  const caveats: string[] = [];
  for (const pattern of patterns) {
    const matches = answer.match(pattern);
    if (matches) {
      for (const m of matches) {
        const trimmed = m.trim();
        if (trimmed.length > 5 && !caveats.includes(trimmed)) {
          caveats.push(trimmed);
        }
      }
    }
  }
  return caveats.slice(0, 2); // 최대 2개만
}

/** 텍스트를 완전한 문장 단위로 잘라서 요약 */
function summarizeBySentence(text: string, maxSentences = 2): string {
  // 한국어/영어 문장 경계
  const sentences = text.match(/[^.!?。]+[.!?。]+/g);
  if (!sentences || sentences.length === 0) {
    return text.length > 150 ? text.slice(0, 150) + '...' : text;
  }

  const selected = sentences.slice(0, maxSentences);
  const result = selected.join('').trim();

  // 150자 초과하면 첫 문장만
  if (result.length > 150 && sentences.length > 1) {
    return sentences[0].trim();
  }
  return result;
}

// ─── Main compaction ───

/** 최근 N개를 제외한 Q&A를 시맨틱 압축하여 반환 */
export function compactQAHistory(
  questionsAndAnswers: QAPair[],
  keepRecent = 2,
  locale: Locale = 'ko',
): string {
  const L = LABELS[locale];
  if (questionsAndAnswers.length <= keepRecent) {
    // 전부 원문 유지
    return questionsAndAnswers.map((qa, i) =>
      `Q${i + 1}: ${qa.question.text}\nA${i + 1}: ${qa.answer.value}`,
    ).join('\n\n');
  }

  const older = questionsAndAnswers.slice(0, -keepRecent);
  const recent = questionsAndAnswers.slice(-keepRecent);
  const recentStartIndex = older.length;

  // 오래된 Q&A: 완전한 문장 요약 + 조건절 보존
  const compactedOlder = older.map((qa, i) => {
    const answer = qa.answer.value;
    const summary = summarizeBySentence(answer, 2);
    const caveats = extractCaveats(answer);

    let line = `[R${i + 1}] ${qa.question.text} → ${summary}`;
    if (caveats.length > 0) {
      line += `\n     ⚠️ ${caveats[0]}`;
    }
    return line;
  }).join('\n');

  // 최근 Q&A는 원문 유지
  const fullRecent = recent.map((qa, i) => {
    const idx = recentStartIndex + i + 1;
    return `Q${idx}: ${qa.question.text}\nA${idx}: ${qa.answer.value}`;
  }).join('\n\n');

  return `${L.previousRounds}\n${compactedOlder}\n\n${L.recentConversation}\n${fullRecent}`;
}

/** 라운드에 따라 keepRecent를 결정 (후반일수록 더 많이 보존) */
export function getKeepRecent(round: number): number {
  return round >= 3 ? 3 : 2;
}

/** 스냅샷 히스토리를 압축: 최신만 전체, 이전은 delta만 */
export function compactSnapshots(
  snapshots: AnalysisSnapshot[],
  locale: Locale = 'ko',
): string {
  const L = LABELS[locale];
  if (snapshots.length <= 1) {
    const s = snapshots[0];
    if (!s) return L.noAnalysis;
    return formatSnapshot(s, locale);
  }

  const latest = snapshots[snapshots.length - 1];
  const previousInsights = snapshots
    .slice(0, -1)
    .filter(s => s.insight)
    .map((s, i) => `v${i}: ${s.insight}`)
    .join(' → ');

  const lines = [formatSnapshot(latest, locale)];
  if (previousInsights) {
    lines.push(`${L.insightFlow} ${previousInsights}`);
  }

  return lines.join('\n');
}

type Labels = typeof LABELS['ko'];

/**
 * F2 — the snapshot→mix handoff as a TYPED PIPELINE, not a prose template.
 *
 * The AnalysisSnapshot fields that MUST reach the mix prompt. `keyof`-typed, so
 * renaming a snapshot field breaks THIS at compile time (not silently at runtime
 * in some template string). This is the single source of truth for "mix-context"
 * — the consumption-contract test derives the set from here.
 *
 * Root fix over the old guard: F2 shipped as a TEST that string-grepped
 * compact-context.ts for `s.<field>` — foolable by a comment, and it only proved
 * the field was *mentioned*, never that its VALUE reached the output. Now every
 * mix field flows through an exhaustive renderer map (below), so a dropped field
 * fails to COMPILE, and the test proves value-flow at runtime.
 */
export const MIX_CONTEXT_FIELDS = [
  'real_question', 'hidden_assumptions', 'skeleton', 'insight',
  'decision_line', 'next_three_days',
] as const satisfies readonly (keyof AnalysisSnapshot)[];

export type MixField = typeof MIX_CONTEXT_FIELDS[number];

/** One renderer per mix field → a labeled line, or null to omit when empty. The
 *  `Record<MixField, …>` mapped type is the compile-time guarantee: add a field
 *  to MIX_CONTEXT_FIELDS and the compiler DEMANDS a renderer here — a produced
 *  field can no longer be dead-on-arrival. */
const MIX_RENDERERS: Record<MixField, (s: AnalysisSnapshot, L: Labels) => string | null> = {
  real_question: (s, L) => `- ${L.realQuestion}: ${s.real_question}`,
  hidden_assumptions: (s, L) => `- ${L.hiddenAssumptions}: ${s.hidden_assumptions.join(' / ')}`,
  skeleton: (s, L) => `- ${L.skeleton}: ${s.skeleton.join(' → ')}`,
  insight: (s, L) => (s.insight ? `- ${L.latestInsight}: ${s.insight}` : null),
  // The user's OWN chosen decision from a strategic_fork / weakness_check — the
  // sharpest artifact of their judgment (F1). Omitted only when genuinely empty.
  decision_line: (s, L) => (s.decision_line?.trim() ? `- ${L.committedDirection}: ${s.decision_line.trim()}` : null),
  next_three_days: (s, L) => (s.next_three_days && s.next_three_days.length > 0 ? `- ${L.nextThreeDays}: ${s.next_three_days.join(' / ')}` : null),
};

function formatSnapshot(s: AnalysisSnapshot, locale: Locale = 'ko'): string {
  const L = LABELS[locale];
  const lines: string[] = [];
  // Every mix-context field flows through the exhaustive typed projector.
  // execution_plan is 'workers'-context (not mix), but has historically shown
  // here as orientation — keep it slotted right after the skeleton.
  for (const field of MIX_CONTEXT_FIELDS) {
    const line = MIX_RENDERERS[field](s, L);
    if (line != null) lines.push(line);
    if (field === 'skeleton' && s.execution_plan) {
      lines.push(`- ${L.executionPlan}: ${s.execution_plan.steps.map(st => st.task).join(' → ')}`);
    }
  }
  return lines.join('\n');
}

/** 현재 컨텍스트의 대략적 토큰 수 추정 */
export function estimateTokens(text: string): number {
  // 한국어는 ~2 chars/token, 영어는 ~4 chars/token
  return Math.ceil(text.length / 2.5);
}

/** 컨텍스트가 토큰 예산을 초과하는지 체크 */
export function shouldCompact(
  questionsAndAnswers: QAPair[],
  maxTokenBudget = 3000
): boolean {
  const raw = questionsAndAnswers.map((qa) =>
    qa.question.text + qa.answer.value
  ).join('');
  return estimateTokens(raw) > maxTokenBudget;
}
