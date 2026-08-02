import type { DecisionItem } from './decision-items';
import { activeItems } from './decision-items';
import { sameClaim } from './premise-shape';

/**
 * 판단 패턴 — **세되, 판정하지 않는다** (2026-07-30, 기획 4단계의 기본형).
 *
 * ── 경계선이 이 파일의 존재 이유다 ─────────────────────────────────────
 * CLAUDE.md 스파인 2항: 사용자가 어떤 사람인지에 대한 평결(점수·등급·성향)은
 * 사용자에게 보여주지 않는다. 그 선 안에서 패턴이 할 수 있는 일은 하나 —
 * **이미 저장된 사실을 세어서 나란히 놓는 것.**
 *
 *   ✗ "당신은 낙관적인 전제를 자주 깝니다"   ← 사람에 대한 평결
 *   ✓ "이 전제가 결정 4건에 깔려 있어요"      ← 기록에 대한 사실
 *
 * 여기 함수들은 전부 count 와 group 이다. 문장을 만들지 않고, 무게를 달지
 * 않고, 추천하지 않는다. 화면이 이 사실들을 어떻게 읽을지는 사용자의 몫이다.
 *
 * ── 왜 지금 지어도 되나 ────────────────────────────────────────────────
 * 패턴의 상급형(의미 관계·코칭)은 O4 게이트 뒤에 있다(ADR K0 §6 — resolved
 * case 3건 전). 그건 **판정하는** 패턴 얘기다. 여기는 정산이 하나도 없어도
 * 성립하는 사실들만 있다 — 전제 두 건이 같으면 "같다"는 오늘도 사실이다.
 *
 * Pure. 저장소를 모른다 — 호출부가 items 와 결정 목록을 준다.
 */

/** 패턴이 아는 결정의 최소 모양 — 저장소 중립. */
export interface PatternDecision {
  id: string;
  name: string;
  /** 봉인된 결정만 "맨몸 봉인" 셈에 들어간다 — 미봉인 결정에 전제가 없는 건 당연하다. */
  sealed: boolean;
}

/** 같은 전제 위에 선 결정들 — 연결의 사실. */
export interface SharedPremiseGroup {
  /** 대표 문장 = 그룹에서 가장 먼저 저장된 것 (지어내지 않는다). */
  text: string;
  decisionIds: string[];
}

/**
 * 서로 다른 결정 2건 이상이 같은 주장(sameClaim)의 전제 위에 서 있는 그룹.
 * 한 결정 안의 중복은 연결이 아니다 — 결정 id 로 dedup 한다.
 */
export function sharedPremiseGroups(items: readonly DecisionItem[] | undefined): SharedPremiseGroup[] {
  const premises = activeItems([...(items ?? [])]).filter((i) => i.type === 'premise');
  const groups: Array<{ text: string; ids: Set<string> }> = [];
  for (const p of premises) {
    const hit = groups.find((g) => g.text === p.text || sameClaim(g.text, p.text));
    if (hit) hit.ids.add(p.decision_id);
    else groups.push({ text: p.text, ids: new Set([p.decision_id]) });
  }
  return groups
    .filter((g) => g.ids.size >= 2)
    .map((g) => ({ text: g.text, decisionIds: [...g.ids] }))
    .sort((a, b) => b.decisionIds.length - a.decisionIds.length);
}

/** 아직 답하지 않은 질문들 — 잔량의 사실. */
export interface OpenQuestionFact {
  text: string;
  decisionId: string;
  /** 며칠째 열려 있나 (생성일 기준, 내림). */
  openForDays: number;
}

export function openQuestions(items: readonly DecisionItem[] | undefined, now: number): OpenQuestionFact[] {
  return activeItems([...(items ?? [])])
    .filter((i) => i.type === 'open_question')
    .map((i) => ({
      text: i.text,
      decisionId: i.decision_id,
      openForDays: Math.max(0, Math.floor((now - Date.parse(i.created_at)) / 86_400_000)),
    }))
    .sort((a, b) => b.openForDays - a.openForDays);
}

/** 전제 없이 봉인된 결정 — 빈칸의 사실. 지우지 않고 센다. */
export function sealedWithoutPremises(
  decisions: readonly PatternDecision[] | undefined,
  items: readonly DecisionItem[] | undefined,
): PatternDecision[] {
  // The label says premises, so only a premise can satisfy it. An unanswered
  // question, observation, or criterion is useful material but does not tell
  // us what the sealed judgment rests on.
  const withPremises = new Set(
    activeItems([...(items ?? [])])
      .filter((item) => item.type === 'premise')
      .map((item) => item.decision_id),
  );
  return (decisions ?? []).filter((d) => d.sealed && !withPremises.has(d.id));
}

/** 화면 한 장에 다 넣기 위한 묶음. */
export interface JudgmentPatternFacts {
  shared: SharedPremiseGroup[];
  questions: OpenQuestionFact[];
  bare: PatternDecision[];
  /** 활성 전제 총수 — 위 사실들의 분모. */
  premiseCount: number;
}

export function judgmentPatternFacts(
  decisions: readonly PatternDecision[] | undefined,
  items: readonly DecisionItem[] | undefined,
  now: number,
): JudgmentPatternFacts {
  return {
    shared: sharedPremiseGroups(items),
    questions: openQuestions(items, now),
    bare: sealedWithoutPremises(decisions, items),
    premiseCount: activeItems([...(items ?? [])]).filter((i) => i.type === 'premise').length,
  };
}
