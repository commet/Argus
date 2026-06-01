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
import { Download, Upload, Trash2, Eye, EyeOff, Server, Globe, Check, Volume2, TrendingUp, Brain, MessageSquare, Unlink, User, BarChart3 } from 'lucide-react';
import { getObservationsSummary } from '@/lib/user-context';
import { assessLearningHealth } from '@/lib/learning-health';
import { playTransitionTone, resumeAudioContext, startAmbient, stopAmbient, isAmbientPlaying } from '@/lib/audio';
import { useSlackStore } from '@/stores/useSlackStore';
import { useLocale } from '@/hooks/useLocale';

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
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const llmProviders = buildLlmProviders(L);
  const llmModes = buildLlmModes(L);

  const { settings, loadSettings, updateSettings } = useSettingsStore();
  const [showKey, setShowKey] = useState(false);
  const [resetModal, setResetModal] = useState(false);

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
    }
  }, [loadSettings, loadSlack]);

  const handleExport = () => {
    const data: Record<string, unknown> = {};
    for (const [name, key] of Object.entries(STORAGE_KEYS)) {
      if (name === 'SETTINGS') continue;
      data[key] = getStorage(key, null);
    }
    downloadJson(data, `sot-backup-${new Date().toISOString().split('T')[0]}.json`);
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
          {L('AI가 내 역할과 수준에 맞게 피드백 톤과 깊이를 조절합니다.', 'AI adjusts feedback tone and depth based on your role and level.')}
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
              onClick={() => { updateSettings({ language: lang.value }); window.location.reload(); }}
              className={`flex-1 py-2 rounded-lg text-[13px] font-medium border text-center transition-colors cursor-pointer ${
                settings.language === lang.value
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
            <p className="text-[11px] text-[var(--text-secondary)]">{L('단계 전환 시 클래식 서곡 톤', 'Classical argus tone on step transitions')}</p>
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
                <p className="text-[11px] text-[var(--text-secondary)]">{L('공연 전 콘서트홀의 따뜻한 울림', 'The warm resonance of a concert hall before the performance')}</p>
              </div>
              <button
                onClick={() => {
                  resumeAudioContext();
                  if (isAmbientPlaying()) {
                    stopAmbient();
                  } else {
                    startAmbient(settings.audio_volume);
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border cursor-pointer transition-colors ${
                  isAmbientPlaying()
                    ? 'border-[var(--accent)] bg-[var(--ai)] text-[var(--accent)]'
                    : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]'
                }`}
              >
                {isAmbientPlaying() ? L('정지', 'Stop') : L('재생', 'Play')}
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
          <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200">
            <p className="text-[13px] text-red-600 font-medium">{L('Slack 연결에 실패했습니다. 다시 시도해주세요.', 'Slack connection failed. Please try again.')}</p>
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
              <p className="text-[13px] font-medium text-red-700">{L('데이터 초기화', 'Reset Data')}</p>
              <p className="text-[11px] text-red-400">{L('모든 저장된 데이터를 삭제', 'Deletes all saved data')}</p>
            </div>
            <Button variant="danger" size="sm" onClick={() => setResetModal(true)}>
              <Trash2 size={14} /> {L('초기화', 'Reset')}
            </Button>
          </div>
        </div>
      </Card>

      {/* ── 5. Learning Health (conditional) ── */}
      <LearningHealthCard />

      <Modal open={resetModal} onClose={() => setResetModal(false)} title={L('데이터 초기화', 'Reset Data')}>
        <p className="text-[14px] text-[var(--text-primary)] mb-2">
          {L('모든 악보 해석, 편곡, 리허설, 조율 이력이 영구 삭제됩니다.', 'All Reframe, Recast, Rehearse, and Synthesize records will be permanently deleted.')}
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

  if (!health) return null;

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
