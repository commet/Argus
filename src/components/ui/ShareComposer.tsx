'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Mail, MessageSquare, Send, Hash, Lock, Search, Check, Loader2, Download, Copy as CopyIcon, ExternalLink, Link2,
} from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { useLocale } from '@/hooks/useLocale';
import { useAuth } from '@/lib/auth';
import { getSessionWithTimeout } from '@/lib/supabase';
import { useSlackStore } from '@/stores/useSlackStore';
import { useTelegramStore } from '@/stores/useTelegramStore';
import { copyToClipboard, composeMailtoLink } from '@/lib/export';
import { track } from '@/lib/analytics';

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
  const { user } = useAuth();

  const text = useMemo(() => (open ? getText() : ''), [open, getText]);
  const title = useMemo(() => (open ? getTitle() : ''), [open, getTitle]);

  const [active, setActive] = useState<Channel | null>(null);
  const [sentVia, setSentVia] = useState<Channel | null>(null);
  const [copied, setCopied] = useState(false);

  const slackConnected = useSlackStore((s) => s.isConnected());
  const slackLoaded = useSlackStore((s) => s.loaded);
  const tgConnected = useTelegramStore((s) => s.isConnected());
  const tgLoaded = useTelegramStore((s) => s.loaded);
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
    link: { icon: <Link2 size={15} />, label: L('링크', 'Link'), ready: !!user },
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
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">{title || L('미리보기', 'Preview')}</span>
            <div className="flex gap-1.5">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--accent)] px-2 py-1 rounded-md transition-colors cursor-pointer"
              >
                {copied ? <Check size={12} /> : <CopyIcon size={12} />} {copied ? L('복사됨', 'Copied') : L('복사', 'Copy')}
              </button>
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--accent)] px-2 py-1 rounded-md transition-colors cursor-pointer"
              >
                <Download size={12} /> .md
              </button>
            </div>
          </div>
          <pre className="bg-[#1a1a2e] text-[#e2e4ea] rounded-xl p-3.5 text-[11.5px] leading-relaxed overflow-auto max-h-[180px] whitespace-pre-wrap font-mono">
            {text}
          </pre>
        </div>

        {/* Channel chooser */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">{L('보낼 곳', 'Send to')}</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
            {(Object.keys(channelMeta) as Channel[]).map((ch) => (
              <button
                key={ch}
                onClick={() => setActive(active === ch ? null : ch)}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-[13px] font-medium transition-all cursor-pointer ${
                  active === ch
                    ? 'border-[var(--accent)] bg-[var(--ai)] text-[var(--accent)]'
                    : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]'
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
            user={!!user}
            title={title}
            text={text}
            context={shareContext}
            onSent={() => { trackShare('telegram'); setSentVia('telegram'); }}
          />
        )}
        {active === 'link' && (
          <LinkPanel user={!!user} title={title} text={text} context={shareContext} onCreated={() => trackShare('link')} />
        )}
      </div>
    </Modal>
  );
}

