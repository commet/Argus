// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import {
  BOSS_DRAFT_MAX_AGE_MS,
  BOSS_DRAFT_VERSION,
  loadBossDraft,
  saveBossDraft,
} from '@/lib/boss/boss-draft';
import { STORAGE_KEYS } from '@/lib/storage';

const baseDraft = {
  setupSituation: '다음 주 재택근무를 요청하고 싶어요',
  axes: { ei: 'E' as const, sn: 'S' as const, tf: 'T' as const, jp: 'J' as const },
  gender: '남' as const,
  birthYear: 1988,
  birthMonth: 5,
  birthDay: 12,
  messages: [],
  phase: 'setup' as const,
  lastSituation: '',
  loadedAgentId: null,
  userContextHint: '마감 직전에는 예민해져요',
};

beforeEach(() => localStorage.clear());

describe('boss rehearsal draft', () => {
  it('round-trips a versioned local draft', () => {
    const saved = saveBossDraft(baseDraft, 10_000);

    expect(saved).toMatchObject({ version: BOSS_DRAFT_VERSION, savedAt: 10_000 });
    expect(loadBossDraft(10_001)).toEqual(saved);
  });

  it('expires old drafts and removes invalid payloads', () => {
    saveBossDraft(baseDraft, 10_000);
    expect(loadBossDraft(10_000 + BOSS_DRAFT_MAX_AGE_MS + 1)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.BOSS_DRAFT)).toBeNull();

    localStorage.setItem(STORAGE_KEYS.BOSS_DRAFT, JSON.stringify({ version: 1, savedAt: 20_000 }));
    expect(loadBossDraft(20_001)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.BOSS_DRAFT)).toBeNull();
  });

  it('keeps only the latest 40 messages', () => {
    const messages = Array.from({ length: 45 }, (_, index) => ({
      id: `message-${index}`,
      role: (index % 2 ? 'assistant' : 'user') as 'assistant' | 'user',
      content: `turn ${index}`,
      timestamp: index,
    }));

    const saved = saveBossDraft({ ...baseDraft, messages }, 30_000);
    expect(saved?.messages).toHaveLength(40);
    expect(saved?.messages[0].id).toBe('message-5');
  });

  it('removes storage when there is no meaningful work', () => {
    saveBossDraft(baseDraft, 40_000);
    const empty = {
      ...baseDraft,
      setupSituation: '',
      birthYear: 0,
      birthMonth: 0,
      birthDay: 0,
      userContextHint: '',
    };

    expect(saveBossDraft(empty, 40_001)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.BOSS_DRAFT)).toBeNull();
  });
});
