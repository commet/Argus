/**
 * Boss Simulator — Curated Scenarios
 * 대화 종료 후 "이 상황도 해보세요" 추천용
 */

export interface Scenario {
  id: string;
  emoji: string;
  text: string;           // LLM에 보내는 실제 텍스트 (ko)
  textEn: string;         // LLM에 보내는 실제 텍스트 (en)
  displayText: string;    // UI에 표시되는 짧은 제목 (ko)
  displayTextEn: string;  // UI에 표시되는 짧은 제목 (en)
  category: 'negotiation' | 'feedback' | 'daily' | 'growth' | 'conflict';
  difficulty: 'easy' | 'medium' | 'hard';
}

export const SCENARIOS: Scenario[] = [
  // 협상
  { id: 'raise', emoji: '💰', text: '연봉 인상을 요청하고 싶습니다', textEn: "I'd like to ask for a raise.", displayText: '연봉 협상', displayTextEn: 'Salary negotiation', category: 'negotiation', difficulty: 'medium' },
  { id: 'remote', emoji: '🏠', text: '재택근무를 좀 더 하고 싶은데요', textEn: "I'd like to work from home a bit more.", displayText: '재택 확대', displayTextEn: 'More remote work', category: 'negotiation', difficulty: 'easy' },
  { id: 'headcount', emoji: '👥', text: '프로젝트에 인력이 부족해서 추가 충원을 요청드립니다', textEn: "We're short-staffed on the project, so I'd like to request additional headcount.", displayText: '인력 충원', displayTextEn: 'More headcount', category: 'negotiation', difficulty: 'hard' },
  // 피드백
  { id: 'review-dispute', emoji: '📊', text: '이번 성과 평가 결과에 대해 이의가 있습니다', textEn: 'I have an objection to my performance review this cycle.', displayText: '평가 이의', displayTextEn: 'Disputing a review', category: 'feedback', difficulty: 'hard' },
  { id: 'counter-feedback', emoji: '🗣️', text: '지난번에 주신 피드백에 대해 다시 말씀드리고 싶은 게 있어요', textEn: "There's something I'd like to revisit about the feedback you gave me last time.", displayText: '피드백 반론', displayTextEn: 'Pushing back on feedback', category: 'feedback', difficulty: 'hard' },
  { id: 'team-conflict', emoji: '😤', text: '같은 팀 동료와 갈등이 좀 있어서 상담드리고 싶습니다', textEn: "I'm having some conflict with a teammate and wanted to talk it through.", displayText: '동료 갈등', displayTextEn: 'Coworker conflict', category: 'feedback', difficulty: 'medium' },
  // 일상
  { id: 'early-leave', emoji: '🕐', text: '오늘 칼퇴 좀 해도 될까요', textEn: 'Would it be okay if I left right on time today?', displayText: '칼퇴 요청', displayTextEn: 'Leaving on time', category: 'daily', difficulty: 'easy' },
  { id: 'less-meetings', emoji: '📅', text: '회의를 좀 줄일 수 있을까요?', textEn: 'Could we cut down on meetings a bit?', displayText: '회의 축소', displayTextEn: 'Fewer meetings', category: 'daily', difficulty: 'easy' },
  { id: 'scope', emoji: '📋', text: '제 업무 범위가 좀 애매한 것 같아서요', textEn: 'I feel like my role scope is a bit unclear.', displayText: '업무 범위', displayTextEn: 'Role scope', category: 'daily', difficulty: 'medium' },
  // 성장
  { id: 'lead', emoji: '🚀', text: '제가 이번에 리드 한번 맡아봐도 될까요?', textEn: 'Could I take the lead on this one?', displayText: '리드 자원', displayTextEn: 'Volunteering to lead', category: 'growth', difficulty: 'medium' },
  { id: 'conference', emoji: '🎓', text: '이번 달에 컨퍼런스가 있는데 참석하고 싶습니다', textEn: "There's a conference this month and I'd like to attend.", displayText: '컨퍼런스', displayTextEn: 'Conference', category: 'growth', difficulty: 'easy' },
  { id: 'transfer', emoji: '🔀', text: '다른 부서로 이동하고 싶은 마음이 있습니다', textEn: "I've been thinking about transferring to another team.", displayText: '부서 이동', displayTextEn: 'Team transfer', category: 'growth', difficulty: 'hard' },
  // 갈등
  { id: 'unfair', emoji: '⚖️', text: '업무 분배가 좀 불공정한 것 같아서요', textEn: 'I feel the workload distribution is a bit unfair.', displayText: '불공정 항의', displayTextEn: 'Unfair workload', category: 'conflict', difficulty: 'hard' },
  { id: 'resign', emoji: '🚪', text: '퇴사를 고민하고 있습니다', textEn: "I'm thinking about resigning.", displayText: '퇴사 전달', displayTextEn: 'Resigning', category: 'conflict', difficulty: 'hard' },
  { id: 'mistake', emoji: '😰', text: '실수가 있었는데 보고드리고 수습 방안을 가져왔습니다', textEn: "I made a mistake — I'm here to report it and bring a plan to fix it.", displayText: '실수 보고', displayTextEn: 'Reporting a mistake', category: 'conflict', difficulty: 'medium' },
];