/* ── Public link ── */
function LinkPanel({ user, title, text, context, onCreated }: { user: boolean; title: string; text: string; context: string; onCreated: () => void }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  if (!user) {
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] p-3.5 animate-fade-in">
        <p className="text-[12px] text-[var(--text-secondary)] mb-2">
          {L('로그인하면 계정 없이도 누구나 열 수 있는 공개 링크를 만들 수 있어요.',
             'Log in to mint a public link anyone can open — no account needed.')}
        </p>
        <Link href="/login" className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--accent)] hover:underline">
          {L('로그인', 'Log in')} <ExternalLink size={12} />
        </Link>
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
      });
      const json = await res.json();
      if (json.ok && json.path) {
        setUrl(`${window.location.origin}${json.path}`);
        onCreated();
      } else setError(json.error || L('링크 생성 실패', 'Could not create link'));
    } catch {
      setError(L('링크 생성 실패', 'Could not create link'));
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
      {error && <p className="text-[12px] text-red-600">{error}</p>}
      {url ? (
        <>
          <p className="text-[11.5px] text-[var(--text-secondary)]">{L('누구나 이 링크로 결과를 열어볼 수 있어요.', 'Anyone with this link can open the result.')}</p>
          <div className="flex items-center gap-2">
            <input readOnly value={url} className="flex-1 text-[12px] font-mono bg-[var(--bg)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-2 text-[var(--text-primary)]" onFocus={(e) => e.currentTarget.select()} />
            <Button variant="secondary" size="sm" onClick={copy}>
              {copied ? <Check size={13} /> : <CopyIcon size={13} />}
            </Button>
          </div>
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11.5px] text-[var(--text-tertiary)] hover:text-[var(--accent)]">
            {L('새 탭에서 열기', 'Open in new tab')} <ExternalLink size={11} />
          </a>
        </>
      ) : (
        <Button size="sm" onClick={create} disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
          {L('공개 링크 만들기', 'Create public link')}
        </Button>
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
      });
      const json = await res.json();
      if (json.ok) onSent();
      else setError(json.error || L('전송에 실패했어요.', 'Failed to send.'));
    } catch {
      setError(L('전송에 실패했어요.', 'Failed to send.'));
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
      {error && <p className="text-[12px] text-red-600">{error}</p>}
      <Button size="sm" onClick={send} disabled={busy}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        {L('이 내용으로 보내기', 'Send this')}
      </Button>
    </div>
  );
}

/* ── Slack ── */
function SlackPanel({ connected, loaded, user, title, text, onSent }: { connected: boolean; loaded: boolean; user: boolean; title: string; text: string; onSent: () => void }) {
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
        <Link href="/login" className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--accent)] hover:underline">
          {L('로그인', 'Log in')} <ExternalLink size={12} />
        </Link>
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
  if (!connected) return <ConnectHint L={L} />;

  const filtered = channels.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
  const send = async (channelId: string) => {
    setError('');
    const r = await sendToSlack(channelId, title, text);
    if (r.ok) onSent(); else setError(r.error || L('전송 실패', 'Send failed'));
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
      {error && <p className="text-[12px] text-red-600">{error}</p>}
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
function TelegramPanel({ connected, loaded, user, title, text, context, onSent }: { connected: boolean; loaded: boolean; user: boolean; title: string; text: string; context: string; onSent: () => void }) {
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
        <Link href="/login" className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--accent)] hover:underline">
          {L('로그인', 'Log in')} <ExternalLink size={12} />
        </Link>
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
  if (!connected) return <ConnectHint L={L} />;

  const send = async (chatId: string) => {
    setError('');
    const r = await sendToTelegram(title, text, { chatId, context });
    if (r.ok) onSent(); else setError(r.error || L('전송 실패', 'Send failed'));
  };

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] p-3 space-y-2 animate-fade-in">
      {error && <p className="text-[12px] text-red-600">{error}</p>}
      {connections.map((c) => (
        <button
          key={c.id}
          onClick={() => send(c.chat_id)}
          disabled={sending}
          className="w-full flex items-center gap-2 px-2.5 py-2.5 rounded-lg border border-[var(--border-subtle)] hover:border-[var(--accent)] transition-colors cursor-pointer text-left disabled:opacity-50"
        >
          <Send size={14} className="text-[var(--accent)]" />
          <span className="text-[13px] text-[var(--text-primary)] truncate">{c.chat_title || L('내 Telegram', 'My Telegram')}</span>
          {sending ? <Loader2 size={13} className="animate-spin text-[var(--text-tertiary)] ml-auto" /> : <span className="text-[11px] text-[var(--text-tertiary)] ml-auto">{L('보내기', 'Send')}</span>}
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
      <Link href="/settings" className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--accent)] hover:underline">
        {L('설정에서 연결하기', 'Connect in settings')} <ExternalLink size={12} />
      </Link>
    </div>
  );
}
