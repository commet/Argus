'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Card } from '@/components/ui/Card';
import { CopyButton } from '@/components/ui/CopyButton';
import { Link2, Copy, Trash2, Check } from 'lucide-react';
import { LocaleLink } from '@/components/ui/LocaleLink';

type Preset = {
  id: string;
  label: string;
  source: string;
  medium: string;
};

const PRESETS: Preset[] = [
  { id: 'kakao', label: '카카오톡 톡방', source: 'kakao', medium: 'chat' },
  { id: 'threads', label: 'Threads', source: 'threads', medium: 'social' },
  { id: 'instagram', label: 'Instagram (스토리/포스트)', source: 'instagram', medium: 'social' },
  { id: 'linkedin', label: 'LinkedIn', source: 'linkedin', medium: 'social' },
  { id: 'x', label: 'X (Twitter)', source: 'x', medium: 'social' },
  { id: 'discord', label: 'Discord', source: 'discord', medium: 'community' },
  { id: 'facebook', label: '페이스북 그룹', source: 'facebook', medium: 'community' },
  { id: 'reddit', label: 'Reddit', source: 'reddit', medium: 'community' },
  { id: 'blog', label: '블로그 글', source: 'blog', medium: 'article' },
  { id: 'email', label: '이메일 뉴스레터', source: 'email', medium: 'newsletter' },
  { id: 'youtube', label: '유튜브 설명란', source: 'youtube', medium: 'video' },
  { id: 'custom', label: '직접 입력', source: '', medium: '' },
];

