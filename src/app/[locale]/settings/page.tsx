'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { clearAllStorage, STORAGE_KEYS, getStorage } from '@/lib/storage';
import { downloadJson } from '@/lib/export';
import { deleteAllUserData } from '@/lib/db';
import type { LLMMode, LLMProvider } from '@/stores/types';
import { Download, Upload, Trash2, Eye, EyeOff, Server, Globe, Check, Volume2, TrendingUp, Brain, MessageSquare, Unlink, User, BarChart3, FlaskConical, Send, Copy, KeyRound, Loader2 } from 'lucide-react';
import { getObservationsSummary } from '@/lib/user-context';
import { assessLearningHealth } from '@/lib/learning-health';
import { playTransitionTone, resumeAudioContext, startAmbient, stopAmbient, isAmbientPlaying } from '@/lib/audio';
import { useSlackStore } from '@/stores/useSlackStore';
import { useTelegramStore } from '@/stores/useTelegramStore';
import { supabase } from '@/lib/supabase';
import { useLocale } from '@/hooks/useLocale';
import { useLocaleSwitch } from '@/hooks/useLocaleSwitch';

function buildLlmProviders(L: (ko: string, en: string) => string) {
  return [
    { value: 'anthropic' as LLMProvider, label: 'Claude', description: L('Claude Sonnet 4 — 프록시 또는 직접 API 키', 'Claude Sonnet 4 — proxy or direct API key') },
    { value: 'openai' as LLMProvider, label: 'GPT-4o', description: L('본인의 OpenAI API 키 사용', 'Use your own OpenAI API key') },
    { value: 'gemini' as LLMProvider, label: 'Gemini', description: L('본인의 Google AI API 키 사용', 'Use your own Google AI API key') },
  ];
}

function buildLlmModes(L: (ko: string, en: string) => string) {
  return [
    { value: 'proxy' as LLMMode, label: L('프록시', 'Proxy'), description: L('API 키 없이 바로 사용 (권장)', 'Use without API key (recommended)'), available: true },
    { value: 'direct' as LLMMode, label: L('직접 키', 'Direct Key'), description: L('본인의 API 키 사용. 제한 없음', 'Use your own API key. No limits'), available: true },
    { value: 'local' as LLMMode, label: L('로컬', 'Local'), description: L('Ollama 로컬 엔드포인트', 'Ollama local endpoint'), available: false },
  ];
}

