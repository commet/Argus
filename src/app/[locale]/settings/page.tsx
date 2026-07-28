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
import { DEFAULT_OPENAI_MODEL, DEFAULT_GEMINI_MODEL } from '@/lib/llm-models';
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
  // 버튼 라벨은 모두 '제공자 브랜드' 한 층위로 통일한다 (Claude / GPT / Gemini).
  // 구체 모델명은 아래 detail 줄에서 말한다 — 예전엔 'GPT-4o'만 특정 모델명이라
  // Claude·Gemini(브랜드)와 층위가 어긋났고, 'Claude Sonnet 4' 문구는 실제 라우팅
  // (기본 Sonnet 4.6 · 어려운 판단 Opus 4.8)보다 낡아 있었다.
  // model 칩은 모델이 고정된 Claude에만 붙인다. GPT·Gemini는 바로 아래
  // 드롭다운에서 사용자가 직접 고르므로, 특정 모델명을 여기 박으면 선택값과
  // 어긋난다 — 대신 '아래에서 선택'으로 안내한다.
  return [
    { value: 'anthropic' as LLMProvider, label: 'Claude', model: 'Claude Sonnet 4.6', detail: L('복잡한 판단은 Opus 4.8로 올려서 처리해요', 'Hard calls escalate to Opus 4.8') },
    { value: 'openai' as LLMProvider, label: 'GPT', model: null as string | null, detail: L('본인의 OpenAI API 키로 연결 · 모델은 아래에서 선택', 'Your own OpenAI API key · pick the model below') },
    { value: 'gemini' as LLMProvider, label: 'Gemini', model: null as string | null, detail: L('본인의 Google AI API 키로 연결 · 모델은 아래에서 선택', 'Your own Google AI API key · pick the model below') },
  ];
}

function buildLlmModes(L: (ko: string, en: string) => string) {
  return [
    { value: 'proxy' as LLMMode, label: L('프록시', 'Proxy'), description: L('API 키 없이 바로 써요 (권장)', 'No API key needed (recommended)'), available: true },
    { value: 'direct' as LLMMode, label: L('직접 키', 'Direct Key'), description: L('본인의 API 키 사용. 제한 없음', 'Use your own API key. No limits'), available: true },
    { value: 'local' as LLMMode, label: L('로컬', 'Local'), description: L('Ollama 로컬 엔드포인트', 'Ollama local endpoint'), available: false },
  ];
}

export default function SettingsPage() {
  const locale = useLocale();
  const { switchTo, pendingLocale, confirmSwitch, cancelSwitch } = useLocaleSwitch();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const llmProviders = buildLlmProviders(L);
  const llmModes = buildLlmModes(L);

  const { user } = useAuth();
  const { settings, loadSettings, updateSettings } = useSettingsStore();
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
      if (user) {
        // Logged in — erase ALL server data + the auth identity (complete, with receipt).
        const result = await deleteAccount();
        if (!result.ok) {
          toast(L('일부 데이터를 지우지 못했어요. 계정은 안전하게 보존했어요. 다시 시도해 주세요.', 'Some data could not be deleted. Your account was kept safe. Please try again.'), 'error');
          setDeleting(false);
          return;
        }
        let localPurgeComplete = true;
        try { await purgeCurrentBrowserContinuity(user.id); }
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
        // Anonymous — only this browser's local data exists.
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
          {L('결정을 분석할 때 사용할 AI를 정해요.', 'Choose which AI helps analyze your decisions.')}
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
              {p?.model && <span className="font-semibold text-[var(--text-primary)]">{p.model} · </span>}
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
                <option value="gemini-2.5-flash">Gemini 2.5 Flash — {L('빠르고 저렴 (추천)', 'Fast & cheap (recommended)')}</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro — {L('고품질', 'High quality')}</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash — {L('초경량', 'Ultra lightweight')}</option>
              </select>
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
          {L('검토 피드백(상사 시점)의 톤과 깊이를 정하는 데 써요.', 'Tunes the tone and depth of your review feedback.')}
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
          {L('일부 UI는 아직 한국어로만 나와요.', 'Some UI text is still Korean-only.')}
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
            {L('아직 다듬는 중인 기능이에요. 언제든 켜고 끌 수 있어요.', 'Features still being polished. Toggle anytime.')}
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
          {user
            ? L('서버에 저장된 모든 데이터와 계정이 영구 삭제되고, 로그아웃됩니다.', 'All your server-stored data and your account will be permanently deleted, and you’ll be signed out.')
            : L('이 브라우저에 저장된 모든 프로젝트·초안·검토 이력이 삭제됩니다.', 'Every project, draft, and review stored in this browser will be deleted.')}
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
  const loadError = useTelegramStore((s) => s.loadError);
  const [pending, setPending] = useState(false);
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

  return (
    <IntegrationSection title="Telegram" defaultOpen={connections.length > 0}>
      {loadError && <p className="text-[12px] text-[var(--danger)] mb-2">{L('Telegram 연결 상태를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', 'Could not load Telegram connection status. Please try again shortly.')}</p>}
      {connections.length > 0 ? (
        <div className="space-y-2">
          {connections.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-3 bg-[var(--bg)] rounded-lg">
              <div>
                <p className="text-[14px] font-medium flex items-center gap-1.5">
                  <Check size={14} className="text-[var(--success)]" /> {c.chat_title || L('내 Telegram', 'My Telegram')}
                </p>
                <p className="text-[12px] text-[var(--text-secondary)]">{L('결과를 이 채팅으로 보내고, 봇에게 고민을 DM하면 바로 리프레임해 줘요', 'Send results here — and DM the bot a decision to get an instant reframe')}</p>
              </div>
              <Button variant="danger" size="sm" onClick={async () => {
                const result = await disconnect(c.id);
                if (!result.ok) setNote(L('연결을 해제하지 못했습니다. 연결은 그대로 유지됩니다.', 'Could not disconnect. The connection is still active.'));
              }}>
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
        <button type="button" onClick={() => loadConnections()} className="min-h-[44px] text-[13px] text-[var(--text-tertiary)] hover:text-[var(--accent)] mt-1.5 cursor-pointer transition-colors">
          {L('연결했는데 안 보이면 새로고침', 'Connected but not showing? Refresh')}
        </button>
      )}
    </IntegrationSection>
  );
}

interface PluginToken { id: string; label: string | null; last_used_at: string | null; created_at: string }

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
    const { data, error: loadError } = await supabase
      .from('plugin_tokens')
      .select('id, label, last_used_at, created_at')
      .order('created_at', { ascending: false });
    if (loadError) { setError(locale === 'ko' ? '토큰 목록을 불러오지 못했습니다.' : 'Could not load tokens.'); return; }
    setTokens(data || []);
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
                {t.label || 'CLI'} · <span className="text-[var(--text-tertiary)]">{t.last_used_at ? L('최근 사용 ', 'used ') + t.last_used_at.slice(0, 10) : L('미사용', 'unused')}</span>
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
