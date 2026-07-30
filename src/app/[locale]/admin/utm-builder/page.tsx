'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Card } from '@/components/ui/Card';
import { CopyButton } from '@/components/ui/CopyButton';
import { Link2, Copy, Trash2, Check } from 'lucide-react';
import { LocaleLink } from '@/components/ui/LocaleLink';
import { useLocale } from '@/hooks/useLocale';

type Preset = {
  id: string;
  ko: string;
  en: string;
  source: string;
  medium: string;
};

const PRESETS: Preset[] = [
  { id: 'internal_qa', ko: '내부 QA (통계 제외)', en: 'Internal QA (excluded)', source: 'internal_qa', medium: 'qa' },
  { id: 'kakao', ko: '카카오톡 대화방', en: 'KakaoTalk chat', source: 'kakao', medium: 'chat' },
  { id: 'threads', ko: 'Threads', en: 'Threads', source: 'threads', medium: 'social' },
  { id: 'instagram', ko: 'Instagram (스토리/게시물)', en: 'Instagram (story/post)', source: 'instagram', medium: 'social' },
  { id: 'linkedin', ko: 'LinkedIn', en: 'LinkedIn', source: 'linkedin', medium: 'social' },
  { id: 'x', ko: 'X (Twitter)', en: 'X (Twitter)', source: 'x', medium: 'social' },
  { id: 'discord', ko: 'Discord', en: 'Discord', source: 'discord', medium: 'community' },
  { id: 'facebook', ko: 'Facebook 그룹', en: 'Facebook group', source: 'facebook', medium: 'community' },
  { id: 'reddit', ko: 'Reddit', en: 'Reddit', source: 'reddit', medium: 'community' },
  { id: 'blog', ko: '블로그 글', en: 'Blog post', source: 'blog', medium: 'article' },
  { id: 'email', ko: '이메일 뉴스레터', en: 'Email newsletter', source: 'email', medium: 'newsletter' },
  { id: 'youtube', ko: 'YouTube 설명란', en: 'YouTube description', source: 'youtube', medium: 'video' },
  { id: 'custom', ko: '직접 입력', en: 'Custom', source: '', medium: '' },
];

const PATHS = [
  { value: '/', ko: '홈 (/)', en: 'Home (/)' },
  { value: '/workspace', ko: '워크스페이스 (/workspace)', en: 'Workspace (/workspace)' },
  { value: '/boss', ko: '팀장 대화 리허설 (/boss)', en: 'Manager conversation rehearsal (/boss)' },
  { value: '/agents', ko: 'AI 팀원 (/agents)', en: 'AI reviewers (/agents)' },
];

const BASE_URL = 'https://argus.voyage';
const HISTORY_KEY = 'ov_utm_history';
const MAX_HISTORY = 8;

/** Normalize a campaign/content input into a URL-safe token. */
function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w가-힣-]/g, '');
}

type HistoryEntry = {
  url: string;
  label: string;
  createdAt: number;
};

function loadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
  } catch {
    /* ignore quota errors */
  }
}