export default function SettingsPage() {
  const locale = useLocale();
  const { switchTo } = useLocaleSwitch();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const llmProviders = buildLlmProviders(L);
  const llmModes = buildLlmModes(L);

  const { settings, loadSettings, updateSettings } = useSettingsStore();
  const [showKey, setShowKey] = useState(false);
  const [resetModal, setResetModal] = useState(false);
  // Mirror the ambient drone play state — startAmbient/stopAmbient alone never re-render,
  // so the button label/style would stay frozen. Synced on mount (SSR-safe).
  const [ambientOn, setAmbientOn] = useState(false);
  useEffect(() => { setAmbientOn(isAmbientPlaying()); }, []);

  // Slack
  const slackConnections = useSlackStore(s => s.connections);
  const loadSlack = useSlackStore(s => s.loadConnections);
  const disconnectSlack = useSlackStore(s => s.disconnect);
  const [slackStatus, setSlackStatus] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    loadSlack();
    // Check for Slack OAuth callback status
    const params = new URLSearchParams(window.location.search);
    const slack = params.get('slack');
    if (slack === 'connected') {
      setSlackStatus('connected');
      loadSlack();
      window.history.replaceState({}, '', '/settings');
    } else if (slack === 'error') {
      setSlackStatus('error');
      window.history.replaceState({}, '', '/settings');
    } else if (slack === 'unconfigured') {
      setSlackStatus('unconfigured');
      window.history.replaceState({}, '', '/settings');
    }
  }, [loadSettings, loadSlack]);

  const handleExport = () => {
    const data: Record<string, unknown> = {};
    for (const [name, key] of Object.entries(STORAGE_KEYS)) {
      if (name === 'SETTINGS') continue;
      data[key] = getStorage(key, null);
    }
    downloadJson(data, `argus-backup-${new Date().toISOString().split('T')[0]}.json`);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const MAX_IMPORT_SIZE = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_IMPORT_SIZE) {
      alert(L('파일 크기가 10MB를 초과합니다. 올바른 백업 파일인지 확인해주세요.', 'File exceeds 10MB. Please check if this is a valid backup file.'));
      return;
    }
    const allowedKeys: Set<string> = new Set(Object.values(STORAGE_KEYS).filter(k => k !== 'sot_settings'));
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target?.result as string);
        let imported = 0;
        for (const [key, value] of Object.entries(data)) {
          if (allowedKeys.has(key) && typeof value !== 'undefined') {
            localStorage.setItem(key, JSON.stringify(value));
            imported++;
          }
        }
        if (imported === 0) {
          alert(L('가져올 수 있는 데이터가 없습니다. 올바른 백업 파일인지 확인해주세요.', 'No importable data found. Please check if this is a valid backup file.'));
          return;
        }
        alert(L('데이터를 성공적으로 가져왔습니다. 페이지를 새로고침합니다.', 'Data imported successfully. The page will now reload.'));
        window.location.reload();
      } catch {
        alert(L('올바른 JSON 파일이 아닙니다.', 'Not a valid JSON file.'));
      }
    };
    reader.readAsText(file);
  };

  const handleReset = async () => {
    clearAllStorage();
    await deleteAllUserData();
    setResetModal(false);
    alert(L('모든 데이터가 초기화되었습니다. 페이지를 새로고침합니다.', 'All data has been reset. The page will now reload.'));
    window.location.reload();
  };

  const handleProviderChange = (provider: LLMProvider) => {
    if (provider === 'openai' || provider === 'gemini') {
      // OpenAI/Gemini always uses direct mode
      updateSettings({ llm_provider: provider, llm_mode: 'direct' });
    } else {
      updateSettings({ llm_provider: provider });
    }
  };

  const handleModeChange = (mode: LLMMode) => {
    if (mode === 'local') return;
    updateSettings({ llm_mode: mode });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-bold text-[var(--text-primary)]">{L('설정', 'Settings')}</h1>
        <p className="text-[13px] text-[var(--text-secondary)] mt-1">{L('프로필, AI 엔진, 환경 설정', 'Profile, AI engine, preferences')}</p>
      </div>

      {/* ── 1. My Profile ── */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <User size={16} className="text-[var(--accent)]" />
          <h3 className="text-[15px] font-bold">{L('내 프로필', 'My Profile')}</h3>
        </div>
        <p className="text-[12px] text-[var(--text-secondary)] mb-4">
          {L('검토 피드백(상사 시점 리뷰)의 톤과 깊이에 반영돼요.', 'Used to tune the tone and depth of review feedback (boss-perspective reviews).')}
        </p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] font-semibold text-[var(--text-secondary)] mb-1 block">{L('이름', 'Name')}</label>
              <input
                type="text"
                value={settings.user_name || ''}
                onChange={(e) => updateSettings({ user_name: e.target.value })}
                placeholder={L('홍길동', 'Your name')}
                maxLength={30}
                className="w-full bg-[var(--bg)] border-[1.5px] border-[var(--border)] rounded-[10px] px-3 py-2 text-[14px] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-[var(--text-secondary)] mb-1 block">{L('역할', 'Role')}</label>
              <input
                type="text"
                value={settings.user_role || ''}
                onChange={(e) => updateSettings({ user_role: e.target.value })}
                placeholder={L('마케터, 개발자, 기획자...', 'Marketer, Developer...')}
                maxLength={50}
                className="w-full bg-[var(--bg)] border-[1.5px] border-[var(--border)] rounded-[10px] px-3 py-2 text-[14px] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5 block">{L('경력', 'Experience')}</label>
            <div className="flex gap-1.5">
              {([
                { value: 'junior' as const, label: L('1-3년차', '1-3 yrs') },
                { value: 'mid' as const, label: L('4-7년차', '4-7 yrs') },
                { value: 'senior' as const, label: L('8년차+', '8+ yrs') },
                { value: 'lead' as const, label: L('팀장/리드', 'Lead') },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateSettings({ user_seniority: settings.user_seniority === opt.value ? undefined : opt.value })}
                  className={`flex-1 py-2 rounded-lg text-[12px] font-medium border text-center transition-colors cursor-pointer ${
                    settings.user_seniority === opt.value
                      ? 'border-[var(--accent)] bg-[var(--ai)] text-[var(--accent)]'
                      : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-[var(--text-secondary)] mb-1 block">{L('자유 소개', 'About me')}</label>
            <textarea
              value={settings.user_context || ''}
              onChange={(e) => updateSettings({ user_context: e.target.value })}
              placeholder={L('예: 스타트업에서 B2B SaaS 마케팅을 담당하고 있어요. 데이터 분석은 좀 약한 편이라 숫자 근거를 잘 챙겨주면 좋겠어요.', 'e.g., I handle B2B SaaS marketing at a startup. I\'m not great with data analysis, so I appreciate help with numbers.')}
              maxLength={300}
              rows={3}
              className="w-full bg-[var(--bg)] border-[1.5px] border-[var(--border)] rounded-[10px] px-3 py-2.5 text-[14px] leading-relaxed focus:outline-none focus:border-[var(--accent)] resize-none"
            />
          </div>
        </div>

        {/* AI Observations — read-only */}
        <ObservationsBlock locale={locale} />
      </Card>

      {/* ── 2. AI Engine (provider + mode + key merged) ── */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Server size={16} className="text-[var(--accent)]" />
          <h3 className="text-[15px] font-bold">{L('AI 엔진', 'AI Engine')}</h3>
        </div>

        {/* Provider — compact segmented control */}
        <div className="flex gap-1.5">
          {llmProviders.map((provider) => (
            <button
              key={provider.value}
              onClick={() => handleProviderChange(provider.value)}
              className={`flex-1 py-2 rounded-lg text-[12px] font-medium border text-center transition-colors cursor-pointer ${
                (settings.llm_provider || 'anthropic') === provider.value
                  ? 'border-[var(--accent)] bg-[var(--ai)] text-[var(--accent)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border)]'
              }`}
            >
              {provider.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5">
          {llmProviders.find(p => p.value === (settings.llm_provider || 'anthropic'))?.description}
        </p>

        {/* Anthropic connection mode — compact segmented control */}
        {(settings.llm_provider || 'anthropic') === 'anthropic' && (
          <div className="animate-fade-in mt-4">
            <label className="text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5 block">{L('연결 방식', 'Connection Mode')}</label>
            <div className="flex gap-1.5">
              {llmModes.filter((mode) => mode.available).map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => handleModeChange(mode.value)}
                  className={`flex-1 py-2 rounded-lg text-[12px] font-medium border text-center transition-colors cursor-pointer ${
                    settings.llm_mode === mode.value
                      ? 'border-[var(--accent)] bg-[var(--ai)] text-[var(--accent)]'
                      : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border)]'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5">
              {llmModes.find(m => m.value === settings.llm_mode)?.description}
            </p>
          </div>
        )}

        {/* Anthropic API Key */}
        {(settings.llm_provider || 'anthropic') === 'anthropic' && settings.llm_mode === 'direct' && (
          <div className="animate-fade-in mt-4">
            <label className="text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5 block">Anthropic API Key</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={settings.anthropic_api_key}
                onChange={(e) => updateSettings({ anthropic_api_key: e.target.value })}
                placeholder="sk-ant-..."
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                spellCheck={false}
                className="w-full bg-[var(--bg)] border-[1.5px] border-[var(--border)] rounded-[10px] px-3.5 py-2.5 text-[14px] font-mono focus:outline-none focus:border-[var(--accent)] pr-10"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] cursor-pointer"
                aria-label={showKey ? L('키 숨기기', 'Hide key') : L('키 보기', 'Show key')}
                aria-pressed={showKey}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        )}

        {/* OpenAI API Key + Model */}
        {(settings.llm_provider || 'anthropic') === 'openai' && (
          <div className="animate-fade-in mt-4">
            <label className="text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5 block">OpenAI API Key</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={settings.openai_api_key || ''}
                onChange={(e) => updateSettings({ openai_api_key: e.target.value })}
                placeholder="sk-..."
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                spellCheck={false}
                className="w-full bg-[var(--bg)] border-[1.5px] border-[var(--border)] rounded-[10px] px-3.5 py-2.5 text-[14px] font-mono focus:outline-none focus:border-[var(--accent)] pr-10"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] cursor-pointer"
                aria-label={showKey ? L('키 숨기기', 'Hide key') : L('키 보기', 'Show key')}
                aria-pressed={showKey}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="mt-3">
              <label className="text-[12px] text-[var(--text-secondary)] mb-1 block">{L('모델', 'Model')}</label>
              <select
                value={settings.openai_model || 'gpt-4o'}
                onChange={(e) => updateSettings({ openai_model: e.target.value })}
                className="w-full bg-[var(--bg)] border-[1.5px] border-[var(--border)] rounded-[10px] px-3.5 py-2.5 text-[14px] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
              >
                <option value="gpt-4o">GPT-4o — {L('균형 (추천)', 'Balanced (recommended)')}</option>
                <option value="gpt-4o-mini">GPT-4o Mini — {L('빠르고 저렴', 'Fast & cheap')}</option>
                <option value="gpt-4.1-mini">GPT-4.1 Mini — {L('최신 경량', 'Latest lightweight')}</option>
                <option value="gpt-4.1-nano">GPT-4.1 Nano — {L('초경량', 'Ultra lightweight')}</option>
                <option value="o3-mini">o3-mini — {L('추론 특화', 'Reasoning')}</option>
                <option value="o4-mini">o4-mini — {L('최신 추론', 'Latest reasoning')}</option>
              </select>
            </div>
          </div>
        )}

        {/* Gemini API Key + Model */}
        {(settings.llm_provider || 'anthropic') === 'gemini' && (
          <div className="animate-fade-in mt-4">
            <label className="text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5 block">Google AI API Key</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={settings.gemini_api_key || ''}
                onChange={(e) => updateSettings({ gemini_api_key: e.target.value })}
                placeholder="AIza..."
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                spellCheck={false}
                className="w-full bg-[var(--bg)] border-[1.5px] border-[var(--border)] rounded-[10px] px-3.5 py-2.5 text-[14px] font-mono focus:outline-none focus:border-[var(--accent)] pr-10"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] cursor-pointer"
                aria-label={showKey ? L('키 숨기기', 'Hide key') : L('키 보기', 'Show key')}
                aria-pressed={showKey}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="mt-3">
              <label className="text-[12px] text-[var(--text-secondary)] mb-1 block">{L('모델', 'Model')}</label>
              <select
                value={settings.gemini_model || 'gemini-2.5-flash'}
                onChange={(e) => updateSettings({ gemini_model: e.target.value })}
                className="w-full bg-[var(--bg)] border-[1.5px] border-[var(--border)] rounded-[10px] px-3.5 py-2.5 text-[14px] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash — {L('빠르고 저렴 (추천)', 'Fast & cheap (recommended)')}</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro — {L('고품질', 'High quality')}</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash — {L('초경량', 'Ultra lightweight')}</option>
              </select>
            </div>
          </div>
        )}
      </Card>

      {/* ── 3. Preferences (Language + Sound) ── */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Globe size={16} className="text-[var(--accent)]" />
          <h3 className="text-[15px] font-bold">{L('환경 설정', 'Preferences')}</h3>
        </div>

        {/* Language */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-medium text-[var(--text-primary)]">{L('언어', 'Language')}</span>
        </div>
        <div className="flex gap-2">
          {[
            { value: 'ko' as const, label: '한국어' },
            { value: 'en' as const, label: 'English' },
          ].map((lang) => (
            <button
              key={lang.value}
              onClick={() => switchTo(lang.value)}
              className={`flex-1 py-2 rounded-lg text-[13px] font-medium border text-center transition-colors cursor-pointer ${
                locale === lang.value
                  ? 'border-[var(--accent)] bg-[var(--ai)] text-[var(--accent)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border)]'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5">
          {L('일부 UI 텍스트는 아직 한국어로만 제공됩니다.', 'Partial English support. Some UI text may still appear in Korean.')}
        </p>

        {/* Sound */}
        <div className="border-t border-[var(--border-subtle)] my-4" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium">{L('전환음', 'Transition Sound')}</p>
            <p className="text-[11px] text-[var(--text-secondary)]">{L('단계 전환 시 잔잔한 항해 톤', 'A gentle voyage tone on step transitions')}</p>
          </div>
          <button
            role="switch"
            aria-checked={settings.audio_enabled}
            onClick={() => {
              const next = !settings.audio_enabled;
              updateSettings({ audio_enabled: next });
              if (next) {
                resumeAudioContext();
                playTransitionTone(settings.audio_volume);
              }
            }}
            className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
              settings.audio_enabled ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
            }`}
          >
            <span className={`block w-5 h-5 rounded-full bg-[var(--surface)] shadow-sm transition-transform ${
              settings.audio_enabled ? 'translate-x-[22px]' : 'translate-x-[2px]'
            } mt-[2px]`} />
          </button>
        </div>
        {settings.audio_enabled && (
          <div className="space-y-3 mt-3 animate-fade-in">
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-[var(--text-secondary)] w-10 shrink-0">{L('볼륨', 'Vol.')}</span>
              <input
                type="range"
                min="0"
                max="0.5"
                step="0.05"
                value={settings.audio_volume}
                onChange={(e) => updateSettings({ audio_volume: parseFloat(e.target.value) })}
                className="flex-1 accent-[var(--accent)]"
              />
              <span className="text-[12px] text-[var(--text-secondary)] w-10 text-right">{Math.round(settings.audio_volume * 200)}%</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
              <div>
                <p className="text-[13px] font-medium">{L('앰비언트 드론', 'Ambient Drone')}</p>
                <p className="text-[11px] text-[var(--text-secondary)]">{L('출항 전 항구의 따뜻한 잔향', 'The warm hum of the harbor before setting sail')}</p>
              </div>
              <button
                onClick={() => {
                  resumeAudioContext();
                  if (ambientOn) {
                    stopAmbient();
                    setAmbientOn(false);
                  } else {
                    startAmbient(settings.audio_volume);
                    setAmbientOn(true);
                  }
                }}
                aria-pressed={ambientOn}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border cursor-pointer transition-colors ${
                  ambientOn
                    ? 'border-[var(--accent)] bg-[var(--ai)] text-[var(--accent)]'
                    : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]'
                }`}
              >
                {ambientOn ? L('정지', 'Stop') : L('재생', 'Play')}
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* ── 4. Integrations & Data ── */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare size={16} className="text-[var(--accent)]" />
          <h3 className="text-[15px] font-bold">{L('연동 & 데이터', 'Integrations & Data')}</h3>
        </div>

        {/* Slack */}
        {slackStatus === 'connected' && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-[var(--collab)] border border-[var(--success)]/20">
            <p className="text-[13px] text-[var(--success)] font-medium flex items-center gap-1.5"><Check size={14} /> {L('Slack에 연결되었습니다!', 'Connected to Slack!')}</p>
          </div>
        )}
        {slackStatus === 'error' && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)]/25">
            <p className="text-[13px] text-[var(--danger)] font-medium">{L('Slack 연결에 실패했습니다. 다시 시도해주세요.', 'Slack connection failed. Please try again.')}</p>
          </div>
        )}
        {slackStatus === 'unconfigured' && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
            <p className="text-[13px] text-[var(--text-secondary)]">{L('Slack 연동이 아직 설정되지 않은 배포예요 — 운영자가 SLACK_* 환경변수를 등록하면 켜져요.', 'Slack integration isn\'t configured on this deployment yet — it turns on once the operator sets the SLACK_* environment variables.')}</p>
          </div>
        )}
        {slackConnections.length > 0 ? (
          <div className="space-y-2">
            {slackConnections.map((conn: { id: string; team_name: string }) => (
              <div key={conn.id} className="flex items-center justify-between p-3 bg-[var(--bg)] rounded-lg">
                <div>
                  <p className="text-[14px] font-medium flex items-center gap-1.5">
                    <Check size={14} className="text-[var(--success)]" /> {conn.team_name}
                  </p>
                  <p className="text-[12px] text-[var(--text-secondary)]">{L('결과를 Slack 채널로 바로 보낼 수 있습니다', 'You can send results directly to Slack channels')}</p>
                </div>
                <Button variant="danger" size="sm" onClick={() => disconnectSlack(conn.id)}>
                  <Unlink size={14} /> {L('연결 해제', 'Disconnect')}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-between p-3 bg-[var(--bg)] rounded-lg">
            <div>
              <p className="text-[14px] font-medium">{L('Slack에 연결하기', 'Connect to Slack')}</p>
              <p className="text-[12px] text-[var(--text-secondary)]">{L('결과를 팀 Slack 채널로 직접 공유', 'Share results directly to your team Slack channel')}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={async () => {
              const { data } = await (await import('@/lib/supabase')).supabase.auth.getSession();
              const token = data.session?.access_token;
              if (token) {
                window.location.href = `/api/slack/oauth?token=${token}`;
              } else {
                window.location.href = '/login?redirect=/settings';
              }
            }}>
              <MessageSquare size={14} /> {L('연결하기', 'Connect')}
            </Button>
          </div>
        )}

        {/* Telegram */}
        <div className="border-t border-[var(--border-subtle)] my-4" />
        <TelegramBlock locale={locale} />

        {/* Plugin push token */}
        <div className="border-t border-[var(--border-subtle)] my-4" />
        <PluginTokenBlock locale={locale} />

        {/* Data management */}
        <div className="border-t border-[var(--border-subtle)] my-4" />
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-[var(--bg)] rounded-lg">
            <div>
              <p className="text-[13px] font-medium">{L('데이터 내보내기', 'Export Data')}</p>
              <p className="text-[11px] text-[var(--text-secondary)]">{L('모든 데이터를 JSON으로 다운로드', 'Download all data as JSON')}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={handleExport}>
              <Download size={14} /> {L('내보내기', 'Export')}
            </Button>
          </div>
          <div className="flex items-center justify-between p-3 bg-[var(--bg)] rounded-lg">
            <div>
              <p className="text-[13px] font-medium">{L('데이터 가져오기', 'Import Data')}</p>
              <p className="text-[11px] text-[var(--text-secondary)]">{L('JSON 파일에서 복원', 'Restore from JSON file')}</p>
            </div>
            <label className="cursor-pointer">
              <span className="inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-all duration-150 active:scale-[0.98] bg-transparent border-[1.5px] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg)] px-3 py-1.5 text-[13px]">
                <Upload size={14} /> {L('가져오기', 'Import')}
              </span>
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>
          <div className="flex items-center justify-between p-3 bg-[var(--danger)]/10 rounded-lg">
            <div>
              <p className="text-[13px] font-medium text-[var(--danger)]">{L('데이터 초기화', 'Reset Data')}</p>
              <p className="text-[11px] text-[var(--danger)]/70">{L('모든 저장된 데이터를 삭제', 'Deletes all saved data')}</p>
            </div>
            <Button variant="danger" size="sm" onClick={() => setResetModal(true)}>
              <Trash2 size={14} /> {L('초기화', 'Reset')}
            </Button>
          </div>
        </div>
      </Card>

      {/* ── 5. Learning Health (conditional) ── */}
      <LearningHealthCard />

      {/* ── 6. Labs ── */}
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <FlaskConical size={16} className="text-[var(--accent)]" />
          <h3 className="text-[15px] font-bold">{L('실험실 (Labs)', 'Labs')}</h3>
        </div>
        <p className="text-[12px] text-[var(--text-secondary)] mb-4">
          {L('아직 다듬는 중인 기능이에요. 언제든 켜고 끌 수 있어요.', 'Features still being polished. Toggle anytime.')}
        </p>
        <div className="space-y-3">
          {([
            {
              key: 'new_arc_enabled' as const,
              label: L('시험 항해 (실험 중)', 'Trial Sail (experimental)'),
              desc: L('분석 단계에서 AI 실행자 여럿이 같은 글을 따로 읽고, 갈리는 지점을 측정해 보여줘요', 'In the analysis stage, several AI executors read the same text separately and show where they diverge'),
            },
            {
              key: 'classic_session' as const,
              label: L('클래식 세션 보기', 'Classic session view'),
              desc: L('항해 중 우측 기록 레일과 단계별 확인 화면을 항상 펼쳐 둬요', 'Keep the right-side log rail and per-step confirmation screens always open during a voyage'),
            },
            {
              key: 'all_output_formats' as const,
              label: L('모든 산출물 형식', 'All output formats'),
              desc: L('기본 1종 외의 산출물 형식을 모두 보여줘요', 'Show every output format beyond the single default'),
            },
          ]).map((lab) => {
            const on = !!settings[lab.key];
            return (
              <div key={lab.key} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium">{lab.label}</p>
                  <p className="text-[11px] text-[var(--text-secondary)]">{lab.desc}</p>
                </div>
                <button
                  role="switch"
                  aria-checked={on}
                  onClick={() => updateSettings({ [lab.key]: !on })}
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${
                    on ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
                  }`}
                >
                  <span className={`block w-5 h-5 rounded-full bg-[var(--surface)] shadow-sm transition-transform ${
                    on ? 'translate-x-[22px]' : 'translate-x-[2px]'
                  } mt-[2px]`} />
                </button>
              </div>
            );
          })}
        </div>
      </Card>

      <Modal open={resetModal} onClose={() => setResetModal(false)} title={L('데이터 초기화', 'Reset Data')}>
        <p className="text-[14px] text-[var(--text-primary)] mb-2">
          {L('모든 프로젝트의 분석, 초안, 검토 이력이 영구 삭제됩니다.', 'All analyses, drafts, and review history across your projects will be permanently deleted.')}
        </p>
        <p className="text-[12px] text-[var(--text-secondary)] mb-4">
          {L('저장한 팀장과 에이전트도 함께 사라집니다. 되돌릴 수 없어요.', 'Saved bosses and agents will be cleared too. This cannot be undone.')}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setResetModal(false)}>{L('취소', 'Cancel')}</Button>
          <Button variant="danger" onClick={handleReset}>{L('삭제', 'Delete')}</Button>
        </div>
      </Modal>
    </div>
  );
}

