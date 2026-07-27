// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '@/lib/storage';
import { hasOwnApiKey, useSettingsStore } from '../useSettingsStore';

describe('settings provider routing', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('preserves an explicit proxy choice when an Anthropic key remains saved', () => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({
      llm_provider: 'anthropic',
      llm_mode: 'proxy',
      anthropic_api_key: 'sk-ant-dormant',
    }));

    useSettingsStore.getState().loadSettings();

    const settings = useSettingsStore.getState().settings;
    expect(settings.llm_mode).toBe('proxy');
    expect(hasOwnApiKey(settings)).toBe(false);
  });

  it('infers direct only for legacy storage that has no mode field', () => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({
      llm_provider: 'anthropic',
      anthropic_api_key: 'sk-ant-legacy',
    }));

    useSettingsStore.getState().loadSettings();

    const settings = useSettingsStore.getState().settings;
    expect(settings.llm_mode).toBe('direct');
    expect(hasOwnApiKey(settings)).toBe(true);
  });
});
