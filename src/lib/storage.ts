export const STORAGE_KEYS = {
  REFRAME_LIST: 'sot_reframe_list',
  SYNTHESIZE_LIST: 'sot_synthesize_list',
  RECAST_LIST: 'sot_recast_list',
  PERSONAS: 'sot_personas',
  FEEDBACK_HISTORY: 'sot_feedback_history',
  PROJECTS:          'sot_projects',
  JUDGMENTS:         'sot_judgments',
  ACCURACY_RATINGS:  'sot_accuracy_ratings',
  QUALITY_SIGNALS:   'sot_quality_signals',
  EVAL_RECAST:  'argus_eval_recast',
  EVAL_REHEARSAL:    'argus_eval_rehearsal',
  OUTCOME_RECORDS:   'sot_outcome_records',
  RETROSPECTIVE_ANSWERS: 'sot_retrospective_answers',
  DQ_SCORES: 'sot_dq_scores',
  VITALITY_ASSESSMENTS: 'sot_vitality_assessments',
  SELF_KNOWLEDGE_CLAIMS: 'sot_epistemic_claims',
  INFLUENCE_GRANTS: 'sot_epistemic_influence_grants',
  INFLUENCE_TRACES: 'sot_epistemic_influence_traces',
  CLAIM_REVIEW_EVENTS: 'sot_epistemic_claim_review_events',
  SETTINGS: 'sot_settings',
  PROGRESSIVE_SESSIONS: 'sot_progressive_sessions',
  WORKER_PERSONAS: 'sot_worker_personas',
  AGENTS: 'sot_agents',
  AGENT_CHAINS: 'sot_agent_chains',
  AGENT_ACTIVITIES: 'sot_agent_activities',
  EXECUTION_TRANSCRIPTS: 'sot_execution_transcripts',
  BOSS_COLLECTION: 'sot_boss_collection',
  DECISION_ITEMS: 'sot_decision_items',
  REVIEW_RECEIPTS: 'sot_review_receipts',
  // 문서 업로드 검수 무료 1회 소진 플래그 (BYOK 유도). 자기 API 키를 연결하지
  // 않은 사용자는 문서 검수가 토큰을 많이 써서 평생 1회로 제한한다. 이 키가
  // '1'이면 무료 1회를 이미 썼다는 뜻 — 키 연결 전까지 재검수 차단. 기기별
  // 부울 1개, 개인정보 없음. 유실(스토리지 초기화)되면 무료 1회가 복원될 뿐이며,
  // 실제 비용 상한은 서버측 일일 레이트리밋(quota-config)이 별도로 지킨다.
  REVIEW_FREE_USED: 'sot_review_free_used',
  // Workspace landing lantern (P0-6 ②) — the local date (YYYY-MM-DD) the user
  // tapped "나중에 할게요". Same-day snooze ONLY: it re-renders the next day.
  // Never a permanent dismiss (a lantern that goes out forever kills the
  // return loop the product promises).
  LANTERN_SNOOZE: 'argus:lantern-snooze',
  // Session-expiry honesty (P0-5) — set to '1' once this browser completes a
  // sign-in. A single boolean (no name/email). Lets logged-out surfaces tell a
  // returning account-holder ("session expired") apart from a first-time
  // anonymous visitor ("free trial"). clearAllStorage() removes it on explicit
  // sign-out, so a deliberate sign-out never reads as an expiry.
  KNEW_YOU: 'argus:knew-you',
  // 3고리 의식 (P1-A5 = 08 S5) — true once the merged settled count first
  // reached SETTLED_THRESHOLD and the one-time line was shown. Lifetime-once
  // guard for the ONLY threshold the spine can mark (a sample-size fact the
  // product already codified, dim9) — never repeats, never becomes a streak.
  THIRD_LOOP_SEEN: 'argus:third-loop-seen',
  // 회고→실봉인 전환 계측 플래그 (베팅③ C4 / W3 항목 10). 회고(연습) 고리를
  // 한 번이라도 정산해 닫으면 '1'. SealMoment가 이 플래그를 읽어, 회고 이후
  // 첫 진짜 봉인 때 first_real_seal_after_retro를 정확히 한 번 발화한다("3분
  // 완주=병목 해소" 주장의 유일한 실증 신호). 기기별 부울 1개, 유실 무해
  // (계측이 한 번 덜 잡힐 뿐 — 사용자 데이터 아님).
  RETRO_SETTLED: 'argus:retro-settled',
} as const;

export function getStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(key);
    if (!item) return fallback;
    const parsed = JSON.parse(item);
    // Read-side hydration guard. Old/corrupt/concurrently-mangled localStorage
    // can hold a value of the wrong shape (e.g. an object where the caller's
    // fallback is an array). Returning it unchecked crashes consumers that
    // immediately `.filter`/`.map`/`.length` the result on hydration. When the
    // stored shape can't satisfy `T`, fall back instead of handing back a
    // land-mine. Conservative: only reject clear mismatches (null/undefined, or
    // array-vs-non-array), never narrow further than the fallback already implies.
    if (parsed === null || parsed === undefined) return fallback;
    if (Array.isArray(fallback) !== Array.isArray(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function setStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Use console directly to avoid circular dependency with logger
    if (typeof console !== 'undefined') console.error('[storage] localStorage write failed:', e);
    // Surface to the user — a swallowed write means lost work (esp. QuotaExceededError).
    // A window CustomEvent (no store/logger import) avoids the same circular-dependency risk noted above.
    if (typeof window !== 'undefined') {
      const quota = e instanceof Error && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED');
      window.dispatchEvent(new CustomEvent('argus:storage-error', { detail: { key, quota } }));
    }
  }
}

export function removeStorage(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key);
}

export function clearAllStorage(): void {
  if (typeof window === 'undefined') return;
  Object.values(STORAGE_KEYS).forEach((key) => {
    localStorage.removeItem(key);
  });
}