function TelegramBlock({ locale }: { locale: string }) {
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const connections = useTelegramStore((s) => s.connections);
  const loadConnections = useTelegramStore((s) => s.loadConnections);
  const startConnect = useTelegramStore((s) => s.startConnect);
  const disconnect = useTelegramStore((s) => s.disconnect);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => { loadConnections(); }, [loadConnections]);

  const handleConnect = async () => {
    setNote(null);
    setPending(true);
    const r = await startConnect();
    if (r.ok && r.link) {
      window.open(r.link, '_blank', 'noopener');
      setNote(L('텔레그램이 열리면 “시작/Start”을 눌러 주세요. 연결되면 아래에 표시돼요.',
                'When Telegram opens, tap “Start”. Once connected it appears below.'));
    } else if (r.error === 'unconfigured') {
      setNote(L('이 배포에는 아직 Telegram 봇이 설정되지 않았어요(운영자가 TELEGRAM_* 환경변수 등록 필요).',
                'Telegram bot isn’t configured on this deployment yet (operator must set TELEGRAM_* env vars).'));
    } else {
      setNote(r.error || L('연결을 시작할 수 없어요.', 'Could not start connect.'));
    }
    setPending(false);
  };

  return (
    <div>
      {connections.length > 0 ? (
        <div className="space-y-2">
          {connections.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-3 bg-[var(--bg)] rounded-lg">
              <div>
                <p className="text-[14px] font-medium flex items-center gap-1.5">
                  <Check size={14} className="text-[var(--success)]" /> {c.chat_title || L('내 Telegram', 'My Telegram')}
                </p>
                <p className="text-[12px] text-[var(--text-secondary)]">{L('결과를 이 Telegram 채팅으로 바로 보낼 수 있어요', 'Send results straight to this Telegram chat')}</p>
              </div>
              <Button variant="danger" size="sm" onClick={() => disconnect(c.id)}>
                <Unlink size={14} /> {L('연결 해제', 'Disconnect')}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-between p-3 bg-[var(--bg)] rounded-lg gap-3">
          <div>
            <p className="text-[14px] font-medium">{L('Telegram에 연결하기', 'Connect to Telegram')}</p>
            <p className="text-[12px] text-[var(--text-secondary)]">{L('결과를 Telegram으로 직접 공유', 'Share results directly to Telegram')}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={handleConnect} disabled={pending}>
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {L('연결하기', 'Connect')}
          </Button>
        </div>
      )}
      {note && <p className="text-[12px] text-[var(--text-secondary)] mt-2">{note}</p>}
      {connections.length === 0 && (
        <button onClick={() => loadConnections()} className="text-[11.5px] text-[var(--text-tertiary)] hover:text-[var(--accent)] mt-1.5 cursor-pointer transition-colors">
          {L('연결했는데 안 보이면 새로고침', 'Connected but not showing? Refresh')}
        </button>
      )}
    </div>
  );
}

