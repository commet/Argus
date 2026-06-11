import { create } from 'zustand';
import type { Settings } from '@/stores/types';
import { getStorage, setStorage, STORAGE_KEYS } from '@/lib/storage';

const DEFAULT_SETTINGS: Settings = {
  anthropic_api_key: '',
  openai_api_key: '',
  gemini_api_key: '',
  llm_provider: 'anthropic',
  openai_model: 'gpt-4o',
  gemini_model: 'gemini-2.5-flash',
  llm_mode: 'proxy',
  local_endpoint: '',
  language: 'ko',
  audio_enabled: false,
  audio_volume: 0.15,
  all_output_formats: false,
  new_arc_enabled: false,
  classic_session: false,
};

interface SettingsState {
  settings: Settings;
  loadSettings: () => void;
  updateSettings: (data: Partial<Settings>) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,

  loadSettings: () => {
    // Merge over defaults: stored settings predate fields added later
    // (audio_volume, classic_session, new_arc_enabled, …) — without the spread
    // those load as undefined and leak into math/UI (NaN volume slider).
    const settings: Settings = { ...DEFAULT_SETTINGS, ...getStorage<Partial<Settings>>(STORAGE_KEYS.SETTINGS, {}) };
    // auto-detect mode based on saved api key
    if (settings.anthropic_api_key && settings.llm_mode === 'proxy' && (settings.llm_provider || 'anthropic') === 'anthropic') {
      settings.llm_mode = 'direct';
    }
    // OpenAI/Gemini provider always uses direct mode
    if ((settings.llm_provider || 'anthropic') === 'openai' || (settings.llm_provider || 'anthropic') === 'gemini') {
      settings.llm_mode = 'direct';
    }
    set({ settings });
  },

  updateSettings: (data) => {
    const settings = { ...get().settings, ...data };
    set({ settings });
    setStorage(STORAGE_KEYS.SETTINGS, settings);
  },
}));
