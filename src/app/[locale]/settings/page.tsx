'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { hasOwnApiKey, useSettingsStore } from '@/stores/useSettingsStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { clearAllStorage, STORAGE_KEYS, getStorage } from '@/lib/storage';
import { downloadJson } from '@/lib/export';
import { toast } from '@/lib/toast';
import { exportAccountData, exportJudgmentArchive, deleteAccount } from '@/lib/api-account';
import { purgeCurrentBrowserContinuity } from '@/lib/epistemic/browser-lifecycle';
import { useAuth } from '@/lib/auth';
import type { LLMMode, LLMProvider } from '@/stores/types';
import { Download, Upload, Trash2, Eye, EyeOff, Server, Globe, Check, MessageSquare, Unlink, User, BarChart3, FlaskConical, Send, Copy, KeyRound, Loader2, ChevronRight } from 'lucide-react';
import { getObservationsSummary } from '@/lib/user-context';
import {
  ANTHROPIC_MODELS,
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_OPENAI_MODEL,
  GEMINI_MODELS,
  OPENAI_MODELS,
} from '@/lib/llm-models';
import { playTransitionTone, resumeAudioContext, startAmbient, stopAmbient, isAmbientPlaying } from '@/lib/audio';
import { useSlackStore } from '@/stores/useSlackStore';
import { useTelegramStore } from '@/stores/useTelegramStore';
import { supabase } from '@/lib/supabase';
import { timeoutSignal } from '@/lib/timeout-signal';
import { useLocale } from '@/hooks/useLocale';
import { useLocaleSwitch } from '@/hooks/useLocaleSwitch';
import { withLocale } from '@/lib/locale-path';
import { verifyCurrentLlmConnection } from '@/lib/llm';
import { LocaleSwitchConfirmation } from '@/components/ui/LocaleSwitchConfirmation';

function buildLlmProviders(L: (ko: string, en: string) => string) {
  return [
    { value: 'anthropic' as LLMProvider, label: 'Claude', detail: L('Sonnet·Opus·Fable 중에서 선택', 'Choose Sonnet, Opus, or Fable') },
    { value: 'openai' as LLMProvider, label: 'GPT', model: null as string | null, detail: L('본인의 OpenAI API 키로 연결 · 모델은 아래에서 선택', 'Your own OpenAI API key · pick the model below') },
    { value: 'gemini' as LLMProvider, label: 'Gemini', model: null as string | null, detail: L('본인의 Google AI API 키로 연결 · 모델은 아래에서 선택', 'Your own Google AI API key · pick the model below') },
  ];
}

function buildLlmModes(L: (ko: string, en: string) => string) {
  return [
    { value: 'proxy' as LLMMode, label: L('Argus 기본', 'Argus default'), description: L('API 키 없이 바로 사용 (기본값)', 'Use without an API key (default)'), available: true },
    { value: 'direct' as LLMMode, label: L('내 API 키', 'My API key'), description: L('내 API 사용량으로 처리', 'Usage is billed to your API account'), available: true },
    { value: 'local' as LLMMode, label: L('로컬', 'Local'), description: L('Ollama 로컬 엔드포인트', 'Ollama local endpoint'), available: false },
  ];
}