interface PluginToken { id: string; label: string | null; last_used_at: string | null; created_at: string }

function PluginTokenBlock({ locale }: { locale: string }) {
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const [tokens, setTokens] = useState<PluginToken[]>([]);
  const [issued, setIssued] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const { data } = await supabase
      .from('plugin_tokens')
      .select('id, label, last_used_at, created_at')
      .order('created_at', { ascending: false });
    setTokens(data || []);
  };
  useEffect(() => { load(); }, []);

  const issue = async () => {
    setError(''); setBusy(true); setIssued(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { setError(L('로그인이 필요해요.', 'Login required.')); return; }
      const res = await fetch('/api/plugin/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ label: 'CLI' }),
      });
      const json = await res.json();
      if (json.token) { setIssued(json.token); await load(); }
      else setError(json.error || L('발급 실패', 'Could not issue'));
    } finally { setBusy(false); }
  };

  const revoke = async (id: string) => {
    await supabase.from('plugin_tokens').delete().eq('id', id);
    await load();
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[14px] font-medium flex items-center gap-1.5"><KeyRound size={14} className="text-[var(--accent)]" /> {L('플러그인 푸시 토큰', 'Plugin push token')}</p>
          <p className="text-[12px] text-[var(--text-secondary)]">{L('Claude Code 플러그인에서 argus-watch push로 결과를 자동 전송', 'Auto-send plugin results via argus-watch push')}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={issue} disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} {L('새 토큰 발급', 'Issue token')}
        </Button>
      </div>
      {error && <p className="text-[12px] text-red-600 mt-2">{error}</p>}

      {issued && (
        <div className="mt-3 p-3 rounded-lg bg-[var(--checkpoint)] border border-amber-500/30">
          <p className="text-[12px] font-medium text-[var(--text-primary)] mb-1.5">{L('이 토큰은 지금만 보여요. 복사해서 안전하게 보관하세요.', 'Shown only once. Copy and store it safely.')}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11.5px] font-mono bg-[var(--bg)] px-2.5 py-1.5 rounded-md break-all">{issued}</code>
            <Button variant="secondary" size="sm" onClick={async () => { await navigator.clipboard.writeText(issued); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </Button>
          </div>
          <p className="text-[11px] text-[var(--text-tertiary)] mt-2 font-mono">argus-watch connect --token {issued.slice(0, 14)}…</p>
        </div>
      )}

      {tokens.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {tokens.map((t) => (
            <div key={t.id} className="flex items-center justify-between text-[12px] px-2.5 py-1.5 rounded-md bg-[var(--bg)]">
              <span className="text-[var(--text-secondary)]">
                {t.label || 'CLI'} · <span className="text-[var(--text-tertiary)]">{t.last_used_at ? L('최근 사용 ', 'used ') + t.last_used_at.slice(0, 10) : L('미사용', 'unused')}</span>
              </span>
              <button onClick={() => revoke(t.id)} className="text-[var(--text-tertiary)] hover:text-[var(--danger)] cursor-pointer transition-colors">
                {L('해지', 'Revoke')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ObservationsBlock({ locale }: { locale: string }) {
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const { items, hasData } = useMemo(() => getObservationsSummary(locale as 'ko' | 'en'), [locale]);

  if (!hasData) return null;

  return (
    <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
      <div className="flex items-center gap-1.5 mb-2.5">
        <BarChart3 size={12} className="text-[var(--text-tertiary)]" />
        <span className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">{L('나의 사용 현황', 'My Usage')}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item, i) => (
          <div key={i} className="px-3 py-2 rounded-lg bg-[var(--bg)]">
            <p className="text-[10px] text-[var(--text-tertiary)] mb-0.5">{item.label}</p>
            <p className="text-[13px] font-medium text-[var(--text-primary)]">{item.value}</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-[var(--text-tertiary)] mt-2">{L('사용할수록 AI가 나에게 맞는 피드백을 줍니다.', 'The more you use it, the better AI adapts to you.')}</p>
    </div>
  );
}

function LearningHealthCard() {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const health = useMemo(() => assessLearningHealth(), []);

  // Only show once there is real underlying data — the legacy 4R flow was the
  // only writer of these signals, so for most users this card would otherwise
  // sit at "Tier 1 · 0 signals · not enough data" forever.
  if (!health) return null;
  if ((health.signal_count || 0) === 0 && (health.learning_tier || 1) <= 1) return null;

  const tierLabels = { 1: L('시작', 'Start'), 2: L('학습 중', 'Learning'), 3: L('최적화', 'Optimized') } as Record<number, string>;
  const tierColors = { 1: 'text-[var(--text-secondary)]', 2: 'text-[var(--accent)]', 3: 'text-[var(--success)]' };
  const trendIcons = { improving: '↗', stable: '→', not_enough_data: '—' };
  const trendLabels = { improving: L('개선 중', 'Improving'), stable: L('안정', 'Stable'), not_enough_data: L('데이터 부족', 'Not enough data') };

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <Brain size={16} className="text-[var(--accent)]" />
        <h3 className="text-[15px] font-bold">{L('학습 상태', 'Learning Health')}</h3>
        <span className={`ml-auto text-[12px] font-bold ${tierColors[health.learning_tier]}`}>
          Tier {health.learning_tier}: {tierLabels[health.learning_tier]}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="text-center p-2 rounded-lg bg-[var(--bg)]">
          <p className="text-[18px] font-bold text-[var(--text-primary)]">{health.signal_count}</p>
          <p className="text-[10px] text-[var(--text-secondary)]">{L('수집된 신호', 'Signals Collected')}</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-[var(--bg)]">
          <p className="text-[18px] font-bold text-[var(--text-primary)]">{health.eval_coverage}%</p>
          <p className="text-[10px] text-[var(--text-secondary)]">{L('전략 평가율', 'Strategy Coverage')}</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-[var(--bg)]">
          <p className="text-[18px] font-bold text-[var(--text-primary)]">{trendIcons[health.override_trend]}</p>
          <p className="text-[10px] text-[var(--text-secondary)]">{L('오버라이드', 'Override')} {trendLabels[health.override_trend]}</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-[var(--bg)]">
          <p className="text-[18px] font-bold text-[var(--text-primary)]">{trendIcons[health.convergence_trend]}</p>
          <p className="text-[10px] text-[var(--text-secondary)]">{L('수렴 속도', 'Convergence')} {trendLabels[health.convergence_trend]}</p>
        </div>
      </div>

      {health.recommendations.length > 0 && (
        <div className="space-y-1">
          {health.recommendations.map((r, i) => (
            <p key={i} className="text-[12px] text-[var(--text-secondary)] flex items-start gap-1.5">
              <TrendingUp size={12} className="text-[var(--accent)] shrink-0 mt-0.5" /> {r}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}
