'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Mail, MessageSquare, Send, Hash, Lock, Search, Check, Loader2, Download, Copy as CopyIcon, ExternalLink, Link2,
} from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { useLocale } from '@/hooks/useLocale';
import { useAuth } from '@/lib/auth';
import { getSessionWithTimeout } from '@/lib/supabase';
import { timeoutSignal } from '@/lib/timeout-signal';
import { useSlackStore } from '@/stores/useSlackStore';
import { useTelegramStore } from '@/stores/useTelegramStore';
import { copyToClipboard, composeMailtoLink } from '@/lib/export';
import { ANON_SHARE_LIMIT } from '@/lib/share-limits';
import { track } from '@/lib/analytics';
import { LocaleLink } from '@/components/ui/LocaleLink';

interface ShareComposerProps {
  open: boolean;
  onClose: () => void;
  getText: () => string;
  getTitle: () => string;
  shareContext?: string;
}

type Channel = 'email' | 'slack' | 'telegram' | 'link';

/**
 * Unified "preview → confirm → send" surface for every transmitting channel.
 * The modal body IS the preview; each channel reveals its destination control
 * and a Send button. Copy and Download (.md) are instant, no-confirm actions.
 */
export function ShareComposer({ open, onClose, getText, getTitle, shareContext = 'unknown' }: ShareComposerProps) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  // `user` 는 **진짜 계정**만이다 (익명 세션은 auth.tsx 에서 걸러진다). 링크 만들기는
  // 서버가 익명 JWT 도 받으므로 `session` 으로 판정해야 한다 — 2026-07-29 이전에는
  // `!!user` 로 막아서, 서버가 열려 있는데 화면이 닫혀 있었다. 설정 페이지의 계정
  // 삭제가 정확히 같은 모양으로 틀렸었다(`user` 로 물어서 익명의 서버 사본을 못 지움).
  const { user, session } = useAuth();
  const hasIdentity = !!user || !!session;

  const text = useMemo(() => (open ? getText() : ''), [open, getText]);
  const title = useMemo(() => (open ? getTitle() : ''), [open, getTitle]);

  const [active, setActive] = useState<Channel | null>(null);
  const [sentVia, setSentVia] = useState<Channel | null>(null);
  const [copied, setCopied] = useState(false);

  const slackConnected = useSlackStore((s) => s.isConnected());
  const slackLoaded = useSlackStore((s) => s.loaded);
  const slackLoadError = useSlackStore((s) => s.loadError);
  const slackChannelsError = useSlackStore((s) => s.channelsError);
  const tgConnected = useTelegramStore((s) => s.isConnected());
  const tgLoaded = useTelegramStore((s) => s.loaded);
  const tgLoadError = useTelegramStore((s) => s.loadError);
  const loadTg = useTelegramStore((s) => s.loadConnections);
  const loadSlackConns = useSlackStore((s) => s.loadConnections);

  useEffect(() => {
    if (open) {
      setActive(null);
      setSentVia(null);
      setCopied(false);
      loadTg();
      loadSlackConns();
    }
  }, [open, loadTg, loadSlackConns]);

  const trackShare = (channel: string) => track('output_shared', { channel, context: shareContext });

  const handleCopy = async () => {
    try {
      await copyToClipboard(text);
      setCopied(true);
      trackShare('copy');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (title || 'argus').replace(/[^\w가-힣\- ]+/g, '').trim().slice(0, 60) || 'argus';
    a.href = url;
    a.download = `${safeName}.md`;
    a.click();
    URL.revokeObjectURL(url);
    trackShare('download');
  };

  const channelMeta: Record<Channel, { icon: React.ReactNode; label: string; ready: boolean }> = {
    email: { icon: <Mail size={15} />, label: 'Email', ready: true },
    slack: { icon: <MessageSquare size={15} />, label: 'Slack', ready: slackConnected },
    telegram: { icon: <Send size={15} />, label: 'Telegram', ready: tgConnected },
    link: { icon: <Link2 size={15} />, label: L('링크', 'Link'), ready: hasIdentity },
  };

  if (sentVia) {
    return (
      <Modal open={open} onClose={onClose} title={L('공유', 'Share')}>
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-[var(--collab)] flex items-center justify-center mx-auto mb-3">
            <Check size={24} className="text-[var(--success)]" />
          </div>
          <p className="text-[16px] font-bold text-[var(--text-primary)]">{L('보냈어요', 'Sent')}</p>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">
            {L('보낸 곳: ', 'Sent via: ')}{channelMeta[sentVia].label}
          </p>
          <Button variant="secondary" size="sm" className="mt-5" onClick={onClose}>{L('닫기', 'Done')}</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={L('보내기 — 미리보고 확인', 'Send — preview & confirm')}>
      <div className="space-y-4">
        {/* Preview */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12.5px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">{title || L('미리보기', 'Preview')}</span>
            <div className="flex gap-1.5">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1 text-[12.5px] text-[var(--text-secondary)] hover:text-[var(--accent)] px-2 py-1 rounded-md transition-colors cursor-pointer"
              >
                {copied ? <Check size={12} /> : <CopyIcon size={12} />} {copied ? L('복사됨', 'Copied') : L('복사', 'Copy')}
              </button>
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1 text-[12.5px] text-[var(--text-secondary)] hover:text-[var(--accent)] px-2 py-1 rounded-md transition-colors cursor-pointer"
              >
                <Download size={12} /> .md
              </button>
            </div>
          </div>
          <pre className="bg-[#1a1a2e] text-[#e2e4ea] rounded-xl p-3.5 text-[13px] leading-relaxed overflow-auto max-h-[180px] whitespace-pre-wrap font-mono">
            {text}
          </pre>
        </div>

        {/* Channel chooser */}
        <div>
          <span className="text-[12.5px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">{L('보낼 곳', 'Send to')}</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
            {(Object.keys(channelMeta) as Channel[]).map((ch) => (
              <button
                key={ch}
                onClick={() => setActive(active === ch ? null : ch)}
                // `ready` 는 2026-07-29 까지 계산만 되고 **아무 데서도 읽히지 않았다** —
                // 그래서 `ready: !!user` 를 고쳐도 화면은 그대로였고, 진짜 게이트는
                // LinkPanel 안에 따로 있었다. 만들어놓고 아무도 안 먹는 필드는 다음
                // 사람을 정확히 틀린 줄로 데려간다 (CLAUDE.md F2 소비 계약).
                // 이제 실제로 읽어서 "아직 준비 안 된 곳"을 눌러보기 전에 알려준다.
                // 막지는 않는다 — 눌러야 연결 안내에 닿기 때문이다.
                aria-disabled={!channelMeta[ch].ready}
                title={channelMeta[ch].ready ? undefined : L('아직 준비되지 않았어요 — 눌러서 확인', 'Not ready yet — tap to see why')}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-[13px] font-medium transition-all cursor-pointer ${
                  active === ch
                    ? 'border-[var(--accent)] bg-[var(--ai)] text-[var(--accent)]'
                    : `border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]${channelMeta[ch].ready ? '' : ' opacity-55'}`
                }`}
              >
                {channelMeta[ch].icon}
                {channelMeta[ch].label}
              </button>
            ))}
          </div>
        </div>

        {/* Active channel control */}
        {active === 'email' && (
          <EmailPanel
            user={!!user}
            title={title}
            text={text}
            context={shareContext}
            onSent={() => { trackShare('email'); setSentVia('email'); }}
          />
        )}
        {active === 'slack' && (
          <SlackPanel
            connected={slackConnected}
            loaded={slackLoaded}
            loadError={slackLoadError}
            channelsError={slackChannelsError}
            user={!!user}
            title={title}
            text={text}
            onSent={() => { trackShare('slack'); setSentVia('slack'); }}
          />
        )}
        {active === 'telegram' && (
          <TelegramPanel
            connected={tgConnected}
            loaded={tgLoaded}
            loadError={tgLoadError}
            user={!!user}
            title={title}
            text={text}
            context={shareContext}
            onSent={() => { trackShare('telegram'); setSentVia('telegram'); }}
          />
        )}
        {active === 'link' && (
          <LinkPanel
            hasIdentity={hasIdentity}
            anonymous={!user}
            title={title}
            text={text}
            context={shareContext}
            onCreated={() => trackShare('link')}
          />
        )}
      </div>
    </Modal>
  );
}

/* ── Public link ── */
function LinkPanel({ hasIdentity, anonymous, title, text, context, onCreated }: { hasIdentity: boolean; anonymous: boolean; title: string; text: string; context: string; onCreated: () => void }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // 신원이 아예 없는 순간(분석 전)에만 남는 상태. 익명 신원은 분석이 끝나면 발급되므로,
  // 실제로 보여줄 결과물이 있는 사람은 거의 여기 오지 않는다.
  if (!hasIdentity) {
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] p-3.5 animate-fade-in">
        <p className="text-[12px] text-[var(--text-secondary)] mb-2">
          {L('잠깐만요 — 아직 준비 중이에요. 잠시 후 다시 열어 주세요.',
             'One moment — still getting ready. Please reopen this shortly.')}
        </p>
        <LocaleLink href="/login" className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--accent)] hover:underline">
          {L('로그인', 'Log in')} <ExternalLink size={12} />
        </LocaleLink>
      </div>
    );
  }

  const create = async () => {
    setError('');
    setBusy(true);
    try {
      const session = await getSessionWithTimeout(); // 4s cap — never wedge the share button on a hung auth call
      const token = session?.access_token;
      if (!token) { setError(L('인증이 필요해요.', 'Authentication required.')); return; }
      const res = await fetch('/api/share/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, content: text, context }),
        signal: timeoutSignal(),
      });
      const json = await res.json();
      if (json.ok && json.path) {
        setUrl(`${window.location.origin}${json.path}`);
        onCreated();
      } else setError(L('링크를 만들다 막혔어요 — 내용은 그대로 있어요. 다시 시도해 주세요.', 'Hit a snag creating the link — your content is safe. Please try again.'));
    } catch {
      setError(L('링크를 만들다 막혔어요 — 내용은 그대로 있어요. 다시 시도해 주세요.', 'Hit a snag creating the link — your content is safe. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    await copyToClipboard(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] p-3.5 space-y-2.5 animate-fade-in">
      {error && <p className="text-[12px] text-[var(--danger)]">{error}</p>}
      {url ? (
        <>
          <p className="text-[13px] text-[var(--text-secondary)]">{L('누구나 이 링크로 결과를 열어볼 수 있어요.', 'Anyone with this link can open the result.')}</p>
          <div className="flex items-center gap-2">
            <input readOnly value={url} className="flex-1 text-[12px] font-mono bg-[var(--bg)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-2 text-[var(--text-primary)]" onFocus={(e) => e.currentTarget.select()} />
            <Button variant="secondary" size="sm" onClick={copy}>
              {copied ? <Check size={13} /> : <CopyIcon size={13} />}
            </Button>
          </div>
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] text-[var(--text-tertiary)] hover:text-[var(--accent)]">
            {L('새 탭에서 열기', 'Open in new tab')} <ExternalLink size={11} />
          </a>
          {/* 링크를 손에 쥔 직후가 유일하게 "지킬 값어치가 있다"고 느끼는 순간이다.
              고지를 먼저 하고 문을 연다 — 순서를 바꾸면 그냥 광고가 된다. */}
          {anonymous && (
            <div className="pt-1 border-t border-[var(--border-subtle)] space-y-1.5">
              <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">
                {L('이 링크를 거두거나 다시 찾는 건 지금 이 브라우저에서만 돼요. 브라우저를 비우거나 한동안 안 오시면 링크도 같이 사라져요.',
                   'Revoking or finding this link again only works from this browser. If you clear it or stay away a while, the link goes with it.')}
              </p>
              <LocaleLink href="/login" className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--accent)] hover:underline">
                {L('로그인하고 이 링크 계속 관리하기', 'Sign in to keep managing this link')} <ExternalLink size={12} />
              </LocaleLink>
            </div>
          )}
        </>
      ) : (
        <>
          <Button size="sm" onClick={create} disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
            {L('공개 링크 만들기', 'Create public link')}
          </Button>
          {anonymous && (
            <p className="text-[12px] text-[var(--text-tertiary)]">
              {L(`로그인 없이도 만들 수 있어요 (하루 ${ANON_SHARE_LIMIT}개).`,
                 `You can make one without an account (${ANON_SHARE_LIMIT} a day).`)}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/* ── Email ── */
function EmailPanel({ user, title, text, context, onSent }: { user: boolean; title: string; text: string; context: string; onSent: () => void }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!user) {
    // Not logged in → fall back to the local mail client (truncated, one-way).
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] p-3.5 space-y-2 animate-fade-in">
        <p className="text-[12px] text-[var(--text-secondary)]">
          {L('로그인하면 받는 사람 주소로 전체 문서를 바로 보내요. 지금은 메일 앱으로 열어요(일부만 담겨요).',
             'Log in to send the full document straight to a recipient. For now this opens your mail app (partial content).')}
        </p>
        <Button variant="secondary" size="sm" onClick={() => { window.open(composeMailtoLink(title, text), '_self'); onSent(); }}>
          <Mail size={14} /> {L('메일 앱으로 열기', 'Open mail app')}
        </Button>
      </div>
    );
  }

  const send = async () => {
    setError('');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) { setError(L('올바른 이메일 주소를 입력해주세요.', 'Enter a valid email address.')); return; }
    setBusy(true);
    try {
      const session = await getSessionWithTimeout(); // 4s cap — never wedge the send button on a hung auth call
      const token = session?.access_token;
      if (!token) { setError(L('인증이 필요해요.', 'Authentication required.')); return; }
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to, title, content: text, context }),
        signal: timeoutSignal(),
      });
      const json = await res.json();
      if (json.ok) onSent();
      else setError(L('전송이 닿지 못했어요 — 다시 시도해 주세요.', "The send didn't land — please try again."));
    } catch {
      setError(L('전송이 닿지 못했어요 — 다시 시도해 주세요.', "The send didn't land — please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] p-3.5 space-y-2.5 animate-fade-in">
      <input
        type="email"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder={L('받는 사람 이메일', 'Recipient email')}
        maxLength={200}
        className="w-full bg-[var(--bg)] border-[1.5px] border-[var(--border)] rounded-[10px] px-3 py-2 text-[14px] focus:outline-none focus:border-[var(--accent)]"
      />
      {error && <p className="text-[12px] text-[var(--danger)]">{error}</p>}
      <Button size="sm" onClick={send} disabled={busy}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        {L('이 내용으로 보내기', 'Send this')}
      </Button>
    </div>
  );
}

/* ── Slack ── */
function SlackPanel({ connected, loaded, loadError, channelsError, user, title, text, onSent }: { connected: boolean; loaded: boolean; loadError: boolean; channelsError: boolean; user: boolean; title: string; text: string; onSent: () => void }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const { channels, channelsLoading, sending, loadChannels, sendToSlack } = useSlackStore();
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { if (connected) loadChannels(); }, [connected, loadChannels]);

  // 3-state in order (same fix as Telegram): anon → login, in-flight → spinner,
  // loaded-empty → connect hint. Prevents a false "not connected" flash.
  if (!user) {
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] p-3.5 animate-fade-in">
        <p className="text-[12px] text-[var(--text-secondary)] mb-2">
          {L('로그인하면 연결해 둔 Slack으로 바로 보낼 수 있어요.', 'Log in to send to your connected Slack.')}
        </p>
        <LocaleLink href="/login" className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--accent)] hover:underline">
          {L('로그인', 'Log in')} <ExternalLink size={12} />
        </LocaleLink>
      </div>
    );
  }
  if (!loaded) {
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] p-3.5 flex items-center gap-2 animate-fade-in">
        <Loader2 size={14} className="animate-spin text-[var(--text-tertiary)]" />
        <span className="text-[12px] text-[var(--text-tertiary)]">{L('연결 확인 중…', 'Checking connection…')}</span>
      </div>
    );
  }
  if (loadError) {
    return <ConnectionLoadError L={L} />;
  }
  if (!connected) return <ConnectHint L={L} />;

  const filtered = channels.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
  const send = async (channelId: string) => {
    setError('');
    const r = await sendToSlack(channelId, title, text);
    if (r.ok) onSent(); else setError(L('전송이 닿지 못했어요 — 다시 시도해 주세요.', "The send didn't land — please try again."));
  };

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] p-3 space-y-2 animate-fade-in">
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={L('채널 검색', 'Search channels')}
          maxLength={100}
          className="w-full pl-8 pr-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg)] text-[13px] focus:outline-none focus:border-[var(--accent)]"
        />
      </div>
      {error && <p className="text-[12px] text-[var(--danger)]">{error}</p>}
      {channelsError && <p className="text-[12px] text-[var(--danger)]">{L('Slack 채널을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.', 'Could not load Slack channels. Please reopen this shortly.')}</p>}
      <div className="max-h-[180px] overflow-y-auto">
        {channelsLoading ? (
          <div className="flex justify-center py-5"><Loader2 size={18} className="animate-spin text-[var(--text-tertiary)]" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-[12px] text-[var(--text-tertiary)] py-5">{L('채널이 없어요', 'No channels')}</p>
        ) : (
          filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => send(c.id)}
              disabled={sending}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-[var(--bg)] transition-colors cursor-pointer text-left disabled:opacity-50"
            >
              {c.is_private ? <Lock size={13} className="text-[var(--text-tertiary)]" /> : <Hash size={13} className="text-[var(--text-tertiary)]" />}
              <span className="text-[13px] text-[var(--text-primary)] truncate">{c.name}</span>
              {sending && <Loader2 size={13} className="animate-spin text-[var(--text-tertiary)] ml-auto" />}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

/* ── Telegram ── */
function TelegramPanel({ connected, loaded, loadError, user, title, text, context, onSent }: { connected: boolean; loaded: boolean; loadError: boolean; user: boolean; title: string; text: string; context: string; onSent: () => void }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const { connections, sending, sendToTelegram } = useTelegramStore();
  const [error, setError] = useState('');

  // 3-state, in order — the old binary (connected?) showed "아직 연결되지 않았어요"
  // both while the query was still in flight AND to anonymous users who can't even
  // have a connection, so a genuinely-connected user hit a false "not connected".
  if (!user) {
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] p-3.5 animate-fade-in">
        <p className="text-[12px] text-[var(--text-secondary)] mb-2">
          {L('로그인하면 연결해 둔 Telegram으로 바로 보낼 수 있어요.',
             'Log in to send to your connected Telegram.')}
        </p>
        <LocaleLink href="/login" className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--accent)] hover:underline">
          {L('로그인', 'Log in')} <ExternalLink size={12} />
        </LocaleLink>
      </div>
    );
  }
  if (!loaded) {
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] p-3.5 flex items-center gap-2 animate-fade-in">
        <Loader2 size={14} className="animate-spin text-[var(--text-tertiary)]" />
        <span className="text-[12px] text-[var(--text-tertiary)]">{L('연결 확인 중…', 'Checking connection…')}</span>
      </div>
    );
  }
  if (loadError) {
    return <ConnectionLoadError L={L} />;
  }
  if (!connected) return <ConnectHint L={L} />;

  const send = async (chatId: string) => {
    setError('');
    const r = await sendToTelegram(title, text, { chatId, context });
    if (r.ok) onSent(); else setError(L('전송이 닿지 못했어요 — 다시 시도해 주세요.', "The send didn't land — please try again."));
  };

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] p-3 space-y-2 animate-fade-in">
      {error && <p className="text-[12px] text-[var(--danger)]">{error}</p>}
      {connections.map((c) => (
        <button
          key={c.id}
          onClick={() => send(c.chat_id)}
          disabled={sending}
          className="w-full flex items-center gap-2 px-2.5 py-2.5 rounded-lg border border-[var(--border-subtle)] hover:border-[var(--accent)] transition-colors cursor-pointer text-left disabled:opacity-50"
        >
          <Send size={14} className="text-[var(--accent)]" />
          <span className="text-[13px] text-[var(--text-primary)] truncate">{c.chat_title || L('내 Telegram', 'My Telegram')}</span>
          {sending ? <Loader2 size={13} className="animate-spin text-[var(--text-tertiary)] ml-auto" /> : <span className="text-[12.5px] text-[var(--text-tertiary)] ml-auto">{L('보내기', 'Send')}</span>}
        </button>
      ))}
    </div>
  );
}

function ConnectHint({ L }: { L: (ko: string, en: string) => string }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] p-3.5 animate-fade-in">
      <p className="text-[12px] text-[var(--text-secondary)] mb-2">
        {L('아직 연결되지 않았어요. 설정에서 연결하면 여기서 바로 보낼 수 있어요.',
           'Not connected yet. Connect in settings to send from here.')}
      </p>
      <LocaleLink href="/settings" className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--accent)] hover:underline">
        {L('설정에서 연결하기', 'Connect in settings')} <ExternalLink size={12} />
      </LocaleLink>
    </div>
  );
}

function ConnectionLoadError({ L }: { L: (ko: string, en: string) => string }) {
  return (
    <div className="rounded-xl border border-[var(--danger)]/25 bg-[var(--danger)]/5 p-3.5 animate-fade-in">
      <p className="text-[12px] text-[var(--danger)]">
        {L('연결 상태를 불러오지 못했습니다. 잠시 후 다시 열어 주세요.', 'Could not load the connection status. Please reopen this shortly.')}
      </p>
    </div>
  );
}
