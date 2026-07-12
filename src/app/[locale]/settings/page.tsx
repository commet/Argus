'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { clearAllStorage, STORAGE_KEYS, getStorage } from '@/lib/storage';
import { downloadJson } from '@/lib/export';
import { exportAccountData, deleteAccount } from '@/lib/api-account';
import { useAuth } from '@/lib/auth';
import type { LLMMode, LLMProvider } from '@/stores/types';
import { Download, Upload, Trash2, Eye, EyeOff, Server, Globe, Check, MessageSquare, Unlink, User, BarChart3, FlaskConical, Send, Copy, KeyRound, Loader2, Link2 } from 'lucide-react';
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

function buildLlmProviders(L: (ko: string, en: string) => string) {
  return [
    { value: 'anthropic' as LLMProvider, label: 'Claude', description: L('Claude Sonnet 4 — 프록시 또는 직접 API 키', 'Claude Sonnet 4 — proxy or direct API key') },
    { value: 'openai' as LLMProvider, label: 'GPT-4o', description: L('본인의 OpenAI API 키 사용', 'Use your own OpenAI API key') },
    { value: 'gemini' as LLMProvider, label: 'Gemini', description: L('본인의 Google AI API 키 사용', 'Use your own Google AI API key') },
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
  const { switchTo } = useLocaleSwitch();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const llmProviders = buildLlmProviders(L);
  const llmModes = buildLlmModes(L);

  const { user } = useAuth();
  const { settings, loadSettings, updateSettings } = useSettingsStore();
  const [showKey, setShowKey] = useState(false);
  const [resetModal, setResetModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
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
      alert(L('파일이 10MB를 넘어 이 화면에서는 읽지 못했어요. 파일은 지우지 말고 보관해 주세요.', "This file is over 10MB, more than this screen can read. Don't delete it — keep it safe."));
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
          alert(L(
            '서버 내보내기 파일이에요. 이 파일은 보관용 사본이고, 앱으로 되돌리는 복원은 아직 지원하지 않아요. 복원하려면 로그아웃 상태에서 만든 백업 파일을 사용하세요.',
            "This is a server export file — an archival copy. Restoring it into the app isn't supported yet. To restore, use a backup file created while signed out.",
          ));
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
          alert(L('이 파일에서는 결정 기록을 찾지 못했어요. Argus에서 내보낸 파일이 맞다면, 저희 쪽 문제일 수 있어요 — 파일은 지우지 말고 보관해 주세요.', "Couldn't find any decision records in this file. If it came from an Argus export, the fault may be on our side — don't delete it, keep it safe."));
          return;
        }
        alert(L('데이터를 성공적으로 가져왔습니다. 페이지를 새로고침합니다.', 'Data imported successfully. The page will now reload.'));
        window.location.reload();
      } catch {
        alert(L('이 파일은 JSON 형식으로 읽히지 않았어요. 내보내기로 받은 .json 파일을 그대로 올려 주세요.', "This file didn't read as JSON. Please upload the .json file from the export as-is."));
      }
    };
    reader.readAsText(file);
  };

  const handleServerExport = async () => {
    setExporting(true);
    try {
      await exportAccountData();
    } catch {
      alert(L('내보내기에 실패했어요. 다시 시도해 주세요.', 'Export failed. Please try again.'));
    } finally {
      setExporting(false);
    }
  };

  const handleReset = async () => {
    setDeleting(true);
    try {
      if (user) {
        // Logged in — erase ALL server data + the auth identity (complete, with receipt).
        const result = await deleteAccount();
        if (!result.ok) {
          alert(L('일부 데이터를 지우지 못했어요. 계정은 안전하게 보존했어요. 다시 시도해 주세요.', 'Some data could not be deleted. Your account was kept safe. Please try again.'));
          setDeleting(false);
          return;
        }
        clearAllStorage();
        await supabase.auth.signOut();
        setResetModal(false);
        window.location.href = withLocale(locale, '/');
      } else {
        // Anonymous — only this browser's local data exists.
        clearAllStorage();
        setResetModal(false);
        window.location.reload();
      }
    } catch {
      alert(L('삭제에 실패했어요. 다시 시도해 주세요.', 'Deletion failed. Please try again.'));
      setDeleting(false);
    }
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
        <p className="text-[13px] text-[var(--text-secondary)] mt-1">{L('프로필, AI 엔진, 환경 설정', 'Profile, AI engine, preferences')}</p>
      </div>

      {/* A1 IA: left sticky section-nav (desktop) / sticky horizontal chip row
          (mobile) + right panel. Section internals are unchanged — only the
          shell is restructured, and the destructive action moves out of the
          integrations card into its own isolated danger zone at the bottom. */}
      <div className="mt-5 lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-10 lg:items-start">
        <SettingsNav items={NAV_ITEMS} ariaLabel={L('설정 섹션', 'Settings sections')} />
        <div className="space-y-6 min-w-0 mt-4 lg:mt-0">

      <section id="engine" className="scroll-mt-28">
      {/* ── 1. AI Engine (provider + mode + key merged) ── */}
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
              className={`flex-1 min-h-[44px] py-3 rounded-lg text-[12px] font-medium border text-center transition-colors cursor-pointer ${
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
                value={settings.openai_model || DEFAULT_OPENAI_MODEL}
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
                value={settings.gemini_model || DEFAULT_GEMINI_MODEL}
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
      </section>

      <section id="integrations" className="scroll-mt-28">
      {/* ── 2. Integrations & Data ── */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare size={16} className="text-[var(--accent)]" />
          <h3 className="text-[15px] font-bold">{L('연동 & 데이터', 'Integrations & Data')}</h3>
        </div>

        {/* Slack — folded by default (05 S8); held open when returning from the
            OAuth callback or when a workspace is already connected. */}
        <details open={slackStatus !== null || slackConnections.length > 0}>
          <summary className="cursor-pointer text-[13px] font-medium text-[var(--text-primary)]">Slack</summary>
          <div className="mt-3">
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
          </div>
        </details>

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
              <p className="text-[11px] text-[var(--text-secondary)]">
                {user
                  ? L('서버에 저장된 모든 데이터를 JSON 한 파일로', 'Every row stored on the server, as one JSON file')
                  : L('이 브라우저의 데이터를 JSON으로', 'This browser’s data, as JSON')}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={user ? handleServerExport : handleExport} disabled={exporting}>
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {L('내보내기', 'Export')}
            </Button>
          </div>
          {/* Import */}
          <div className="flex items-center justify-between p-3 bg-[var(--bg)] rounded-lg gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-medium">{L('백업 가져오기', 'Import backup')}</p>
              <p className="text-[11px] text-[var(--text-secondary)]">{L('내보낸 JSON 파일에서 복원', 'Restore from an exported JSON file')}</p>
            </div>
            <label className="cursor-pointer shrink-0">
              <span className="inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-all duration-150 active:scale-[0.98] bg-transparent border-[1.5px] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg)] px-3 py-1.5 text-[13px]">
                <Upload size={14} /> {L('가져오기', 'Import')}
              </span>
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>
        </div>
      </Card>
      </section>

      <section id="profile" className="scroll-mt-28">
      {/* ── 3. My Profile ── */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <User size={16} className="text-[var(--accent)]" />
          <h3 className="text-[15px] font-bold">{L('내 프로필', 'My Profile')}</h3>
        </div>
        <p className="text-[12px] text-[var(--text-secondary)] mb-4">
          {L('검토 피드백(상사 시점)의 톤과 깊이를 정하는 데 써요.', 'Tunes the tone and depth of your review feedback.')}
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
      </section>

      <section id="prefs" className="scroll-mt-28">
      {/* ── 4. Preferences (Language + Sound) ── */}
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
        <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5">
          {L('일부 UI는 아직 한국어로만 나와요.', 'Some UI text is still Korean-only.')}
        </p>

        {/* Appearance / theme (option C) */}
        <div className="border-t border-[var(--border-subtle)] my-4" />
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-medium text-[var(--text-primary)]">{L('화면 테마', 'Appearance')}</span>
        </div>
        <div className="flex gap-2">
          {[
            { value: 'light' as const, label: L('라이트', 'Light') },
            { value: 'dark' as const, label: L('다크', 'Dark') },
            { value: 'system' as const, label: L('시스템', 'System') },
          ].map((opt) => (
            <button
              key={opt.value}
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
        <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5">
          {L('시스템은 기기 설정을 따라가요. 첫 방문(홈)은 라이트로 시작합니다.', 'System follows your device. The landing page starts in light.')}
        </p>

        {/* Sound — folded by default (05 S8: order/fold only, no feature change) */}
        <div className="border-t border-[var(--border-subtle)] my-4" />
        <details>
          <summary className="cursor-pointer text-[13px] font-medium text-[var(--text-primary)]">{L('소리', 'Sound')}</summary>
          <div className="mt-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium">{L('전환음', 'Transition Sound')}</p>
            <p className="text-[11px] text-[var(--text-secondary)]">{L('단계 전환 시 잔잔한 항해 톤', 'A gentle voyage tone on step transitions')}</p>
          </div>
          <button
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
          </div>
        </details>
      </Card>
      </section>

      <section id="labs" className="scroll-mt-28">
      {/* ── 5. Labs ── */}
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <FlaskConical size={16} className="text-[var(--accent)]" />
          <h3 className="text-[15px] font-bold">{L('실험실 (Labs)', 'Labs')}</h3>
        </div>
        <details>
          <summary className="cursor-pointer text-[12px] text-[var(--text-secondary)]">
            {L('아직 다듬는 중인 기능이에요. 언제든 켜고 끌 수 있어요.', 'Features still being polished. Toggle anytime.')}
          </summary>
          <div className="space-y-3 mt-4">
          {([
            {
              key: 'new_arc_enabled' as const,
              label: L('시험 항해 (실험 중)', 'Trial Sail (experimental)'),
              desc: L('분석 단계에서 AI 실행자 여럿이 같은 글을 따로 읽고, 갈리는 지점을 측정해 보여줘요', 'In the analysis stage, several AI executors read the same text separately and show where they diverge'),
            },
            {
              key: 'classic_session' as const,
              label: L('클래식 세션 보기', 'Classic session view'),
              desc: L('단계별 확인 화면을 항상 펼쳐 둬요 (항해 지도는 이제 왼쪽에 늘 있어요)', 'Keep the per-step confirmation screens always open (the voyage map now lives on the left at all times)'),
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
      <section id="danger" className="scroll-mt-28">
        <Card variant="danger">
          <h3 className="text-[15px] font-bold text-[var(--danger)] mb-3">{L('위험 구역', 'Danger zone')}</h3>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-[var(--danger)]">
                {user ? L('계정 완전 삭제', 'Delete my account') : L('데이터 초기화', 'Reset data')}
              </p>
              <p className="text-[11px] text-[var(--danger)]/70">
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
            // P1-C6: the server export is an archival copy, not a restorable
            // backup — say so at the moment it matters most (right before delete).
            ? L('되돌릴 수 없어요. 필요하면 먼저 “내보내기”로 사본을 받아두세요. (사본은 열람용이에요 — 앱으로 자동 복원되지는 않아요.)', 'This cannot be undone. Export a copy first if you might need it. (The copy is for viewing — it does not restore back into the app.)')
            : L('되돌릴 수 없어요.', 'This cannot be undone.')}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setResetModal(false)} disabled={deleting}>{L('취소', 'Cancel')}</Button>
          <Button variant="danger" onClick={handleReset} disabled={deleting}>
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} {user ? L('영구 삭제', 'Delete forever') : L('삭제', 'Delete')}
          </Button>
        </div>
      </Modal>
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
      <ul className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible whitespace-nowrap py-2 lg:py-0">
        {items.map((it) => {
          const on = active === it.id;
          return (
            <li key={it.id} className="shrink-0">
              <a
                href={`#${it.id}`}
                aria-current={on ? 'true' : undefined}
                className={`flex items-center rounded-lg px-3 min-h-[40px] text-[13px] font-medium transition-colors ${
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
        setNote(r.error || L('연결을 시작할 수 없어요.', 'Could not start connect.'));
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
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
        <button type="button" onClick={() => loadConnections()} className="min-h-[44px] text-[11.5px] text-[var(--text-tertiary)] hover:text-[var(--accent)] mt-1.5 cursor-pointer transition-colors">
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
      else setError(json.error || L('발급 실패', 'Could not issue'));
    } finally { setBusy(false); }
  };

  const revoke = async (id: string) => {
    const { error: revokeError } = await supabase.from('plugin_tokens').delete().eq('id', id);
    if (revokeError) { setError(L('토큰을 해제하지 못했습니다. 토큰은 계속 유효합니다.', 'Could not revoke the token. It remains active.')); return; }
    await load();
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[14px] font-medium flex items-center gap-1.5"><KeyRound size={14} className="text-[var(--accent)]" /> {L('터미널 동기화 토큰 (플러그인 · MCP)', 'Terminal sync token (plugin · MCP)')}</p>
          <p className="text-[12px] text-[var(--text-secondary)]">{L('플러그인: /argus:connect 후 /argus:sync. MCP: 아래 ARGUS_TOKEN을 설정에 넣으면 봉인한 예측이 이메일과 대시보드로 돌아옵니다.', 'Plugin: /argus:connect then /argus:sync. MCP: put ARGUS_TOKEN below in your config so sealed predictions return by email + dashboard.')}</p>
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
          <div className="mt-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg)] p-2.5">
            <p className="text-[11px] text-[var(--text-tertiary)] mb-1">{L('플러그인에서 먼저 실행', 'Run first in the plugin')}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11.5px] font-mono break-all">/argus:connect {issued}</code>
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(`/argus:connect ${issued}`);
                  setCopiedCommand(true);
                  setTimeout(() => setCopiedCommand(false), 2000);
                }}
              >
                {copiedCommand ? <Check size={13} /> : <Copy size={13} />} {L('명령 복사', 'Copy')}
              </Button>
            </div>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-2">
              {L('그 다음부터는 로컬에서 ', 'Then use ')}
              <code className="font-mono">/argus:sync</code>
              {L('로 웹앱과 로컬 ledger를 맞추면 됩니다.', ' to keep the webapp and local ledger aligned.')}
            </p>
          </div>
          {/* MCP: env var for argus-decision-mcp config */}
          <div className="mt-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg)] p-2.5">
            <p className="text-[11px] text-[var(--text-tertiary)] mb-1">{L('MCP 사용 시 — 설정 env에 붙여넣기', 'Using MCP — paste into your config env')}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11.5px] font-mono break-all">{`"ARGUS_TOKEN": "${issued}"`}</code>
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
    <div>
      <p className="text-[14px] font-medium flex items-center gap-1.5"><Link2 size={14} className="text-[var(--accent)]" /> {L('공개 링크', 'Public links')}</p>
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
              <button onClick={() => revoke(l.id)} className="shrink-0 text-[var(--text-tertiary)] hover:text-[var(--danger)] cursor-pointer transition-colors">
                {L('취소', 'Revoke')}
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
      <p className="text-[10px] text-[var(--text-tertiary)] mt-2">{L('쓸수록 피드백이 점점 나에게 맞춰져요.', 'The more you use it, the more the feedback fits you.')}</p>
    </div>
  );
}