export default function UtmBuilderPage() {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const { user, loading } = useAuth();

  const [presetId, setPresetId] = useState<string>('kakao');
  const [customSource, setCustomSource] = useState('');
  const [customMedium, setCustomMedium] = useState('');
  const [campaign, setCampaign] = useState('');
  const [content, setContent] = useState('');
  const [path, setPath] = useState('/');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [justCopied, setJustCopied] = useState<string | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const preset = PRESETS.find(p => p.id === presetId) || PRESETS[0];
  const isCustom = presetId === 'custom';
  const source = isCustom ? slugify(customSource) : preset.source;
  const medium = isCustom ? slugify(customMedium) : preset.medium;
  const campaignSlug = slugify(campaign);
  const contentSlug = slugify(content);

  const builtUrl = useMemo(() => {
    if (!source) return '';
    const localizedPath = `/${locale}${path === '/' ? '' : path}`;
    const url = new URL(BASE_URL + localizedPath);
    url.searchParams.set('utm_source', source);
    if (medium) url.searchParams.set('utm_medium', medium);
    if (campaignSlug) url.searchParams.set('utm_campaign', campaignSlug);
    if (contentSlug) url.searchParams.set('utm_content', contentSlug);
    return url.toString();
  }, [locale, path, source, medium, campaignSlug, contentSlug]);

  const isReady = !!source && !!campaignSlug;

  const handleSaveToHistory = () => {
    if (!isReady || !builtUrl) return;
    const label = `${locale === 'ko' ? preset.ko : preset.en}${campaign ? ' · ' + campaign : ''}${content ? ' / ' + content : ''}`;
    const next = [
      { url: builtUrl, label, createdAt: Date.now() },
      ...history.filter(h => h.url !== builtUrl),
    ].slice(0, MAX_HISTORY);
    setHistory(next);
    saveHistory(next);
  };

  const handleDeleteHistory = (url: string) => {
    const next = history.filter(h => h.url !== url);
    setHistory(next);
    saveHistory(next);
  };

  const handleCopyHistory = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setJustCopied(url);
      setTimeout(() => setJustCopied(null), 1500);
    } catch {
      /* no-op */
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-[var(--text-tertiary)]">{L('불러오는 중…', 'Loading…')}</div>;
  }
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 max-w-sm">
          <p className="text-[14px] text-[var(--text-secondary)]">{L('로그인이 필요합니다.', 'Sign in is required.')}</p>
          <LocaleLink href="/login" className="mt-4 inline-block text-[13px] text-[var(--accent)] underline">{L('로그인하기', 'Sign in')}</LocaleLink>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Link2 size={20} className="text-[var(--accent)]" />
            <h1 className="text-[22px] font-bold text-[var(--text-primary)]">{L('UTM 링크 만들기', 'UTM link builder')}</h1>
          </div>
          <p className="text-[13px] text-[var(--text-secondary)] leading-[1.6]">
            {L('채널마다 다른 링크를 만들면 데일리 리포트에서 유입 소스와 캠페인별 성과를 구분할 수 있어요.', 'Create a distinct link for each channel so the daily report can separate traffic by source and campaign.')}
          </p>
        </header>

        {/* ── Builder form ── */}
        <Card className="p-6 mb-6">
          <div className="flex flex-col gap-5">
            {/* Channel */}
            <div>
              <label className="block text-[13px] font-semibold text-[var(--text-primary)] mb-2">{L('채널', 'Channel')}</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                {PRESETS.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPresetId(p.id)}
                    className={`
                      px-3 py-2 rounded-lg text-[12px] font-medium text-left transition-all
                      ${presetId === p.id
                        ? 'bg-[var(--accent)] text-white shadow-[var(--shadow-sm)]'
                        : 'bg-[var(--bg)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent-light)]'
                      }
                    `}
                  >
                    {locale === 'ko' ? p.ko : p.en}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom source/medium */}
            {isCustom && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-semibold text-[var(--text-primary)] mb-1.5">Source</label>
                  <input
                    type="text"
                    value={customSource}
                    onChange={e => setCustomSource(e.target.value)}
                    placeholder={L('예: ponderly, hn', 'e.g. ponderly, hn')}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-[14px]"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-[var(--text-primary)] mb-1.5">Medium</label>
                  <input
                    type="text"
                    value={customMedium}
                    onChange={e => setCustomMedium(e.target.value)}
                    placeholder={L('예: newsletter, forum', 'e.g. newsletter, forum')}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-[14px]"
                  />
                </div>
              </div>
            )}

            {/* Campaign (required) */}
            <div>
              <label className="block text-[13px] font-semibold text-[var(--text-primary)] mb-1.5">
                {L('캠페인 이름', 'Campaign name')} <span className="text-[var(--accent)]">*</span>
              </label>
              <input
                type="text"
                value={campaign}
                onChange={e => setCampaign(e.target.value)}
                placeholder={L('예: vibecoding_kr, launch_april', 'e.g. launch_april, design_community')}
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-[14px]"
              />
              <p className="text-[12.5px] text-[var(--text-tertiary)] mt-1">
                {L('리포트에서 이 값으로 묶어 봅니다. 캠페인이나 그룹마다 구분해 주세요.', 'Reports group results by this value. Use a distinct name for each campaign or group.')}
              </p>
            </div>

            {/* Content (optional) */}
            <div>
              <label className="block text-[13px] font-semibold text-[var(--text-primary)] mb-1.5">
                {L('콘텐츠', 'Content')} <span className="text-[var(--text-tertiary)] font-normal">{L('(선택)', '(optional)')}</span>
              </label>
              <input
                type="text"
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder={L('예: first_share, pinned_msg, v2', 'e.g. first_share, pinned_msg, v2')}
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-[14px]"
              />
              <p className="text-[12.5px] text-[var(--text-tertiary)] mt-1">
                {L('같은 캠페인 안에서 A/B 링크를 구분할 때 사용합니다.', 'Use this to distinguish A/B links within one campaign.')}
              </p>
            </div>

            {/* Destination */}
            <div>
              <label className="block text-[13px] font-semibold text-[var(--text-primary)] mb-1.5">{L('도착 페이지', 'Destination')}</label>
              <select
                value={path}
                onChange={e => setPath(e.target.value)}
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-[14px]"
              >
                {PATHS.map(p => <option key={p.value} value={p.value}>{locale === 'ko' ? p.ko : p.en}</option>)}
              </select>
            </div>
          </div>
        </Card>

        {/* ── Generated URL ── */}
        <Card variant={isReady ? 'elevated' : 'muted'} className="p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12.5px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">{L('생성된 링크', 'Generated link')}</p>
            {isReady && (
              <button
                type="button"
                onClick={handleSaveToHistory}
                className="min-h-[44px] inline-flex items-center py-2 px-1 text-[12px] text-[var(--accent)] hover:underline"
              >
                {L('최근 목록에 저장', 'Save to recent')}
              </button>
            )}
          </div>
          <div className="bg-[var(--bg)] border border-[var(--border-subtle)] rounded-lg p-3 min-h-[56px] flex items-center">
            {isReady ? (
              <code className="text-[12px] text-[var(--text-primary)] break-all font-mono leading-[1.5]">
                {builtUrl}
              </code>
            ) : (
              <p className="text-[13px] text-[var(--text-tertiary)]">
                {!source && L('채널을 선택하세요. ', 'Choose a channel. ')}
                {!campaignSlug && L('캠페인 이름을 입력하세요.', 'Enter a campaign name.')}
              </p>
            )}
          </div>
          {isReady && (
            <div className="mt-3 flex justify-end">
              <CopyButton getText={() => builtUrl} label={L('링크 복사', 'Copy link')} />
            </div>
          )}
        </Card>

        {/* ── History ── */}
        {history.length > 0 && (
          <Card className="p-6 mb-6">
            <p className="text-[12.5px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">{L('최근 저장한 링크', 'Recently saved links')}</p>
            <div className="flex flex-col gap-2">
              {history.map(h => (
                <div
                  key={h.url}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-[var(--bg)] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-[var(--text-primary)] truncate">{h.label}</p>
                    <p className="text-[12.5px] text-[var(--text-tertiary)] truncate font-mono">{h.url}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyHistory(h.url)}
                    className="flex-shrink-0 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-md hover:bg-[var(--border-subtle)] transition-colors"
                    title={L('복사', 'Copy')}
                  >
                    {justCopied === h.url ? (
                      <Check size={14} className="text-[var(--success)]" />
                    ) : (
                      <Copy size={14} className="text-[var(--text-secondary)]" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteHistory(h.url)}
                    className="flex-shrink-0 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-md hover:bg-[var(--danger)]/10 transition-colors"
                    title={L('삭제', 'Delete')}
                  >
                    <Trash2 size={14} className="text-[var(--text-tertiary)] hover:text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── Helper ── */}
        <Card variant="muted" className="p-5">
          <p className="text-[12.5px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">{L('힌트', 'Guide')}</p>
          <ul className="text-[12px] text-[var(--text-secondary)] leading-[1.7] list-disc pl-4 space-y-1">
            <li>{L('Source: 유입 플랫폼 (kakao, threads, linkedin 등)', 'Source: the referring platform (kakao, threads, linkedin, etc.)')}</li>
            <li>{L('Medium: 링크의 형태 (chat, social, community 등)', 'Medium: the channel format (chat, social, community, etc.)')}</li>
            <li>{L('Campaign: 구체적인 목적이나 배포 그룹', 'Campaign: the specific purpose or distribution group')}</li>
            <li>{L('Content: 같은 캠페인 안의 A/B 구분', 'Content: an A/B distinction within one campaign')}</li>
          </ul>
        </Card>

        <p className="text-[12.5px] text-[var(--text-tertiary)] text-center mt-8">
          {L('생성된 링크는 공개 URL이며, UTM 값은 추적용 라벨로만 사용됩니다.', 'Generated links are public URLs. UTM values are tracking labels only.')}
        </p>
      </div>
    </div>
  );
}
