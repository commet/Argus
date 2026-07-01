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
  SETTINGS: 'sot_settings',
  PROGRESSIVE_SESSIONS: 'sot_progressive_sessions',
  WORKER_PERSONAS: 'sot_worker_personas',
  AGENTS: 'sot_agents',
  AGENT_CHAINS: 'sot_agent_chains',
  AGENT_ACTIVITIES: 'sot_agent_activities',
  EXECUTION_TRANSCRIPTS: 'sot_execution_transcripts',
  BOSS_COLLECTION: 'sot_boss_collection',
  DECISION_ITEMS: 'sot_decision_items',
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