export default function SettingsPage() {
  const locale = useLocale();
  const { switchTo, pendingLocale, confirmSwitch, cancelSwitch } = useLocaleSwitch();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const llmProviders = buildLlmProviders(L);
  const llmModes = buildLlmModes(L);

  // `user` is deliberately null for anonymous sessions (they are not a signed-in
  // account for UX purposes) — but an anonymous voyager DOES have a durable server
  // identity holding real rows, so erasure must key on the SESSION, not on `user`.
  const { user, session } = useAuth();
  const { settings, loadSettings, updateSettings } = useSettingsStore();
  const selectedAnthropicModel = ANTHROPIC_MODELS.find((model) => model.id === (settings.anthropic_model || DEFAULT_ANTHROPIC_MODEL));
  const selectedOpenAiModel = OPENAI_MODELS.find((model) => model.id === (settings.openai_model || DEFAULT_OPENAI_MODEL));
  const selectedGeminiModel = GEMINI_MODELS.find((model) => model.id === (settings.gemini_model || DEFAULT_GEMINI_MODEL));
  const [showKey, setShowKey] = useState(false);
  const [keyTest, setKeyTest] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [resetModal, setResetModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [archiveExporting, setArchiveExporting] = useState(false);
  // Mirror the ambient drone play state — startAmbient/stopAmbient alone never re-render,
  // so the button label/style would stay frozen. Synced on mount (SSR-safe).
  const [ambientOn, setAmbientOn] = useState(false);
  useEffect(() => { setAmbientOn(isAmbientPlaying()); }, []);

  // Theme preference (option C): 'light' | 'dark' | 'system'. Unset defaults to
  // 'system' here since settings is an in-app route. An explicit pick wins everywhere.
  const [themePref, setThemePref] = useState<'light' | 'dark' | 'system'>('system');
  useEffect(() => {
    const t = localStorage.getItem('argus-theme');
    setThemePref(t === 'light' || t === 'dark' ? t : 'system');
  }, []);
  const applyTheme = (pref: 'light' | 'dark' | 'system') => {
    setThemePref(pref);
    localStorage.setItem('argus-theme', pref);
    const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
  };

  // Slack
  const slackConnections = useSlackStore(s => s.connections);
  const loadSlack = useSlackStore(s => s.loadConnections);
  const slackLoadError = useSlackStore(s => s.loadError);
  const disconnectSlack = useSlackStore(s => s.disconnect);
  const [slackStatus, setSlackStatus] = useState<string | null>(null);
  const [slackConnecting, setSlackConnecting] = useState(false);

  useEffect(() => {
    loadSettings();
    loadSlack();
    // Check for Slack OAuth callback status
    const params = new URLSearchParams(window.location.search);
    const slack = params.get('slack');
    if (slack === 'connected') {
      setSlackStatus('connected');
      loadSlack();
      window.history.replaceState({}, '', window.location.pathname);
    } else if (slack === 'error') {
      setSlackStatus('error');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (slack === 'unconfigured') {
      setSlackStatus('unconfigured');
      window.history.replaceState({}, '', window.location.pathname);
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
      // Voice rule: a blocked import is the ship's limit, not the user's fault —
      // no "올바른지 확인해주세요" suspicion copy (02 P1-7).
      toast(L('파일이 10MB를 넘어 이 화면에서는 읽지 못했어요. 파일은 지우지 말고 보관해 주세요.', "This file is over 10MB, more than this screen can read. Don't delete it — keep it safe."), 'error');
      return;
    }
    const allowedKeys: Set<string> = new Set(Object.values(STORAGE_KEYS).filter(k => k !== 'sot_settings'));
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target?.result as string);
        // P1-C6 (minimal spec): recognize the SERVER export format
        // ({ exported_at, tables: {...} } from /api/account/export) and say
        // honestly that this screen can't restore it yet, instead of the old
        // silent "no importable data" dead end. Reverse-mapping restore is
        // deferred (§3.5-1: a buggy restore is the one failure mode that
        // OVERWRITES local data — not for an unattended session).
        if (data && typeof data === 'object' && data.tables && data.exported_at) {
          toast(L(
            '서버 내보내기 파일이에요. 이 파일은 보관용 사본이고, 앱으로 되돌리는 복원은 아직 지원하지 않아요. 복원하려면 로그아웃 상태에서 만든 백업 파일을 사용하세요.',
            "This is a server export file — an archival copy. Restoring it into the app isn't supported yet. To restore, use a backup file created while signed out.",
          ), 'info');
          return;
        }
        let imported = 0;
        for (const [key, value] of Object.entries(data)) {
          if (allowedKeys.has(key) && typeof value !== 'undefined') {
            localStorage.setItem(key, JSON.stringify(value));
            imported++;
          }
        }
        if (imported === 0) {
          toast(L('이 파일에서는 결정 기록을 찾지 못했어요. Argus에서 내보낸 파일이 맞다면, 저희 쪽 문제일 수 있어요 — 파일은 지우지 말고 보관해 주세요.', "Couldn't find any decision records in this file. If it came from an Argus export, the fault may be on our side — don't delete it, keep it safe."), 'error');
          return;
        }
        toast(L('데이터를 성공적으로 가져왔습니다. 페이지를 새로고침합니다.', 'Data imported successfully. The page will now reload.'), 'success');
        setTimeout(() => window.location.reload(), 900);
      } catch {
        toast(L('이 파일은 JSON 형식으로 읽히지 않았어요. 내보내기로 받은 .json 파일을 그대로 올려 주세요.', "This file didn't read as JSON. Please upload the .json file from the export as-is."), 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleServerExport = async () => {
    setExporting(true);
    try {
      await exportAccountData();
    } catch {
      toast(L('내보내기에 실패했어요. 다시 시도해 주세요.', 'Export failed. Please try again.'), 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleArchiveExport = async () => {
    setArchiveExporting(true);
    try {
      await exportJudgmentArchive();
    } catch {
      toast(L('연속성 아카이브를 만들지 못했어요. 다시 시도해 주세요.', 'Could not create the continuity archive. Please try again.'), 'error');
    } finally {
      setArchiveExporting(false);
    }
  };

  const handleReset = async () => {
    setDeleting(true);
    try {
      // A session — real OR anonymous — means server rows exist under an auth
      // identity. Keying this on `user` alone meant an anonymous voyager's "지우기"
      // cleared localStorage and left their projects, sessions, receipts and sealed
      // judgments on the server under an anonymous id that clearAllStorage then made
      // unreachable forever: kept without consent, and impossible to erase later
      // (2026-07-29). The server route accepts an anonymous bearer and erases the
      // same way, so route both through it.
      if (user || session) {
        const result = await deleteAccount();
        if (!result.ok) {
          toast(L('일부 데이터를 지우지 못했어요. 계정은 안전하게 보존했어요. 다시 시도해 주세요.', 'Some data could not be deleted. Your account was kept safe. Please try again.'), 'error');
          setDeleting(false);
          return;
        }
        let localPurgeComplete = true;
        const identityId = user?.id ?? session?.user?.id;
        try { if (identityId) await purgeCurrentBrowserContinuity(identityId); }
        catch { localPurgeComplete = false; }
        clearAllStorage();
        await supabase.auth.signOut();
        if (!localPurgeComplete) {
          toast(L(
            '서버 계정은 삭제됐지만 이 기기의 명령 대기열 일부를 확인하지 못했어요. 브라우저 사이트 데이터를 지워 주세요.',
            'The server account was deleted, but some device queue data could not be verified. Clear this site’s browser data.',
          ), 'error');
          setDeleting(false);
          setResetModal(false);
          return;
        }
        setResetModal(false);
        window.location.href = withLocale(locale, '/');
      } else {
        // No session at all — anonymous sign-in is off or unreachable, so nothing
        // was ever written server-side and localStorage really is the whole copy.
        clearAllStorage();
        setResetModal(false);
        window.location.reload();
      }
    } catch {
      toast(L('삭제에 실패했어요. 다시 시도해 주세요.', 'Deletion failed. Please try again.'), 'error');
      setDeleting(false);
    }
  };

  const handleProviderChange = (provider: LLMProvider) => {
    setKeyTest('idle');
    if (provider === 'openai' || provider === 'gemini') {
      // OpenAI/Gemini always uses direct mode
      updateSettings({ llm_provider: provider, llm_mode: 'direct' });
    } else {
      updateSettings({ llm_provider: provider });
    }
  };

  const handleModeChange = (mode: LLMMode) => {
    if (mode === 'local') return;
    setKeyTest('idle');
    updateSettings({ llm_mode: mode });
  };

  const testApiConnection = async () => {
    setKeyTest('testing');
    try {
      await verifyCurrentLlmConnection();
      setKeyTest('ok');
    } catch {
      setKeyTest('error');
    }
  };

  // 05 S8: frequency order — the AI engine (where people come when blocked) and
  // integrations/data first; identity and ambience after. Order/fold only.
  const NAV_ITEMS = [
    { id: 'engine', label: L('AI 엔진', 'AI Engine') },
    { id: 'integrations', label: L('연동 · 데이터', 'Integrations') },
    { id: 'profile', label: L('프로필', 'Profile') },
    { id: 'prefs', label: L('환경 설정', 'Preferences') },
    { id: 'labs', label: L('실험실', 'Labs') },
    { id: 'danger', label: L('위험 구역', 'Danger zone'), danger: true },
  ];

  return (
    <div>
      <div>
        <h1 className="text-[22px] font-bold text-[var(--text-primary)]">{L('설정', 'Settings')}</h1>
        <p className="text-[13px] text-[var(--text-secondary)] mt-1">{L('AI 엔진 · 연동 · 프로필 · 환경 설정', 'AI engine · integrations · profile · preferences')}</p>
        <p className="text-[12.5px] text-[var(--text-tertiary)] mt-1">
          {L('변경 사항은 이 브라우저에 자동 저장됩니다.', 'Changes save automatically in this browser.')}
        </p>
      </div>

      {/* A1 IA: left sticky section-nav (desktop) / sticky horizontal chip row
          (mobile) + right panel. Section internals are unchanged — only the
          shell is restructured, and the destructive action moves out of the
          integrations card into its own isolated danger zone at the bottom. */}
      <div className="mt-5 lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-10 lg:items-start">
        <SettingsNav items={NAV_ITEMS} ariaLabel={L('설정 섹션', 'Settings sections')} />
        {/* break-keep: word-break는 상속되므로 여기 한 번이면 모든 카드의 한국어
            설명이 어절 단위로 끊긴다 (단어 중간 줄바꿈 방지). */}
        <div className="space-y-6 min-w-0 mt-4 lg:mt-0 break-keep">

      <section id="engine" className="scroll-mt-40 lg:scroll-mt-28">
      {/* ── 1. AI Engine (provider + mode + key merged) ── */}
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <Server size={16} className="text-[var(--accent)]" />
          <h2 className="text-[15px] font-bold">{L('AI 엔진', 'AI Engine')}</h2>
        </div>
        <p className="text-[12px] text-[var(--text-secondary)] mb-4">
          {L('판단을 살펴볼 때 사용할 AI를 정해요.', 'Choose the AI Argus uses to examine a judgment.')}
        </p>

        {/* Provider — 한 층위(브랜드) 세그먼트. 'GPT-4o' 같은 특정 모델명을 버튼에
            섞지 않는다 — 구체 모델은 아래 detail 줄이 말한다. */}
        <fieldset>
        <legend className="text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5 block">{L('제공자', 'Provider')}</legend>
        <div className="flex gap-1.5">
          {llmProviders.map((provider) => (
            <button
              key={provider.value}
              type="button"
              aria-pressed={(settings.llm_provider || 'anthropic') === provider.value}
              onClick={() => handleProviderChange(provider.value)}
              className={`flex-1 min-h-[44px] py-3 rounded-lg text-[13px] font-semibold border text-center transition-colors cursor-pointer ${
                (settings.llm_provider || 'anthropic') === provider.value
                  ? 'border-[var(--accent)] bg-[var(--ai)] text-[var(--accent)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border)]'
              }`}
            >
              {provider.label}
            </button>
          ))}
        </div>
        {(() => {
          const p = llmProviders.find((x) => x.value === (settings.llm_provider || 'anthropic'));
          return (
            <p className="text-[12.5px] mt-2 leading-relaxed">
              <span className="text-[var(--text-tertiary)]">{p?.detail}</span>
            </p>
          );
        })()}
        </fieldset>

        {/* Anthropic connection mode — compact segmented control */}
        {(settings.llm_provider || 'anthropic') === 'anthropic' && (
          <fieldset className="animate-fade-in mt-4">
            <legend className="text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5 block">{L('연결 방식', 'Connection Mode')}</legend>
            <div className="flex gap-1.5">
              {llmModes.filter((mode) => mode.available).map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  aria-pressed={settings.llm_mode === mode.value}
                  onClick={() => handleModeChange(mode.value)}
                  className={`flex-1 min-h-[44px] py-3 rounded-lg text-[12px] font-medium border text-center transition-colors cursor-pointer ${
                    settings.llm_mode === mode.value
                      ? 'border-[var(--accent)] bg-[var(--ai)] text-[var(--accent)]'
                      : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border)]'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <p className="text-[12.5px] text-[var(--text-tertiary)] mt-1.5">
              {llmModes.find(m => m.value === settings.llm_mode)?.description}
            </p>
          </fieldset>
        )}

        {(settings.llm_provider || 'anthropic') === 'anthropic' && (
          <div className="animate-fade-in mt-4">
            <label htmlFor="settings-anthropic-model" className="text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5 block">{L('모델', 'Model')}</label>
            <select
              id="settings-anthropic-model"
              value={settings.anthropic_model || DEFAULT_ANTHROPIC_MODEL}
              onChange={(e) => { setKeyTest('idle'); updateSettings({ anthropic_model: e.target.value }); }}
              className="min-h-11 w-full bg-[var(--bg)] border-[1.5px] border-[var(--border)] rounded-[10px] px-3.5 py-2.5 text-[14px] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
            >
              {ANTHROPIC_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} · {model.price}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[12px] text-[var(--text-tertiary)]">
              {selectedAnthropicModel ? `${L(selectedAnthropicModel.noteKo, selectedAnthropicModel.noteEn)} · ` : ''}
              {L(
                '입력 / 출력 100만 토큰당 API 요금(USD). Sonnet 5의 $2 / $10은 2026년 8월 31일까지의 출시 요금입니다.',
                'API prices per 1M input / output tokens (USD). Sonnet 5’s $2 / $10 launch rate runs through August 31, 2026.',
              )}
            </p>
          </div>
        )}

        {/* Anthropic API Key */}
        {(settings.llm_provider || 'anthropic') === 'anthropic' && settings.llm_mode === 'direct' && (
          <div className="animate-fade-in mt-4">
            <label htmlFor="settings-anthropic-api-key" className="text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5 block">Anthropic API Key</label>
            <div className="relative">
              <input
                id="settings-anthropic-api-key"
                type={showKey ? 'text' : 'password'}
                value={settings.anthropic_api_key}
                onChange={(e) => { setKeyTest('idle'); updateSettings({ anthropic_api_key: e.target.value }); }}
                placeholder="sk-ant-..."
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                spellCheck={false}
                className="min-h-11 w-full bg-[var(--bg)] border-[1.5px] border-[var(--border)] rounded-[10px] px-3.5 py-2.5 text-[14px] font-mono focus:outline-none focus:border-[var(--accent)] pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute inset-y-0 right-0 flex items-center justify-center w-11 text-[var(--text-secondary)] hover:text-[var(--accent)] cursor-pointer transition-colors"
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
            <label htmlFor="settings-openai-api-key" className="text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5 block">OpenAI API Key</label>
            <div className="relative">
              <input
                id="settings-openai-api-key"
                type={showKey ? 'text' : 'password'}
                value={settings.openai_api_key || ''}
                onChange={(e) => { setKeyTest('idle'); updateSettings({ openai_api_key: e.target.value }); }}
                placeholder="sk-..."
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                spellCheck={false}
                className="min-h-11 w-full bg-[var(--bg)] border-[1.5px] border-[var(--border)] rounded-[10px] px-3.5 py-2.5 text-[14px] font-mono focus:outline-none focus:border-[var(--accent)] pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute inset-y-0 right-0 flex items-center justify-center w-11 text-[var(--text-secondary)] hover:text-[var(--accent)] cursor-pointer transition-colors"
                aria-label={showKey ? L('키 숨기기', 'Hide key') : L('키 보기', 'Show key')}
                aria-pressed={showKey}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="mt-3">
              <label htmlFor="settings-openai-model" className="text-[12px] text-[var(--text-secondary)] mb-1 block">{L('모델', 'Model')}</label>
              <select
                id="settings-openai-model"
                value={settings.openai_model || DEFAULT_OPENAI_MODEL}
                onChange={(e) => { setKeyTest('idle'); updateSettings({ openai_model: e.target.value }); }}
                className="min-h-11 w-full bg-[var(--bg)] border-[1.5px] border-[var(--border)] rounded-[10px] px-3.5 py-2.5 text-[14px] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
              >
                {OPENAI_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} · {model.price}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[12px] text-[var(--text-tertiary)]">
                {selectedOpenAiModel ? `${L(selectedOpenAiModel.noteKo, selectedOpenAiModel.noteEn)} · ` : ''}
                {L('입력 / 출력 100만 토큰당 표준 API 요금(USD)', 'Standard USD per 1M input / output tokens')}
              </p>
            </div>
          </div>
        )}

        {/* Gemini API Key + Model */}
        {(settings.llm_provider || 'anthropic') === 'gemini' && (
          <div className="animate-fade-in mt-4">
            <label htmlFor="settings-gemini-api-key" className="text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5 block">Google AI API Key</label>
            <div className="relative">
              <input
                id="settings-gemini-api-key"
                type={showKey ? 'text' : 'password'}
                value={settings.gemini_api_key || ''}
                onChange={(e) => { setKeyTest('idle'); updateSettings({ gemini_api_key: e.target.value }); }}
                placeholder="AIza..."
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                spellCheck={false}
                className="min-h-11 w-full bg-[var(--bg)] border-[1.5px] border-[var(--border)] rounded-[10px] px-3.5 py-2.5 text-[14px] font-mono focus:outline-none focus:border-[var(--accent)] pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute inset-y-0 right-0 flex items-center justify-center w-11 text-[var(--text-secondary)] hover:text-[var(--accent)] cursor-pointer transition-colors"
                aria-label={showKey ? L('키 숨기기', 'Hide key') : L('키 보기', 'Show key')}
                aria-pressed={showKey}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="mt-3">
              <label htmlFor="settings-gemini-model" className="text-[12px] text-[var(--text-secondary)] mb-1 block">{L('모델', 'Model')}</label>
              <select
                id="settings-gemini-model"
                value={settings.gemini_model || DEFAULT_GEMINI_MODEL}
                onChange={(e) => { setKeyTest('idle'); updateSettings({ gemini_model: e.target.value }); }}
                className="min-h-11 w-full bg-[var(--bg)] border-[1.5px] border-[var(--border)] rounded-[10px] px-3.5 py-2.5 text-[14px] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
              >
                {GEMINI_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} · {model.price}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[12px] text-[var(--text-tertiary)]">
                {selectedGeminiModel ? `${L(selectedGeminiModel.noteKo, selectedGeminiModel.noteEn)} · ` : ''}
                {L(
                  '입력 / 출력 100만 토큰당 표준 API 요금(USD). Gemini 3.1 Pro의 $2 / $12는 입력 20만 토큰 이하 기준입니다.',
                  'Standard USD per 1M input / output tokens. Gemini 3.1 Pro’s $2 / $12 rate applies at 200K input tokens or less.',
                )}
              </p>
            </div>
          </div>
        )}
        {hasOwnApiKey(settings) && (
          <div className="mt-4 flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={keyTest === 'testing'}
              onClick={testApiConnection}
            >
              {keyTest === 'testing' ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {L('실제 연결 확인', 'Test live connection')}
            </Button>
            <p className={`text-[13px] ${
              keyTest === 'ok'
                ? 'text-emerald-600'
                : keyTest === 'error'
                  ? 'text-[var(--danger)]'
                  : 'text-[var(--text-tertiary)]'
            }`}>
              {keyTest === 'ok'
                ? L('실제 모델 응답을 확인했어요.', 'The selected model responded successfully.')
                : keyTest === 'error'
                  ? L('연결하지 못했어요. 키·모델·결제 상태를 확인해 주세요.', 'Could not connect. Check the key, model access, and provider billing.')
                  : L('키 형식뿐 아니라 실제 모델 호출까지 확인합니다.', 'Checks a real model call, not just the key format.')}
            </p>
          </div>
        )}
      </Card>
      </section>

      <section id="integrations" className="scroll-mt-40 lg:scroll-mt-28">
      {/* ── 2. Integrations & Data ── */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare size={16} className="text-[var(--accent)]" />
          <h2 className="text-[15px] font-bold">{L('연동 · 데이터', 'Integrations & Data')}</h2>
        </div>

        {/* Slack — folded by default (05 S8); held open when returning from the
            OAuth callback or when a workspace is already connected. */}
        <IntegrationSection title="Slack" defaultOpen={slackStatus !== null || slackConnections.length > 0}>
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
        {slackLoadError && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)]/25">
            <p className="text-[13px] text-[var(--danger)] font-medium">{L('Slack 연결 상태를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', 'Could not load Slack connection status. Please try again shortly.')}</p>
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
                <Button variant="danger" size="sm" onClick={async () => {
                  const result = await disconnectSlack(conn.id);
                  if (!result.ok) setSlackStatus('error');
                }}>
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
            <Button variant="secondary" size="sm" disabled={slackConnecting} onClick={async () => {
              setSlackConnecting(true);
              try {
                const { data } = await (await import('@/lib/supabase')).supabase.auth.getSession();
                const token = data.session?.access_token;
                if (!token) {
                  window.location.href = withLocale(locale, '/login?redirect=/settings');
                  return;
                }
                const res = await fetch('/api/slack/oauth', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ locale }),
                  signal: timeoutSignal(),
                });
                const json = await res.json().catch(() => ({}));
                if (res.status === 503) { setSlackStatus('unconfigured'); return; }
                if (res.status === 401) {
                  window.location.href = withLocale(locale, '/login?redirect=/settings');
                  return;
                }
                if (!res.ok || typeof json.url !== 'string') { setSlackStatus('error'); return; }
                const target = new URL(json.url);
                if (target.origin !== 'https://slack.com') { setSlackStatus('error'); return; }
                window.location.assign(target.toString());
              } catch {
                setSlackStatus('error');
              } finally {
                setSlackConnecting(false);
              }
            }}>
              {slackConnecting ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />} {L('연결하기', 'Connect')}
            </Button>
          </div>
        )}
        </IntegrationSection>

        {/* Telegram */}
        <div className="border-t border-[var(--border-subtle)] my-4" />
        <TelegramBlock locale={locale} />

        {user && (
          <>
            {/* Plugin push token */}
            <div className="border-t border-[var(--border-subtle)] my-4" />
            <PluginTokenBlock locale={locale} />

            {/* TWIN 판단 프로필 — 편집 가능한 거울 */}
            <div className="border-t border-[var(--border-subtle)] my-4" />
            <JudgmentProfileBlock locale={locale} />

            <DelegationBlock locale={locale} />

            {/* Public share links */}
            <div className="border-t border-[var(--border-subtle)] my-4" />
            <SharedLinksBlock locale={locale} />
          </>
        )}

        {/* Data & account */}
        <div className="border-t border-[var(--border-subtle)] my-4" />
        <div className="space-y-2">
          {/* Export */}
          <div className="flex items-center justify-between p-3 bg-[var(--bg)] rounded-lg gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-medium">{L('내 데이터 내보내기', 'Export my data')}</p>
              <p className="text-[12.5px] text-[var(--text-secondary)]">
                {user
                  ? L('서버에 저장된 모든 데이터를 JSON 한 파일로', 'Every row stored on the server, as one JSON file')
                  : L('이 브라우저의 데이터를 JSON으로', 'This browser’s data, as JSON')}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={user ? handleServerExport : handleExport} disabled={exporting}>
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {L('내보내기', 'Export')}
            </Button>
          </div>
          {user && (
            <div className="flex items-center justify-between p-3 bg-[var(--bg)] rounded-lg gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium">{L('판단 연속성 아카이브', 'Judgment continuity archive')}</p>
                <p className="text-[12.5px] text-[var(--text-secondary)]">
                  {L('해시·스키마 검증과 복원 dry-run을 지원하는 ZIP', 'A hashed ZIP with schema checks and restore dry-run support')}
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={handleArchiveExport} disabled={archiveExporting}>
                {archiveExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {L('아카이브', 'Archive')}
              </Button>
            </div>
          )}
          {/* Import */}
          <div className="flex items-center justify-between p-3 bg-[var(--bg)] rounded-lg gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-medium">{L('백업 가져오기', 'Import backup')}</p>
              <p className="text-[12.5px] text-[var(--text-secondary)]">
                {user
                  ? L('이 브라우저의 로컬 JSON만 가져옵니다. 서버 전체 JSON은 열람용입니다.', 'Imports this browser’s local JSON only. The full server JSON is for inspection.')
                  : L('내보낸 JSON 파일에서 복원', 'Restore from an exported JSON file')}
              </p>
            </div>
            <label htmlFor="settings-import-backup" className="cursor-pointer shrink-0">
              <input id="settings-import-backup" type="file" accept=".json" onChange={handleImport} className="peer sr-only" />
              <span className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] font-medium transition-all duration-150 active:scale-[0.98] bg-transparent border-[1.5px] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg)] px-3 py-1.5 text-[13px] peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--accent)] peer-focus-visible:ring-offset-2">
                <Upload size={14} /> {L('가져오기', 'Import')}
              </span>
            </label>
          </div>
        </div>
      </Card>
      </section>

      <section id="profile" className="scroll-mt-40 lg:scroll-mt-28">
      {/* ── 3. My Profile ── */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <User size={16} className="text-[var(--accent)]" />
          <h2 className="text-[15px] font-bold">{L('내 프로필', 'My Profile')}</h2>
        </div>
        <p className="text-[12px] text-[var(--text-secondary)] mb-4">
          {L('검토 피드백의 말투와 깊이를 맞추는 데 써요.', 'Tunes the tone and depth of your review feedback.')}
        </p>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="settings-user-name" className="text-[12px] font-semibold text-[var(--text-secondary)] mb-1 block">{L('이름', 'Name')}</label>
              <input
                id="settings-user-name"
                type="text"
                value={settings.user_name || ''}
                onChange={(e) => updateSettings({ user_name: e.target.value })}
                placeholder={L('홍길동', 'Your name')}
                maxLength={30}
                autoComplete="name"
                className="min-h-11 w-full bg-[var(--bg)] border-[1.5px] border-[var(--border)] rounded-[10px] px-3 py-2 text-[14px] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label htmlFor="settings-user-role" className="text-[12px] font-semibold text-[var(--text-secondary)] mb-1 block">{L('역할', 'Role')}</label>
              <input
                id="settings-user-role"
                type="text"
                value={settings.user_role || ''}
                onChange={(e) => updateSettings({ user_role: e.target.value })}
                placeholder={L('마케터, 개발자, 기획자...', 'Marketer, Developer...')}
                maxLength={50}
                className="min-h-11 w-full bg-[var(--bg)] border-[1.5px] border-[var(--border)] rounded-[10px] px-3 py-2 text-[14px] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <fieldset>
            <legend className="text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5 block">{L('경력', 'Experience')}</legend>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {([
                { value: 'junior' as const, label: L('1-3년차', '1-3 yrs') },
                { value: 'mid' as const, label: L('4-7년차', '4-7 yrs') },
                { value: 'senior' as const, label: L('8년차+', '8+ yrs') },
                { value: 'lead' as const, label: L('팀장/리드', 'Lead') },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={settings.user_seniority === opt.value}
                  onClick={() => updateSettings({ user_seniority: settings.user_seniority === opt.value ? undefined : opt.value })}
                  className={`flex-1 min-h-[44px] py-3 rounded-lg text-[12px] font-medium border text-center transition-colors cursor-pointer ${
                    settings.user_seniority === opt.value
                      ? 'border-[var(--accent)] bg-[var(--ai)] text-[var(--accent)]'
                      : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="settings-user-context" className="text-[12px] font-semibold text-[var(--text-secondary)] mb-1 block">{L('자유 소개', 'About me')}</label>
            <textarea
              id="settings-user-context"
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
      </section>

      <section id="prefs" className="scroll-mt-40 lg:scroll-mt-28">
      {/* ── 4. Preferences (Language + Sound) ── */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Globe size={16} className="text-[var(--accent)]" />
          <h2 className="text-[15px] font-bold">{L('환경 설정', 'Preferences')}</h2>
        </div>

        {/* Language */}
        <fieldset>
        <legend className="text-[13px] font-medium text-[var(--text-primary)] mb-2">{L('언어', 'Language')}</legend>
        <div className="flex gap-2">
          {[
            { value: 'ko' as const, label: '한국어' },
            { value: 'en' as const, label: 'English' },
          ].map((lang) => (
            <button
              key={lang.value}
              type="button"
              aria-pressed={locale === lang.value}
              onClick={() => switchTo(lang.value)}
              className={`flex-1 min-h-[44px] py-3 rounded-lg text-[13px] font-medium border text-center transition-colors cursor-pointer ${
                locale === lang.value
                  ? 'border-[var(--accent)] bg-[var(--ai)] text-[var(--accent)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border)]'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
        <p className="text-[12.5px] text-[var(--text-tertiary)] mt-1.5">
          {L('언어를 바꾸면 화면 문구가 바로 바뀝니다. 작성한 내용은 그대로 유지됩니다.', 'The interface updates immediately. Anything you wrote stays as-is.')}
        </p>
        </fieldset>

        {/* Appearance / theme (option C) */}
        <div className="border-t border-[var(--border-subtle)] my-4" />
        <fieldset>
        <legend className="text-[13px] font-medium text-[var(--text-primary)] mb-2">{L('화면 테마', 'Appearance')}</legend>
        <div className="flex gap-2">
          {[
            { value: 'light' as const, label: L('라이트', 'Light') },
            { value: 'dark' as const, label: L('다크', 'Dark') },
            { value: 'system' as const, label: L('시스템', 'System') },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={themePref === opt.value}
              onClick={() => applyTheme(opt.value)}
              className={`flex-1 min-h-[44px] py-3 rounded-lg text-[13px] font-medium border text-center transition-colors cursor-pointer ${
                themePref === opt.value
                  ? 'border-[var(--accent)] bg-[var(--ai)] text-[var(--accent)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-[12.5px] text-[var(--text-tertiary)] mt-1.5">
          {L('시스템은 기기 설정을 따라가요. 첫 방문(홈)은 라이트로 시작합니다.', 'System follows your device. The landing page starts in light.')}
        </p>
        </fieldset>

        {/* Sound — folded by default (05 S8: order/fold only, no feature change) */}
        <div className="border-t border-[var(--border-subtle)] my-4" />
        <details className="group">
          <summary className="flex min-h-11 items-center gap-1.5 cursor-pointer select-none list-none text-[13px] font-medium text-[var(--text-primary)] [&::-webkit-details-marker]:hidden">
            <ChevronRight size={14} className="text-[var(--text-tertiary)] transition-transform duration-200 group-open:rotate-90" />
            {L('소리', 'Sound')}
          </summary>
          <div className="mt-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium">{L('전환음', 'Transition Sound')}</p>
            <p className="text-[12.5px] text-[var(--text-secondary)]">{L('단계 전환 시 잔잔한 알림음', 'A gentle tone on step transitions')}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.audio_enabled}
            aria-label={L('전환음', 'Transition Sound')}
            onClick={() => {
              const next = !settings.audio_enabled;
              updateSettings({ audio_enabled: next });
              if (next) {
                resumeAudioContext();
                playTransitionTone(settings.audio_volume);
              }
            }}
            className={`relative w-11 h-6 box-content py-2.5 -my-2.5 bg-clip-content rounded-full transition-colors cursor-pointer ${
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
              <label htmlFor="settings-audio-volume" className="text-[12px] text-[var(--text-secondary)] w-10 shrink-0">{L('볼륨', 'Vol.')}</label>
              <input
                id="settings-audio-volume"
                type="range"
                min="0"
                max="0.5"
                step="0.05"
                value={settings.audio_volume}
                aria-valuetext={`${Math.round(settings.audio_volume * 200)}%`}
                onChange={(e) => updateSettings({ audio_volume: parseFloat(e.target.value) })}
                className="flex-1 accent-[var(--accent)]"
              />
              <span className="text-[12px] text-[var(--text-secondary)] w-10 text-right">{Math.round(settings.audio_volume * 200)}%</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
              <div>
                <p className="text-[13px] font-medium">{L('잔잔한 배경음', 'Ambient sound')}</p>
                <p className="text-[12.5px] text-[var(--text-secondary)]">{L('집중할 때 은은하게 재생되는 배경음이에요.', 'A quiet background sound for focused work.')}</p>
              </div>
              <button
                type="button"
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
                className={`min-h-11 px-3 py-1.5 rounded-lg text-[12px] font-medium border cursor-pointer transition-colors ${
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
          </div>
        </details>
      </Card>
      </section>

      <section id="labs" className="scroll-mt-40 lg:scroll-mt-28">
      {/* ── 5. Labs ── */}
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <FlaskConical size={16} className="text-[var(--accent)]" />
          <h2 className="text-[15px] font-bold">{L('실험실', 'Labs')}</h2>
        </div>
        <details className="group">
          <summary className="flex min-h-11 items-center gap-1.5 cursor-pointer select-none list-none text-[12px] text-[var(--text-secondary)] [&::-webkit-details-marker]:hidden">
            <ChevronRight size={14} className="shrink-0 text-[var(--text-tertiary)] transition-transform duration-200 group-open:rotate-90" />
            {L('아직 다듬는 중인 기능이에요. 언제든 켜고 끌 수 있어요.', 'Experimental features. Turn them on or off anytime.')}
          </summary>
          <div className="space-y-3 mt-4">
          {([
            {
              key: 'new_arc_enabled' as const,
              label: L('중간 결과 확인 (실험 중)', 'Interim result check (experimental)'),
              desc: L('분석 단계에서 AI 실행자 여럿이 같은 글을 따로 읽고, 서로 다르게 읽은 지점을 보여줘요', 'In the analysis stage, several AI executors read the same text separately and show where their readings differ'),
            },
            {
              key: 'classic_session' as const,
              label: L('클래식 세션 보기', 'Classic session view'),
              desc: L('단계별 확인 화면을 항상 펼쳐 둬요 (결정 지도는 왼쪽에서 볼 수 있어요)', 'Keep per-step confirmation screens open (the decision map stays available on the left)'),
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
                  <p className="text-[12.5px] text-[var(--text-secondary)]">{lab.desc}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={lab.label}
                  onClick={() => updateSettings({ [lab.key]: !on })}
                  className={`relative w-11 h-6 box-content py-2.5 -my-2.5 bg-clip-content rounded-full transition-colors cursor-pointer shrink-0 ${
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
        </details>
      </Card>
      </section>

      {/* ── Danger zone — deliberately isolated at the bottom, never mixed
          with everyday settings (A1). ── */}
      <section id="danger" className="scroll-mt-40 lg:scroll-mt-28">
        <Card variant="danger">
          <h2 className="text-[15px] font-bold text-[var(--danger)] mb-3">{L('위험 구역', 'Danger zone')}</h2>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-[var(--danger)]">
                {user ? L('계정 완전 삭제', 'Delete my account') : L('데이터 초기화', 'Reset data')}
              </p>
              <p className="text-[12.5px] text-[var(--danger)]/70">
                {user
                  ? L('모든 데이터와 계정을 영구 삭제 — 되돌릴 수 없어요', 'Permanently erase all data + your account — cannot be undone')
                  : L('이 브라우저의 모든 데이터를 삭제', 'Delete all data in this browser')}
              </p>
            </div>
            <Button variant="danger" size="sm" onClick={() => setResetModal(true)}>
              <Trash2 size={14} /> {user ? L('계정 삭제', 'Delete') : L('초기화', 'Reset')}
            </Button>
          </div>
        </Card>
      </section>

      <Modal open={resetModal} onClose={() => { if (!deleting) setResetModal(false); }} title={user ? L('계정 완전 삭제', 'Delete my account') : L('데이터 초기화', 'Reset data')}>
        <p className="text-[14px] text-[var(--text-primary)] mb-2">
          {/* The anonymous line used to promise only "this browser" — but a
              logged-out voyage has had a durable server copy since anonymous auth
              shipped, and that copy is what the button now erases too. Say what it
              actually does. */}
          {user
            ? L('서버에 저장된 모든 데이터와 계정이 영구 삭제되고, 로그아웃됩니다.', 'All your server-stored data and your account will be permanently deleted, and you’ll be signed out.')
            : L('이 브라우저의 모든 프로젝트·정리·검토 이력과, 로그인 없이 저장돼 있던 서버 사본까지 함께 삭제됩니다.', 'Every project, write-up, and review in this browser — and the server copy kept for your logged-out voyage — will be deleted.')}
        </p>
        <p className="text-[12px] text-[var(--text-secondary)] mb-4">
          {user
            ? L('되돌릴 수 없어요. 전체 JSON은 열람용이고, “판단 연속성 아카이브”는 새 계정·프로젝트 매핑을 확인한 뒤 복원할 수 있어요.', 'This cannot be undone. The full JSON is for inspection; the judgment continuity archive can be restored after confirming the new account and project mapping.')
            : L('되돌릴 수 없어요.', 'This cannot be undone.')}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setResetModal(false)} disabled={deleting}>{L('취소', 'Cancel')}</Button>
          <Button variant="danger" onClick={handleReset} disabled={deleting}>
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} {user ? L('영구 삭제', 'Delete forever') : L('삭제', 'Delete')}
          </Button>
        </div>
      </Modal>
      <LocaleSwitchConfirmation
        locale={locale}
        pendingLocale={pendingLocale}
        onConfirm={confirmSwitch}
        onCancel={cancelSwitch}
      />
        </div>
      </div>
    </div>
  );
}

/* ── A1: section navigation — sticky rail on desktop, sticky chip row on
   mobile. Active section tracked with an IntersectionObserver so "where am I"
   stays visible while scrolling. Wayfinding only — quiet seated chip, no gold. */
function SettingsNav({ items, ariaLabel }: {
  items: Array<{ id: string; label: string; danger?: boolean }>;
  ariaLabel: string;
}) {
  const [active, setActive] = useState(items[0]?.id ?? '');
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: '-15% 0px -70% 0px' },
    );
    for (const { id } of items) {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
    // section ids are static per mount; labels (locale) don't affect observation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <nav
      aria-label={ariaLabel}
      className="sticky top-16 lg:top-24 z-10 -mx-4 px-4 lg:mx-0 lg:px-0 bg-[var(--bg)]/95 backdrop-blur-sm lg:bg-transparent lg:backdrop-blur-none"
    >
      <ul className="grid grid-cols-3 gap-1 py-2 lg:flex lg:flex-col lg:overflow-visible lg:whitespace-nowrap lg:py-0">
        {items.map((it) => {
          const on = active === it.id;
          return (
            <li key={it.id} className="min-w-0 lg:shrink-0">
              <a
                href={`#${it.id}`}
                aria-current={on ? 'true' : undefined}
                className={`flex min-h-[44px] items-center justify-center rounded-lg px-2 text-center text-[12px] font-medium leading-tight whitespace-normal transition-colors lg:min-h-[40px] lg:justify-start lg:px-3 lg:text-left lg:text-[13px] lg:whitespace-nowrap ${
                  it.danger
                    ? on
                      ? 'text-[var(--danger)] bg-[var(--danger)]/10'
                      : 'text-[var(--danger)]/75 hover:bg-[var(--danger)]/8'
                    : on
                      ? 'text-[var(--text-primary)] bg-[var(--bg-hover)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]/60'
                }`}
              >
                {it.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* 연동 카드의 모든 항목이 쓰는 단일 접이식 래퍼 — Slack만 접히고 Telegram은
   라벨도 없이 고정이던 불일치를 없앤다. 여기 한 곳이 전부의 모양·동작을 정의하므로
   다시 어긋날 수 없다(단일 정본). connected면 defaultOpen으로 펼쳐 둔다. */
function IntegrationSection({ title, defaultOpen, children }: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group">
      <summary className="flex min-h-11 items-center gap-1.5 cursor-pointer select-none list-none text-[13px] font-medium text-[var(--text-primary)] [&::-webkit-details-marker]:hidden">
        <ChevronRight size={14} className="text-[var(--text-tertiary)] transition-transform duration-200 group-open:rotate-90" />
        {title}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function TelegramBlock({ locale }: { locale: string }) {
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const connections = useTelegramStore((s) => s.connections);
  const loadConnections = useTelegramStore((s) => s.loadConnections);
  const startConnect = useTelegramStore((s) => s.startConnect);
  const disconnect = useTelegramStore((s) => s.disconnect);
  const sendToTelegram = useTelegramStore((s) => s.sendToTelegram);
  const loadError = useTelegramStore((s) => s.loadError);
  const [pending, setPending] = useState(false);
  const [testingChatId, setTestingChatId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => { loadConnections(); }, [loadConnections]);

  const handleConnect = async () => {
    setNote(null);
    setPending(true);
    // P1-C4: setPending(false) lives in finally — a thrown startConnect used
    // to skip it and leave the button spinning forever.
    try {
      const r = await startConnect();
      if (r.ok && r.link) {
        window.open(r.link, '_blank', 'noopener');
        setNote(L('텔레그램이 열리면 “시작/Start”을 눌러 주세요. 연결되면 아래에 표시돼요.',
                  'When Telegram opens, tap “Start”. Once connected it appears below.'));
      } else if (r.error === 'unconfigured') {
        setNote(L('이 배포에는 아직 Telegram 봇이 설정되지 않았어요(운영자가 TELEGRAM_* 환경변수 등록 필요).',
                  'Telegram bot isn’t configured on this deployment yet (operator must set TELEGRAM_* env vars).'));
      } else if (r.error === 'network') {
        setNote(L('연결을 시작하지 못했어요 — 인터넷 연결을 확인하고 다시 눌러 주세요.',
                  'Could not start the connection — check your internet and tap again.'));
      } else {
        setNote(L('연결을 시작할 수 없어요.', 'Could not start connect.'));
      }
    } finally {
      setPending(false);
    }
  };

  const handleTestMessage = async (chatId: string) => {
    setNote(null);
    setTestingChatId(chatId);
    try {
      const result = await sendToTelegram(
        L('Argus 연결 확인', 'Argus connection check'),
        L(
          '텔레그램 알림이 정상적으로 연결됐어요. 확인일이 오면 이 채팅으로 알려드릴게요.',
          'Telegram notifications are connected. A reminder will arrive in this chat when a review date is due.',
        ),
        { chatId, context: 'connection_test' },
      );
      setNote(result.ok
        ? L('시험 메시지를 보냈어요. 지금 텔레그램에서 도착 여부를 확인해 주세요.', 'Test message sent. Check Telegram now.')
        : L('시험 메시지를 보내지 못했어요. 연결 상태와 봇 설정을 확인해 주세요.', 'Could not send the test message. Check the connection and bot configuration.'));
    } finally {
      setTestingChatId(null);
    }
  };

  return (
    <IntegrationSection title="Telegram" defaultOpen={connections.length > 0}>
      {loadError && <p className="text-[12px] text-[var(--danger)] mb-2">{L('Telegram 연결 상태를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', 'Could not load Telegram connection status. Please try again shortly.')}</p>}
      {connections.length > 0 ? (
        <div className="space-y-2">
          {connections.map((c) => (
            <div key={c.id} className="flex flex-col gap-3 p-3 bg-[var(--bg)] rounded-lg sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[14px] font-medium flex items-center gap-1.5">
                  <Check size={14} className="text-[var(--success)]" /> {c.chat_title || L('내 Telegram', 'My Telegram')}
                </p>
                <p className="text-[12px] text-[var(--text-secondary)]">{L('확인일 알림과 공유한 결과를 이 채팅으로 보내요.', 'Review reminders and shared results are sent to this chat.')}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="secondary" size="sm" onClick={() => handleTestMessage(c.chat_id)} disabled={testingChatId !== null}>
                  {testingChatId === c.chat_id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {L('시험 메시지', 'Test message')}
                </Button>
                <Button variant="danger" size="sm" onClick={async () => {
                  const result = await disconnect(c.id);
                  if (!result.ok) setNote(L('연결을 해제하지 못했습니다. 연결은 그대로 유지됩니다.', 'Could not disconnect. The connection is still active.'));
                }}>
                  <Unlink size={14} /> {L('연결 해제', 'Disconnect')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-between p-3 bg-[var(--bg)] rounded-lg gap-3">
          <div>
            <p className="text-[14px] font-medium">{L('Telegram에 연결하기', 'Connect to Telegram')}</p>
            <p className="text-[12px] text-[var(--text-secondary)]">{L('확인일 알림과 공유한 판단 기록을 Telegram으로', 'Receive review reminders and shared judgment records in Telegram')}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={handleConnect} disabled={pending}>
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {L('연결하기', 'Connect')}
          </Button>
        </div>
      )}
      {note && <p className="text-[12px] text-[var(--text-secondary)] mt-2">{note}</p>}
      {connections.length === 0 && (
        <button type="button" onClick={() => loadConnections()} className="min-h-[44px] text-[13px] text-[var(--text-tertiary)] hover:text-[var(--accent)] mt-1.5 cursor-pointer transition-colors">
          {L('연결 상태 다시 확인', 'Check connection again')}
        </button>
      )}
    </IntegrationSection>
  );
}

interface ProfileItem {
  id: string;
  layer: string;
  domain: string;
  content: string;
  evidence_case_ids: string[];
  counterexamples: string[] | null;
  confidence: number;
  status: string;
  created_at: string;
}

/**
 * TWIN 판단 프로필 (기획서 §4.1) — **편집 가능한 거울**.
 *
 * 이 블록이 없으면 프로필은 "사용자가 못 고치는, 기계가 사용자에 대해 갖는
 * 기록"이 된다. 그건 정확히 이 제품이 되지 않기로 한 것이다. 항목마다 근거
 * 케이스 id 를 함께 보여주는 이유도 같다 — **왜 이렇게 아는지**를 볼 수
 * 없으면 고칠지 말지 판단할 수 없다.
 *
 * 삭제는 RLS(본인 delete 정책)로 브라우저에서 직접 한다. 수정은 v1 범위 밖 —
 * 지우고 다음 정산에서 다시 관찰되게 하는 것이 현재의 경로다.
 */
function JudgmentProfileBlock({ locale }: { locale: string }) {
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const [items, setItems] = useState<ProfileItem[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    // 은퇴 항목도 함께 읽는다. 반례가 쌓여 물러난 항목을 화면에서 지워 버리면
    // 사용자가 아는 것은 "언젠가 있던 것이 사라졌다"뿐이고, 그것은 기계가 몰래
    // 자기 기록을 고치는 형태다 — 물러난 사실과 이유가 보여야 이의를 제기한다.
    const { data, error: loadError } = await supabase
      .from('argus_profile_items')
      .select('id, layer, domain, content, evidence_case_ids, counterexamples, confidence, status, created_at')
      .in('status', ['active', 'retired'])
      .order('confidence', { ascending: false });
    // 마이그레이션 전이거나 테이블이 없으면 조용히 빈 목록 — 없는 기능을
    // 에러로 알리지 않는다 (아직 정산이 없으면 프로필도 없는 것이 정상이다).
    if (loadError) { setItems([]); return; }
    setItems((data || []) as ProfileItem[]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const retire = async (id: string) => {
    const { error: delError } = await supabase.from('argus_profile_items').delete().eq('id', id);
    if (delError) { setError(L('항목을 지우지 못했습니다.', 'Could not remove the item.')); return; }
    setError('');
    await load();
  };

  const LAYER_LABEL: Record<string, string> = locale === 'ko'
    ? { L1: '가치·기준', L2: '믿음·보정', L3: '정책' }
    : { L1: 'values', L2: 'beliefs', L3: 'policy' };

  return (
    <IntegrationSection title={L('판단 프로필 (분신)', 'Judgment profile (twin)')} defaultOpen={items.length > 0}>
      <p className="text-[12px] text-[var(--text-secondary)]">
        {L(
          '정산이 끝난 결정에서 관찰된 패턴입니다. 분신은 이 위에서 예측합니다. 같은 관찰이 반복되면 근거가 쌓이고, 현실이 반대로 답하면 반례가 쌓여 결국 물러납니다(취소선). 틀렸다고 생각되는 항목은 지우세요 — 지우면 분신이 더 이상 그것을 근거로 쓰지 않습니다.',
          'Patterns observed from settled decisions. Your twin predicts on top of these. Repeated observations add evidence; when reality answers otherwise, counterexamples accumulate until the item retires (struck through). Remove any that look wrong — the twin stops using them as grounds.',
        )}
      </p>
      {error && <p className="text-[12px] text-[var(--danger)] mt-2">{error}</p>}

      {items.length === 0 ? (
        <p className="text-[12px] text-[var(--text-tertiary)] mt-3">
          {L(
            '아직 항목이 없습니다. 결정을 정산하면 여기에 쌓입니다.',
            'Nothing yet. Items appear here once you settle decisions.',
          )}
        </p>
      ) : (
        <div className="mt-3 space-y-1.5">
          {items.map((it) => (
            <div key={it.id} className="flex items-start justify-between gap-3 text-[12px] px-2.5 py-2 rounded-md bg-[var(--bg)]">
              <span className={it.status === 'retired' ? 'text-[var(--text-tertiary)] line-through decoration-1' : 'text-[var(--text-secondary)]'}>
                <span className="text-[var(--text-tertiary)]">[{LAYER_LABEL[it.layer] ?? it.layer} · {it.domain}]</span>{' '}
                {it.content}
                {/* 근거 없이는 항목이 존재할 수 없다 — 그 사실을 화면에서도 보인다.
                    반례와 은퇴도 같은 줄에 적는다: 기계가 자기 관찰을 취소한
                    사실은 사용자가 볼 수 있어야 이의를 제기할 수 있다. */}
                <span className="block text-[11px] text-[var(--text-tertiary)] mt-0.5 no-underline">
                  {L('근거 정산 ', 'from ')}{(it.evidence_case_ids || []).length}{L('건', ' settlement(s)')}: {(it.evidence_case_ids || []).join(', ')}
                  {(it.counterexamples || []).length > 0 && (
                    <> · {L('반례 ', 'counterexamples ')}{(it.counterexamples || []).length}{L('건', '')}</>
                  )}
                  {it.status === 'retired' && (
                    <> · {L('현실이 반대로 답해서 물러남 — 분신이 더 이상 쓰지 않습니다', 'retired: reality answered otherwise — the twin no longer uses it')}</>
                  )}
                </span>
              </span>
              <button
                type="button"
                onClick={() => retire(it.id)}
                className="min-h-11 px-2 shrink-0 text-[var(--text-tertiary)] hover:text-[var(--danger)] cursor-pointer transition-colors"
              >
                {L('지우기', 'Remove')}
              </button>
            </div>
          ))}
        </div>
      )}
    </IntegrationSection>
  );
}

// ── 범위 위임 (TWIN Phase 4) ────────────────────────────────────────────────
//
// 신뢰 사다리의 마지막 칸이자, 사용자가 **가장 쉽게 되돌릴 수 있어야 하는** 칸.
// 그래서 이 블록의 기본 동작은 목록과 철회다. 만드는 것은 여기서 할 수 없다 —
// 위임은 대화 중 사용자의 명시적 채택으로만 태어나고(argus_adopt), 화면에서
// 만들 수 있게 하는 순간 "사용자가 자기 말로 만든 것"이라는 보증이 약해진다.
interface Delegation {
  id: string;
  policy: string;
  scope_domain: string;
  scope_condition: string;
  user_words: string;
  expires_at: string;
  status: string;
  suspended_reason: string | null;
  applications: number;
  supported: number;
  contradicted: number;
}

function DelegationBlock({ locale }: { locale: string }) {
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const [items, setItems] = useState<Delegation[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('argus_delegations')
      .select('id, policy, scope_domain, scope_condition, user_words, expires_at, status, suspended_reason, applications, supported, contradicted')
      .neq('status', 'revoked')
      .order('created_at', { ascending: false });
    if (loadError) { setItems([]); return; }
    setItems((data || []) as Delegation[]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const setStatus = async (id: string, status: 'active' | 'revoked') => {
    const { error: upError } = await supabase.from('argus_delegations').update({ status }).eq('id', id);
    if (upError) { setError(L('바꾸지 못했습니다.', 'Could not update.')); return; }
    setError('');
    await load();
  };

  return (
    <IntegrationSection title={L('범위 위임', 'Scoped delegation')} defaultOpen={items.length > 0}>
      <p className="text-[12px] text-[var(--text-secondary)]">
        {L(
          '대화 중에 "앞으로 이런 경우엔 늘 이렇게 하자"고 하신 것들입니다. 같은 조건의 결정을 열면 이 정책이 먼저 꺼내집니다 — 결정을 대신하지는 않습니다. 정산할 때마다 정책 자체가 채점되고, 어긋남이 쌓이면 스스로 멈춥니다.',
          'Policies you authorized in conversation. When a matching decision opens, the policy is surfaced first — it never decides for you. Each settlement grades the policy itself, and it suspends itself once contradictions pile up.',
        )}
      </p>
      {error && <p className="text-[12px] text-[var(--danger)] mt-2">{error}</p>}

      {items.length === 0 ? (
        <p className="text-[12px] text-[var(--text-tertiary)] mt-3">
          {L('아직 위임이 없습니다.', 'No delegations yet.')}
        </p>
      ) : (
        <div className="mt-3 space-y-1.5">
          {items.map((d) => (
            <div key={d.id} className="text-[12px] px-2.5 py-2 rounded-md bg-[var(--bg)]">
              <div className="flex items-start justify-between gap-3">
                <span className={d.status === 'suspended' ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-secondary)]'}>
                  <span className="text-[var(--text-tertiary)]">[{d.scope_domain}]</span> {d.policy}
                  <span className="block text-[11px] text-[var(--text-tertiary)] mt-0.5">
                    {L('그때 하신 말: ', 'your words: ')}&ldquo;{d.user_words}&rdquo;
                  </span>
                  <span className="block text-[11px] text-[var(--text-tertiary)]">
                    {L('적용 ', 'applied ')}{d.applications}{L('건 · 맞음 ', ' · supported ')}{d.supported}
                    {L(' · 어긋남 ', ' · contradicted ')}{d.contradicted}
                    {L(' · 만료 ', ' · expires ')}{d.expires_at.slice(0, 10)}
                    {/* 만료된 위임은 더 이상 꺼내지지 않는다. 목록에 남되 그
                        사실을 적는다 — 왜 안 나오는지 모르는 것이 더 나쁘다. */}
                    {new Date(d.expires_at).getTime() < Date.now() && (
                      <> · {L('만료됨 (더 이상 꺼내지 않습니다)', 'expired — no longer surfaced')}</>
                    )}
                  </span>
                  {d.status === 'suspended' && (
                    <span className="block text-[11px] text-[var(--danger)] mt-0.5">
                      {d.suspended_reason || L('자동으로 멈췄습니다.', 'Suspended automatically.')}
                    </span>
                  )}
                </span>
                <div className="flex shrink-0 gap-1">
                  {d.status === 'suspended' && (
                    <button
                      type="button"
                      onClick={() => setStatus(d.id, 'active')}
                      className="min-h-11 px-2 text-[var(--text-tertiary)] hover:text-[var(--accent)] cursor-pointer transition-colors"
                    >
                      {L('다시 켜기', 'Resume')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setStatus(d.id, 'revoked')}
                    className="min-h-11 px-2 text-[var(--text-tertiary)] hover:text-[var(--danger)] cursor-pointer transition-colors"
                  >
                    {L('철회', 'Revoke')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </IntegrationSection>
  );
}

interface PluginToken { id: string; label: string | null; last_used_at: string | null; created_at: string; scope?: string | null }

function PluginTokenBlock({ locale }: { locale: string }) {
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const [tokens, setTokens] = useState<PluginToken[]>([]);
  const [issued, setIssued] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    // scope 는 마이그레이션 20260805190000 이후에만 존재한다. 아직 적용되지 않은
    // 환경에서 목록 전체가 죽으면 안 되므로 없으면 없는 대로 읽는다.
    const withScope = await supabase
      .from('plugin_tokens')
      .select('id, label, last_used_at, created_at, scope')
      .order('created_at', { ascending: false });
    const result = withScope.error
      ? await supabase
          .from('plugin_tokens')
          .select('id, label, last_used_at, created_at')
          .order('created_at', { ascending: false })
      : withScope;
    if (result.error) { setError(locale === 'ko' ? '토큰 목록을 불러오지 못했습니다.' : 'Could not load tokens.'); return; }
    setTokens((result.data || []) as PluginToken[]);
  }, [locale]);
  useEffect(() => { void load(); }, [load]);

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
        signal: timeoutSignal(),
      });
      const json = await res.json();
      if (json.token) { setIssued(json.token); await load(); }
      else setError(L('토큰을 발급하지 못했습니다.', 'Could not issue the token.'));
    } finally { setBusy(false); }
  };

  const revoke = async (id: string) => {
    const { error: revokeError } = await supabase.from('plugin_tokens').delete().eq('id', id);
    if (revokeError) { setError(L('토큰을 해제하지 못했습니다. 토큰은 계속 유효합니다.', 'Could not revoke the token. It remains active.')); return; }
    await load();
  };

  return (
    <IntegrationSection title={L('동기화 토큰 (플러그인 · MCP)', 'Sync token (plugin · MCP)')} defaultOpen={tokens.length > 0}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] text-[var(--text-secondary)]">{L('플러그인: /argus:settings connect 후 /argus:settings sync. MCP: 아래 ARGUS_TOKEN을 설정에 넣으면 기록한 예측의 확인 알림을 이메일과 대시보드에서 받을 수 있어요.', 'Plugin: run /argus:settings connect, then /argus:settings sync. MCP: add the ARGUS_TOKEN below to receive check-in reminders for recorded predictions by email and in the dashboard.')}</p>
          {/* 원격 커넥터(Claude 등)는 토큰을 손으로 옮기지 않는다 — 연결 버튼 한 번이다.
              안내 페이지가 어디서도 링크되지 않으면 지어 놓고 아무도 못 찾는다. */}
          <p className="text-[12px] text-[var(--text-secondary)] mt-1.5">
            {L('Claude 같은 AI에 바로 연결하려면 ', 'To connect an AI like Claude directly, ')}
            <a href={`/${locale}/connect`} className="underline text-[var(--accent)] hover:opacity-80">
              {L('연결 안내', 'see the connect guide')}
            </a>
            {L(' — 토큰을 복사할 필요가 없습니다.', ' — no token copying needed.')}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={issue} disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} {L('새 토큰 발급', 'Issue token')}
        </Button>
      </div>
      {error && <p className="text-[12px] text-[var(--danger)] mt-2">{error}</p>}

      {issued && (
        <div className="mt-3 p-3 rounded-lg bg-[var(--checkpoint)] border border-amber-500/30">
          <p className="text-[12px] font-medium text-[var(--text-primary)] mb-1.5">{L('이 토큰은 지금만 보여요. 복사해서 안전하게 보관하세요.', 'Shown only once. Copy and store it safely.')}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[13px] font-mono bg-[var(--bg)] px-2.5 py-1.5 rounded-md break-all">{issued}</code>
            <Button variant="secondary" size="sm" onClick={async () => { await navigator.clipboard.writeText(issued); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </Button>
          </div>
          <div className="mt-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg)] p-2.5">
            <p className="text-[12.5px] text-[var(--text-tertiary)] mb-1">{L('플러그인에서 먼저 실행', 'Run first in the plugin')}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[13px] font-mono break-all">/argus:settings connect {issued}</code>
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(`/argus:settings connect ${issued}`);
                  setCopiedCommand(true);
                  setTimeout(() => setCopiedCommand(false), 2000);
                }}
              >
                {copiedCommand ? <Check size={13} /> : <Copy size={13} />} {L('명령 복사', 'Copy')}
              </Button>
            </div>
            <p className="text-[12.5px] text-[var(--text-tertiary)] mt-2">
              {L('그 다음부터는 로컬에서 ', 'Then use ')}
              <code className="font-mono">/argus:settings sync</code>
              {L('로 웹앱과 로컬 판단 기록을 맞추면 됩니다.', ' to keep the web app and local decision record aligned.')}
            </p>
          </div>
          {/* MCP: env var for argus-decision-mcp config */}
          <div className="mt-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg)] p-2.5">
            <p className="text-[12.5px] text-[var(--text-tertiary)] mb-1">{L('MCP 사용 시 — 설정 env에 붙여넣기', 'Using MCP — paste into your config env')}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[13px] font-mono break-all">{`"ARGUS_TOKEN": "${issued}"`}</code>
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(`"ARGUS_TOKEN": "${issued}"`);
                  setCopiedEnv(true);
                  setTimeout(() => setCopiedEnv(false), 2000);
                }}
              >
                {copiedEnv ? <Check size={13} /> : <Copy size={13} />} {L('복사', 'Copy')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {tokens.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {tokens.map((t) => (
            <div key={t.id} className="flex items-center justify-between text-[12px] px-2.5 py-1.5 rounded-md bg-[var(--bg)]">
              <span className="text-[var(--text-secondary)]">
                {t.label || 'CLI'}
                {/* 원격 커넥터 토큰은 결정 표면만 연다 — 목록에서 계정 전체 토큰과
                    구분되지 않으면 사용자는 무엇을 해지하는지 모른 채 해지한다. */}
                {t.scope === 'argus.decisions' && (
                  <span className="ml-1.5 text-[11px] text-[var(--text-tertiary)]">{L('· 결정만', '· decisions only')}</span>
                )}
                {' · '}<span className="text-[var(--text-tertiary)]">{t.last_used_at ? L('최근 사용 ', 'used ') + t.last_used_at.slice(0, 10) : L('미사용', 'unused')}</span>
              </span>
              <button type="button" onClick={() => revoke(t.id)} className="min-h-11 px-2 text-[var(--text-tertiary)] hover:text-[var(--danger)] cursor-pointer transition-colors">
                {L('해지', 'Revoke')}
              </button>
            </div>
          ))}
        </div>
      )}
    </IntegrationSection>
  );
}

interface SharedLink { id: string; token: string; title: string | null; view_count: number; created_at: string }

function SharedLinksBlock({ locale }: { locale: string }) {
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const [links, setLinks] = useState<SharedLink[]>([]);
  const [origin, setOrigin] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('shared_links')
      .select('id, token, title, view_count, created_at')
      .order('created_at', { ascending: false });
    if (loadError) { setError(locale === 'ko' ? '공개 링크를 불러오지 못했습니다.' : 'Could not load public links.'); return; }
    setError('');
    setLinks(data || []);
  }, [locale]);
  useEffect(() => { setOrigin(window.location.origin); void load(); }, [load]);

  const revoke = async (id: string) => {
    const { error: revokeError } = await supabase.from('shared_links').delete().eq('id', id);
    if (revokeError) { setError(L('링크를 취소하지 못했습니다. 링크는 계속 열릴 수 있습니다.', 'Could not revoke the link. It may still be accessible.')); return; }
    await load();
  };

  return (
    <IntegrationSection title={L('공개 링크', 'Public links')} defaultOpen={links.length > 0}>
      {error && <p className="text-[12px] text-[var(--danger)] mb-2">{error}</p>}
      <p className="text-[12px] text-[var(--text-secondary)] mb-2">{L('결과 화면의 “보내기 → 링크”로 만든 공개 페이지. 취소하면 즉시 열람 불가.', 'Public pages minted via “Send → Link”. Revoking makes them unreachable at once.')}</p>
      {links.length === 0 ? (
        <p className="text-[12px] text-[var(--text-tertiary)]">{L('아직 만든 공개 링크가 없어요.', 'No public links yet.')}</p>
      ) : (
        <div className="space-y-1.5">
          {links.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 text-[12px] px-2.5 py-1.5 rounded-md bg-[var(--bg)]">
              <a href={`${origin}/d/${l.token}`} target="_blank" rel="noopener noreferrer" className="truncate text-[var(--text-secondary)] hover:text-[var(--accent)]">
                {l.title || '/d/' + l.token} <span className="text-[var(--text-tertiary)]">· {L('조회', 'views')} {l.view_count}</span>
              </a>
              <button type="button" onClick={() => revoke(l.id)} className="min-h-11 shrink-0 px-2 text-[var(--text-tertiary)] hover:text-[var(--danger)] cursor-pointer transition-colors">
                {L('취소', 'Revoke')}
              </button>
            </div>
          ))}
        </div>
      )}
    </IntegrationSection>
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
        <span className="text-[12.5px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">{L('나의 사용 현황', 'My Usage')}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item, i) => (
          <div key={i} className="px-3 py-2 rounded-lg bg-[var(--bg)]">
            <p className="text-[12px] text-[var(--text-tertiary)] mb-0.5">{item.label}</p>
            <p className="text-[13px] font-medium text-[var(--text-primary)]">{item.value}</p>
          </div>
        ))}
      </div>
      <p className="text-[12px] text-[var(--text-tertiary)] mt-2">{L('사용 기록만 보여줘요. 판단력이나 성향을 평가하지 않아요.', 'Usage facts only — this does not grade your judgment or personality.')}</p>
    </div>
  );
}
