// @vitest-environment jsdom
/**
 * The costume rule cuts one way only: builtin personas lose their fictional
 * names (functional review labels), but a USER-authored identity — a custom
 * persona, or a builtin the user renamed — keeps the user's chosen name.
 * Anonymizing the user's own artifact would violate honest authorship.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { personaName, personaReviewLabel } from '../shared/persona-format';
import type { WorkerPersona } from '@/stores/types';

const base: Omit<WorkerPersona, 'id' | 'name'> = {
  role: '재무 검토', emoji: '', expertise: '', tone: '', color: '#000000',
};

beforeEach(() => {
  localStorage.clear();
});

describe('persona display — user-authored names survive the costume strip', () => {
  it('a custom persona keeps the user-chosen name', () => {
    const custom: WorkerPersona = { id: 'custom-1721', name: '김 팀장', ...base };
    expect(personaName(custom, 'ko')).toBe('김 팀장');
    expect(personaReviewLabel(custom, 'ko')).toBe('김 팀장');
  });

  it('an untouched builtin gets the functional label, never the fictional name', () => {
    const builtin: WorkerPersona = { id: 'critic', name: '현우', ...base };
    expect(personaName(builtin, 'ko')).toBe('위험 검토');
    expect(personaName(builtin, 'en')).toBe('Risk review');
  });

  it('a builtin the user renamed keeps the renamed identity', () => {
    const key = Object.keys(localStorage).length; // ensure clean slate assumption visible
    expect(key).toBe(0);
    // Mirror the storage shape worker-personas persists (nameOverrides map).
    const storageKey = 'sot_worker_personas';
    localStorage.setItem(storageKey, JSON.stringify({ nameOverrides: { critic: '박 부장' }, customPersonas: [] }));
    const renamed: WorkerPersona = { id: 'critic', name: '박 부장', ...base };
    expect(personaName(renamed, 'ko')).toBe('박 부장');
  });
});
