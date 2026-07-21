import { getStorage, removeStorage, setStorage, STORAGE_KEYS } from '@/lib/storage';

export const BOSS_DRAFT_VERSION = 1;
export const BOSS_DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface BossDraftMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface BossDraft {
  version: typeof BOSS_DRAFT_VERSION;
  savedAt: number;
  setupSituation: string;
  axes: { ei: 'E' | 'I'; sn: 'S' | 'N'; tf: 'T' | 'F'; jp: 'J' | 'P' };
  gender: '남' | '여';
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  messages: BossDraftMessage[];
  phase: 'setup' | 'chat';
  lastSituation: string;
  loadedAgentId: string | null;
  userContextHint: string;
}

type DraftInput = Omit<BossDraft, 'version' | 'savedAt'>;

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isAxis = <T extends string>(value: unknown, options: readonly T[]): value is T =>
  typeof value === 'string' && options.includes(value as T);

export function isBossDraft(value: unknown, now = Date.now()): value is BossDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<BossDraft>;
  if (draft.version !== BOSS_DRAFT_VERSION || !isFiniteNumber(draft.savedAt)) return false;
  if (draft.savedAt > now + 60_000 || now - draft.savedAt > BOSS_DRAFT_MAX_AGE_MS) return false;
  if (!draft.axes || !isAxis(draft.axes.ei, ['E', 'I']) || !isAxis(draft.axes.sn, ['S', 'N'])
    || !isAxis(draft.axes.tf, ['T', 'F']) || !isAxis(draft.axes.jp, ['J', 'P'])) return false;
  if (!isAxis(draft.gender, ['남', '여']) || !isAxis(draft.phase, ['setup', 'chat'])) return false;
  if (![draft.birthYear, draft.birthMonth, draft.birthDay].every(isFiniteNumber)) return false;
  if (typeof draft.setupSituation !== 'string' || typeof draft.lastSituation !== 'string'
    || typeof draft.userContextHint !== 'string') return false;
  if (draft.loadedAgentId !== null && typeof draft.loadedAgentId !== 'string') return false;
  if (!Array.isArray(draft.messages) || draft.messages.length > 40) return false;
  return draft.messages.every((message) => Boolean(message)
    && typeof message.id === 'string'
    && isAxis(message.role, ['user', 'assistant'])
    && typeof message.content === 'string'
    && isFiniteNumber(message.timestamp));
}

export function hasMeaningfulBossDraft(draft: DraftInput): boolean {
  return Boolean(
    draft.setupSituation.trim()
    || draft.messages.length
    || draft.userContextHint.trim()
    || draft.birthYear
    || draft.loadedAgentId,
  );
}

export function saveBossDraft(input: DraftInput, now = Date.now()): BossDraft | null {
  if (!hasMeaningfulBossDraft(input)) {
    removeStorage(STORAGE_KEYS.BOSS_DRAFT);
    return null;
  }
  const draft: BossDraft = {
    ...input,
    version: BOSS_DRAFT_VERSION,
    savedAt: now,
    setupSituation: input.setupSituation.slice(0, 500),
    userContextHint: input.userContextHint.slice(0, 140),
    messages: input.messages.slice(-40),
  };
  setStorage(STORAGE_KEYS.BOSS_DRAFT, draft);
  return draft;
}

export function loadBossDraft(now = Date.now()): BossDraft | null {
  const draft = getStorage<unknown>(STORAGE_KEYS.BOSS_DRAFT, null);
  if (!isBossDraft(draft, now)) {
    removeStorage(STORAGE_KEYS.BOSS_DRAFT);
    return null;
  }
  return draft;
}

export function clearBossDraft(): void {
  removeStorage(STORAGE_KEYS.BOSS_DRAFT);
}
