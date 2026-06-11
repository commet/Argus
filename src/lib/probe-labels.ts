/**
 * Probe executor labels — DISPLAY ONLY (W1.5②).
 *
 * The trial-sail theater (W2.3) shows each blind divergence-probe sample as a
 * crew card. The persona here is a name and an avatar ON TOP of an already-
 * finished blind sample — nothing more:
 *
 *   ⚠️ NEVER feed these labels into a probe prompt. The whole point of the
 *   divergence measurement is that N executors got the SAME brief with ZERO
 *   differentiation instructions (차별화 지시 = 측정 오염). probe-engine.ts
 *   builds its prompts from the paragraph alone and does not import this file
 *   — keep it that way; that one-way dependency IS the acceptance criterion
 *   ("탐침 실행자 프롬프트에 페르소나 텍스트 미주입").
 *
 * The honest copy, accordingly: "같은 브리프를 따로따로 읽었어요" — the cards
 * say who read it, never that they read it differently BECAUSE of who they are.
 */

import { useAgentStore } from '@/stores/useAgentStore';

export interface ProbeExecutorLabel {
  /** Display name (existing persona name, or a neutral fallback). */
  name: string;
  /** Emoji/avatar string as used by agent cards. */
  avatar: string;
  /** Matching agent id when the label came from the roster (cosmetic link). */
  agent_id: string | null;
}

/** Neutral fallbacks when the roster is empty (anonymous first session). */
const FALLBACK_LABELS: ProbeExecutorLabel[] = [
  { name: '첫째 항해사', avatar: '⚓', agent_id: null },
  { name: '둘째 항해사', avatar: '🧭', agent_id: null },
  { name: '셋째 항해사', avatar: '🗺️', agent_id: null },
  { name: '넷째 항해사', avatar: '🔭', agent_id: null },
  { name: '다섯째 항해사', avatar: '🪢', agent_id: null },
];

/**
 * Pick n display labels for this session's probe cards. Deterministic per
 * call order (roster order), no randomness — the same session renders the
 * same crew. Reads the agent roster for name/avatar ONLY.
 */
export function probeExecutorLabels(n: number): ProbeExecutorLabel[] {
  const count = Math.max(1, Math.min(5, n));
  const agents = useAgentStore
    .getState()
    .agents.filter((a) => !a.archived && a.group !== 'people'); // boss 등 사람 원형은 제외
  const fromRoster: ProbeExecutorLabel[] = agents.slice(0, count).map((a) => ({
    name: a.name,
    avatar: a.emoji || '⚓',
    agent_id: a.id,
  }));
  if (fromRoster.length >= count) return fromRoster;
  return [...fromRoster, ...FALLBACK_LABELS.slice(0, count - fromRoster.length)];
}
