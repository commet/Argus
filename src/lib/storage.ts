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
} as const;

export function getStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
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