const CATEGORY_LABELS: Record<Scenario['category'], string> = {
  negotiation: '협상', feedback: '피드백', daily: '일상', growth: '성장', conflict: '갈등',
};

const DIFFICULTY_LABELS: Record<Scenario['difficulty'], { label: string; color: string }> = {
  easy: { label: '쉬움', color: 'var(--success)' },
  medium: { label: '보통', color: 'var(--warning)' },
  hard: { label: '어려움', color: 'var(--danger)' },
};

const DIFFICULTY_LABELS_EN: Record<Scenario['difficulty'], { label: string; color: string }> = {
  easy: { label: 'Easy', color: 'var(--success)' },
  medium: { label: 'Medium', color: 'var(--warning)' },
  hard: { label: 'Hard', color: 'var(--danger)' },
};

/** Locale-aware difficulty label (color is locale-independent). */
export function getDifficultyLabel(difficulty: Scenario['difficulty'], locale: 'ko' | 'en') {
  return (locale === 'en' ? DIFFICULTY_LABELS_EN : DIFFICULTY_LABELS)[difficulty];
}

export { CATEGORY_LABELS, DIFFICULTY_LABELS, DIFFICULTY_LABELS_EN };

/**
 * 대화 종료 후 3개 시나리오 추천.
 * @param currentScenarioId 방금 한 시나리오 ID (없으면 null)
 * @param currentCategory 방금 한 카테고리 (키워드 감지)
 */
export function pickScenarios(
  currentScenarioId: string | null,
  currentCategory: Scenario['category'] | null,
): Scenario[] {
  const available = SCENARIOS.filter(s => s.id !== currentScenarioId);

  const picks: Scenario[] = [];
  const used = new Set<string>();

  // 1. 다른 카테고리에서 1개
  const diffCategory = available.filter(s => s.category !== currentCategory);
  if (diffCategory.length > 0) {
    const pick = diffCategory[Math.floor(Math.random() * diffCategory.length)];
    picks.push(pick);
    used.add(pick.id);
  }

  // 2. 같은 카테고리에서 다른 난이도 1개
  if (currentCategory) {
    const sameCategory = available.filter(s => s.category === currentCategory && !used.has(s.id));
    if (sameCategory.length > 0) {
      const pick = sameCategory[Math.floor(Math.random() * sameCategory.length)];
      picks.push(pick);
      used.add(pick.id);
    }
  }

  // 3. 랜덤 1개 (중복 제외)
  const remaining = available.filter(s => !used.has(s.id));
  if (remaining.length > 0 && picks.length < 3) {
    const pick = remaining[Math.floor(Math.random() * remaining.length)];
    picks.push(pick);
  }

  // 부족하면 채우기
  while (picks.length < 3 && available.length > picks.length) {
    const r = available.filter(s => !picks.some(p => p.id === s.id));
    if (r.length === 0) break;
    picks.push(r[Math.floor(Math.random() * r.length)]);
  }

  return picks.slice(0, 3);
}

/**
 * 사용자 입력에서 카테고리 감지
 */
export function detectCategory(text: string): Scenario['category'] | null {
  const t = text.toLowerCase();
  if (/연봉|인상|급여|재택|인력|충원/.test(t)) return 'negotiation';
  if (/평가|피드백|반론|갈등|동료/.test(t)) return 'feedback';
  if (/칼퇴|회의|업무.*범위|일정/.test(t)) return 'daily';
  if (/리드|컨퍼런스|이동|성장|교육/.test(t)) return 'growth';
  if (/퇴사|불공정|실수|항의/.test(t)) return 'conflict';
  return null;
}
