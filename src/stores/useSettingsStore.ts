import { create } from 'zustand';
import type { Settings } from '@/stores/types';
import { getStorage, setStorage, STORAGE_KEYS } from '@/lib/storage';
import { DEFAULT_OPENAI_MODEL, DEFAULT_GEMINI_MODEL } from '@/lib/llm-models';

const DEFAULT_SETTINGS: Settings = {
  anthropic_api_key: '',
  openai_api_key: '',
  gemini_api_key: '',
  llm_provider: 'anthropic',
  openai_model: DEFAULT_OPENAI_MODEL,
  gemini_model: DEFAULT_GEMINI_MODEL,
  llm_mode: 'proxy',
  local_endpoint: '',
  // en-first: the source language. A returning user's stored choice wins via
  // the spread-merge in loadSettings; only fresh installs get this default.
  language: 'en',
  audio_enabled: false,
  audio_volume: 0.15,
  all_output_formats: false,
  new_arc_enabled: false,
  classic_session: false,
  // The decision map is supporting evidence, not the first task. Fresh users
  // begin with the slim spine and can expand it when they want to retrace.
  // Returning users keep their explicit stored choice.
  voyage_map_collapsed: true,
};

/**
 * True when the user runs on THEIR OWN API key (they pay their own bill), which
 * mirrors the routing in lib/llm.ts: OpenAI/Gemini providers are always direct
 * with their key; Anthropic is direct only in 'direct' mode with a key present.
 * The document-review free-use gate keys off this — own key ⇒ unlimited.
 */
export function hasOwnApiKey(settings: Settings): boolean {
  const provider = settings.llm_provider || 'anthropic';
  if (provider === 'openai') return !!settings.openai_api_key;
  if (provider === 'gemini') return !!settings.gemini_api_key;
  return settings.llm_mode === 'direct' && !!settings.anthropic_api_key;
}

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