const PATHS = [
  { value: '/', label: '홈 (/)' },
  { value: '/demo', label: '데모 (/demo)' },
  { value: '/workspace', label: 'Workspace (/workspace)' },
  { value: '/boss', label: 'Boss 시뮬레이터 (/boss)' },
  { value: '/agents', label: '에이전트 (/agents)' },
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
    const url = new URL(BASE_URL + path);
    url.searchParams.set('utm_source', source);
    if (medium) url.searchParams.set('utm_medium', medium);
    if (campaignSlug) url.searchParams.set('utm_campaign', campaignSlug);
    if (contentSlug) url.searchParams.set('utm_content', contentSlug);
    return url.toString();
  }, [path, source, medium, campaignSlug, contentSlug]);

  const isReady = !!source && !!campaignSlug;

  const handleSaveToHistory = () => {
    if (!isReady || !builtUrl) return;
    const label = `${preset.label}${campaign ? ' · ' + campaign : ''}${content ? ' / ' + content : ''}`;
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
    return <div className="min-h-screen flex items-center justify-center text-[var(--text-tertiary)]">Loading…</div>;
  }
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 max-w-sm">
          <p className="text-[14px] text-[var(--text-secondary)]">로그인이 필요합니다.</p>
          <LocaleLink href="/login" className="mt-4 inline-block text-[13px] text-[var(--accent)] underline">로그인 하러 가기</LocaleLink>
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
            <h1 className="text-[22px] font-bold text-[var(--text-primary)]">UTM 링크 빌더</h1>
          </div>
          <p className="text-[13px] text-[var(--text-secondary)] leading-[1.6]">
            공유하는 채널마다 다른 링크를 찍어주면 데일리 리포트의 <strong>유입 소스·캠페인</strong>별로 추적됩니다.
            <br />
            예: 카톡 A방용 / 카톡 B방용 / Threads용 — 각기 다른 URL로 만들어 뿌리세요.
          </p>
        </header>

        {/* ── Builder form ── */}
        <Card className="p-6 mb-6">
          <div className="flex flex-col gap-5">
            {/* Channel */}
            <div>
              <label className="block text-[13px] font-semibold text-[var(--text-primary)] mb-2">채널</label>
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
                    {p.label}
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
                    placeholder="예: ponderly, hn"
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-[14px]"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-[var(--text-primary)] mb-1.5">Medium</label>
                  <input
                    type="text"
                    value={customMedium}
                    onChange={e => setCustomMedium(e.target.value)}
                    placeholder="예: newsletter, forum"
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-[14px]"
                  />
                </div>
              </div>
            )}

            {/* Campaign (required) */}
            <div>
              <label className="block text-[13px] font-semibold text-[var(--text-primary)] mb-1.5">
                캠페인 이름 <span className="text-[var(--accent)]">*</span>
              </label>
              <input
                type="text"
                value={campaign}
                onChange={e => setCampaign(e.target.value)}
                placeholder="예: vibecoding_kr, launch_april, designer_cafe"
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-[14px]"
              />
              <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
                리포트에서 이 값으로 그룹핑됩니다. 톡방마다 다르게 짓는 걸 추천.
              </p>
            </div>

            {/* Content (optional) */}
            <div>
              <label className="block text-[13px] font-semibold text-[var(--text-primary)] mb-1.5">
                콘텐츠 <span className="text-[var(--text-tertiary)] font-normal">(선택)</span>
              </label>
              <input
                type="text"
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="예: first_share, pinned_msg, v2"
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-[14px]"
              />
              <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
                같은 캠페인 내에서 A/B 구분이 필요할 때.
              </p>
            </div>

            {/* Destination */}
            <div>
              <label className="block text-[13px] font-semibold text-[var(--text-primary)] mb-1.5">랜딩 페이지</label>
              <select
                value={path}
                onChange={e => setPath(e.target.value)}
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-[14px]"
              >
                {PATHS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
        </Card>

        {/* ── Generated URL ── */}
        <Card variant={isReady ? 'elevated' : 'muted'} className="p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">생성된 링크</p>
            {isReady && (
              <button
                type="button"
                onClick={handleSaveToHistory}
                className="min-h-[44px] inline-flex items-center py-2 px-1 text-[12px] text-[var(--accent)] hover:underline"
              >
                최근 목록에 저장
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
                {!source && '채널을 선택하세요. '}
                {!campaignSlug && '캠페인 이름을 입력하세요.'}
              </p>
            )}
          </div>
          {isReady && (
            <div className="mt-3 flex justify-end">
              <CopyButton getText={() => builtUrl} label="링크 복사" />
            </div>
          )}
        </Card>

        {/* ── History ── */}
        {history.length > 0 && (
          <Card className="p-6 mb-6">
            <p className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">최근 저장한 링크</p>
            <div className="flex flex-col gap-2">
              {history.map(h => (
                <div
                  key={h.url}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-[var(--bg)] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-[var(--text-primary)] truncate">{h.label}</p>
                    <p className="text-[11px] text-[var(--text-tertiary)] truncate font-mono">{h.url}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyHistory(h.url)}
                    className="flex-shrink-0 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-md hover:bg-[var(--border-subtle)] transition-colors"
                    title="복사"
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
                    title="삭제"
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
          <p className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">힌트</p>
          <ul className="text-[12px] text-[var(--text-secondary)] leading-[1.7] list-disc pl-4 space-y-1">
            <li><strong>Source</strong>: 어느 플랫폼? (kakao, threads, linkedin …)</li>
            <li><strong>Medium</strong>: 형태? (chat, social, community, newsletter …)</li>
            <li><strong>Campaign</strong>: 구체적 목적/그룹. 톡방 이름이나 런치 이벤트명을 권장 (예: <code>vibecoding_foocafe</code>)</li>
            <li><strong>Content</strong>: 같은 캠페인 내 A/B 구분이 필요할 때만 (예: pinned vs reply)</li>
            <li>공유 시 URL이 길어 보이면 <a href="https://bit.ly" target="_blank" rel="noopener" className="underline">bit.ly</a> 같은 단축기도 OK — UTM은 리다이렉트 후에도 유지됨</li>
          </ul>
        </Card>

        <p className="text-[11px] text-[var(--text-tertiary)] text-center mt-8">
          생성된 링크는 공개 URL입니다. UTM 파라미터는 기능 변경 없이 추적용 라벨만 붙입니다.
        </p>
      </div>
    </div>
  );
}
