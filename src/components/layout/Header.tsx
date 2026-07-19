'use client';

import { LocaleLink } from '@/components/ui/LocaleLink';
import { Logo } from '@/components/brand/Logo';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, LogOut, Sun, Moon, Lock, MoreHorizontal, Download, Users, BookOpen, BarChart3, UserCheck, Search, Compass, FolderKanban, Settings2, Waves } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useDueCount } from '@/hooks/useDueCount';
import { RateLimitBadge } from '@/components/ui/RateLimitBadge';
import { SyncStatus } from '@/components/ui/SyncStatus';
import { StorageErrorToast } from '@/components/ui/StorageErrorToast';
import { SessionExpiredToast } from '@/components/ui/SessionExpiredToast';
import { Toast } from '@/components/ui/Toast';
import { useLocaleSwitch } from '@/hooks/useLocaleSwitch';
import { stripLocale } from '@/lib/locale-path';
import { CommandPalette, type CommandPaletteItem } from '@/components/ui/CommandPalette';
import { clientE3BReleaseDecision } from '@/lib/epistemic/e3b-release-gate';

export function Header() {
  const { locale, switchTo: handleLocaleChange } = useLocaleSwitch();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;

  // W1.3 단일 진입: first-line nav is [워크스페이스·프로젝트·설정·가이드].
  // /agents·/boss routes are NOT deleted — they're reachable from
  // inside the workspace (crew-roster row), just no longer top-level doors.
  // /guide was promoted out of the overflow (창업자 2026-07-19): a first-run
  // user needs the manual where they can see it, next to Settings.
  // /project is PUBLIC (public-paths.ts) and localStorage-first — it shows the user's
  // own (anon-included) decisions and the due-return strip. It must NOT wear a 🔒:
  // the seal promises anon users a dated return there, so a lock next to the due badge
  // told the exact cohort we courted that their own decision was off-limits (they never
  // clicked, the loop never closed). Login is nudged for SYNC at the seal, not here.
  const navItems: Array<{ href: string; label: string; primary?: boolean; requiresAuth?: boolean }> = [
    { href: '/workspace', label: L('워크스페이스', 'Workspace'), primary: true },
    { href: '/project', label: L('프로젝트', 'Projects') },
    { href: '/settings', label: L('설정', 'Settings') },
    { href: '/guide', label: L('가이드', 'Guide') },
  ];

  const pathname = stripLocale(usePathname());
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  // Secondary tools that used to live in the (mostly empty) 224px sidebar —
  // the aside is gone (H1-C4), so they move into an overflow menu here. Operator
  // status comes from the server-controlled `app_metadata.is_operator` claim
  // (set on the operator accounts in Supabase) — never a hard-coded email list,
  // which would ship the operators' addresses in the public client bundle. The
  // /admin page enforces the real gate server-side via the argus_metrics RPC;
  // this flag only decides whether to surface the menu link.
  const isOperator = user?.app_metadata?.is_operator === true;
  const e3bReleased = clientE3BReleaseDecision().open;
  // Overflow menu, one hierarchy (창업자 2026-07-19): everyday tools first,
  // then a separated operator section. Every item carries a one-line desc —
  // shown in the menu AND reused verbatim by the command palette, so the two
  // surfaces can't drift. Names say what the page does: /boss is a rehearsal,
  // not a "설정" screen; /admin is operator metrics, not a cockpit.
  const utilityItems: Array<{ href: string; label: string; desc: string; icon: typeof Download; section: 'tools' | 'operator' }> = [
    { href: '/teams', label: L('사람 팀', 'People teams'), desc: L('결정을 공유하고 함께 검토할 사람을 초대합니다.', 'Invite people to review shared decisions.'), icon: Users, section: 'tools' },
    // /boss moved here from the workspace idle chips (P0-7) — the route lives on,
    // only the extra doorway on the landing was removed.
    { href: '/boss', label: L('팀장 시뮬레이터', 'Boss Simulator'), desc: L('실제 1:1 전에 팀장의 반응과 다음 질문을 미리 연습합니다.', "Rehearse a manager's response and follow-up questions before a real 1:1."), icon: UserCheck, section: 'tools' },
    { href: '/import', label: L('기록 가져오기', 'Import records'), desc: L('터미널·MCP에서 기록한 결정을 이 계정으로 모읍니다.', 'Gather decisions recorded in the terminal or MCP here.'), icon: Download, section: 'tools' },
    ...(e3bReleased ? [{ href: '/patterns', label: 'Patterns', desc: L('근거와 반례를 검토하고 AI 영향 권한을 관리합니다.', 'Review evidence and manage AI influence grants.'), icon: Waves, section: 'operator' as const }] : []),
    ...(isOperator ? [{ href: '/admin', label: L('운영 현황', 'Operations'), desc: L('가입부터 결과 기록까지의 흐름을 확인합니다.', 'See the flow from sign-up to recorded results.'), icon: BarChart3, section: 'operator' as const }] : []),
  ];

  const commandItems: CommandPaletteItem[] = [
    {
      href: '/workspace',
      label: L('워크스페이스', 'Workspace'),
      description: L('새 결정을 시작하거나 진행 중인 작업으로 돌아갑니다.', 'Start a decision or return to work in progress.'),
      group: L('핵심', 'Core'),
      keywords: ['decision', 'voyage', '결정', '항해'],
      icon: Compass,
    },
    {
      href: '/project',
      label: L('프로젝트', 'Projects'),
      description: L('결정 기록, 체크인, 결과를 한곳에서 봅니다.', 'Review decision records, check-ins, and outcomes.'),
      group: L('핵심', 'Core'),
      keywords: ['history', 'logbook', '기록', '체크인'],
      icon: FolderKanban,
    },
    {
      href: '/settings',
      label: L('설정', 'Settings'),
      description: L('모델, 언어, 연결과 데이터 환경을 조정합니다.', 'Adjust models, language, connections, and data.'),
      group: L('환경', 'System'),
      keywords: ['preferences', 'model', '환경', '모델'],
      icon: Settings2,
    },
    {
      href: '/guide',
      label: L('가이드', 'Guide'),
      description: L('Argus의 흐름과 주요 기능을 빠르게 익힙니다.', 'Learn the Argus flow and its main features.'),
      group: L('환경', 'System'),
      keywords: ['help', 'manual', '도움말', '사용법'],
      icon: BookOpen,
    },
    // Single source: the overflow menu's desc doubles as the palette description.
    ...utilityItems.map((item) => ({
      href: item.href,
      label: item.label,
      icon: item.icon,
      description: item.desc,
      group: item.section === 'operator' ? L('운영', 'Operate') : L('도구', 'Tools'),
      keywords: [],
    })),
  ];

  // Return badge — projects whose contract check-in is due + review receipts
  // past check-by, one number via the shared hook (P0-6 ④ — Header, /project
  // and the workspace lantern all read useDueCount so they can never drift).
  const { dueCount } = useDueCount();
  // The return home is ONE house (P0-6 ①): /project hosts settlement AND shows
  // the review dues as chips routing to /tools/review. The old branch sent
  // review-only dues to a different page, splitting the harbor in two.
  const dueTarget = '/project';

  // Landing page renders its own minimal header (LandingHeader). This bail
  // exists because <Header /> is rendered globally from layout.tsx; the
  // alternative — moving header rendering into LayoutShell — would couple
  // landing-vs-app routing to a single component without changing the
  // visual divergence here, so we keep the bail until both headers share
  // primitive components worth lifting.
  const isLanding = pathname === '/';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleGlobalKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandPaletteOpen((open) => !open);
      }
      if (event.key === 'Escape') {
        setMoreMenuOpen(false);
        setUserMenuOpen(false);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleGlobalKey);
    return () => document.removeEventListener('keydown', handleGlobalKey);
  }, []);

  // Close the overflow menu on outside click (same pattern as the user menu).
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Theme sync. The pre-paint script in layout.tsx already resolved the theme
  // (route- and OS-aware, option C) — reflect that here and keep tabs in sync.
  useEffect(() => {
    const apply = (dark: boolean) => {
      setDarkMode(dark);
      if (dark) document.documentElement.setAttribute('data-theme', 'dark');
      else document.documentElement.removeAttribute('data-theme');
    };
    // Mirror what the pre-paint script decided (don't recompute the route default).
    setDarkMode(document.documentElement.getAttribute('data-theme') === 'dark');

    const resolve = (v: string): boolean =>
      v === 'dark' ? true
      : v === 'light' ? false
      : v === 'system' ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : document.documentElement.getAttribute('data-theme') === 'dark';
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== 'argus-theme') return;
      apply(resolve(e.newValue || ''));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Header quick-toggle is binary (light ↔ dark) and writes an explicit choice,
  // which then wins on every surface. "System" is offered in Settings.
  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (next) document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('argus-theme', next ? 'dark' : 'light');
  };

  // Close user menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    await signOut();
    router.push(`/${locale}/login`);
  };

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';
  const avatarUrl = user?.user_metadata?.avatar_url;

  // Landing renders LandingHeader instead — keep app chrome out of the marketing
  // canvas. The /design/* showcase pages carry their own headers too.
  if (isLanding || pathname.startsWith('/design')) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[var(--bg)]/92 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="h-16 flex items-center justify-between">
          <Logo size="md" href="/" />

          <div className="hidden md:flex items-center gap-3">
            {/* Desktop nav */}
            <nav className="flex items-center gap-0.5 bg-[var(--surface)] rounded-full px-1.5 py-1 border border-[var(--border-subtle)] shadow-[var(--shadow-xs)]">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const showReturnBadge = item.href === '/project' && dueCount > 0;
                // Don't padlock the door the return badge is inviting them through:
                // /project renders for anon from localStorage, so on a return day the
                // lock ("Requires sign-in") contradicts the gold "decision to revisit"
                // badge on the same nav item. Suppress the lock whenever the badge fires.
                const showLock = item.requiresAuth && !user && !loading && !showReturnBadge;
                return (
                  <LocaleLink
                    key={item.href}
                    href={item.href}
                    className={`relative px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all duration-200 flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-[var(--surface)] text-[var(--primary)] shadow-sm ring-1 ring-[var(--accent)]/15'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                    title={showLock ? L('로그인이 필요해요', 'Requires sign-in') : undefined}
                  >
                    {item.label}
                    {showLock && <Lock size={10} className="opacity-60" />}
                    {showReturnBadge && (
                      <span
                        aria-label={L(`돌아올 결정 ${dueCount}건`, `${dueCount} decision(s) to revisit`)}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/${locale}${dueTarget}`); }}
                        className="absolute -top-0.5 -right-1 min-w-[14px] h-[14px] px-[3px] rounded-full flex items-center justify-center text-[9px] font-bold text-white leading-none cursor-pointer"
                        style={{ background: 'var(--gold)' }}
                      >
                        {dueCount}
                      </span>
                    )}
                  </LocaleLink>
                );
              })}
              {/* Overflow — the sidebar's former utility links (H1-C4) */}
              <div className="relative" ref={moreMenuRef}>
                <button
                  onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                  className="px-2.5 py-1.5 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center"
                  aria-label={L('더보기 메뉴', 'More menu')}
                  aria-haspopup="menu"
                  aria-expanded={moreMenuOpen}
                >
                  <MoreHorizontal size={16} />
                </button>
                {moreMenuOpen && (
                  <div role="menu" className="absolute right-0 top-full mt-2 w-64 bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-[var(--shadow-lg)] overflow-hidden animate-fade-in py-1">
                    {utilityItems.map((item, i) => {
                      const Icon = item.icon;
                      const firstOperator = item.section === 'operator' && utilityItems[i - 1]?.section !== 'operator';
                      return (
                        <div key={item.href}>
                          {firstOperator && <div className="my-1 border-t border-[var(--border-subtle)]" role="separator" />}
                          <LocaleLink
                            href={item.href}
                            role="menuitem"
                            onClick={() => setMoreMenuOpen(false)}
                            className="flex items-start gap-2.5 px-3 py-2 hover:bg-[var(--bg)] transition-colors group/util"
                          >
                            <Icon size={14} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[var(--text-tertiary)] group-hover/util:text-[var(--text-primary)] transition-colors" />
                            <span className="min-w-0">
                              <span className="block text-[13px] text-[var(--text-secondary)] group-hover/util:text-[var(--text-primary)] transition-colors leading-tight">{item.label}</span>
                              <span className="block text-[11px] text-[var(--text-tertiary)] leading-snug mt-0.5">{item.desc}</span>
                            </span>
                          </LocaleLink>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </nav>

            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              className="group flex h-9 items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)]/70 px-3 text-[12px] text-[var(--text-secondary)] shadow-[var(--shadow-xs)] transition-colors hover:border-[var(--accent)]/30 hover:text-[var(--text-primary)]"
              aria-label={L('빠른 이동 열기', 'Open quick navigation')}
              aria-haspopup="dialog"
            >
              <Search size={14} aria-hidden="true" />
              <span className="hidden lg:inline">{L('빠른 이동', 'Quick find')}</span>
              <kbd className="hidden xl:inline rounded border border-[var(--border-subtle)] bg-[var(--bg)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--text-tertiary)]">Ctrl/⌘ K</kbd>
            </button>

            {/* Locale toggle + Theme toggle + Status badges */}
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-full bg-[var(--surface)]/60 border border-[var(--border-subtle)] overflow-hidden" role="group" aria-label="Language">
                <button
                  onClick={() => handleLocaleChange('ko')}
                  className={`px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                    locale === 'ko'
                      ? 'bg-[var(--primary)] text-[var(--bg)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  aria-pressed={locale === 'ko'}
                  title={locale === 'ko' ? '한국어' : 'Korean'}
                >
                  KO
                </button>
                <button
                  onClick={() => handleLocaleChange('en')}
                  className={`px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                    locale === 'en'
                      ? 'bg-[var(--primary)] text-[var(--bg)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  aria-pressed={locale === 'en'}
                  title={locale === 'ko' ? '영어' : 'English'}
                >
                  EN
                </button>
              </div>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
                title={darkMode ? L('라이트 모드', 'Light mode') : L('다크 모드', 'Dark mode')}
                aria-label={darkMode ? L('라이트 모드로 전환', 'Switch to light mode') : L('다크 모드로 전환', 'Switch to dark mode')}
                aria-pressed={darkMode}
              >
                {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              {/* SyncStatus is UNGATED (P0-5/P1-C1): it tells a signed-out
                  returning user "saving to this device only" and shows offline
                  to everyone; first-time anonymous visitors get no badge (it
                  renders null for them internally). */}
              <SyncStatus />
              {user && <RateLimitBadge />}
              {/* Ungated: storage write failures (e.g. quota) affect anonymous users too */}
              <StorageErrorToast />
              {/* One-time "sign-in lapsed" lantern — fires from AuthProvider (P0-5) */}
              <SessionExpiredToast />
              {/* Generic toast — replaces native alert() (settings, uploads, …) */}
              <Toast />
            </div>

            {/* User area */}
            {!loading && (
              user ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-[var(--surface)] transition-colors cursor-pointer"
                    aria-label={L('계정 메뉴', 'Account menu')}
                    aria-haspopup="menu"
                    aria-expanded={userMenuOpen}
                  >
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt=""
                        className="w-7 h-7 rounded-full"
                        referrerPolicy="no-referrer"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                      />
                    ) : null}
                    <div className={`w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center ${avatarUrl ? 'hidden' : ''}`}>
                      <span className="text-[var(--accent-fg)] text-[11px] font-bold">{displayName.charAt(0).toUpperCase()}</span>
                    </div>
                  </button>

                  {userMenuOpen && (
                    <div role="menu" className="absolute right-0 top-full mt-1.5 w-56 bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-[var(--shadow-lg)] overflow-hidden animate-fade-in">
                      <div className="h-[2px] w-full" style={{ background: 'var(--gradient-gold)' }} />
                      <div className="px-3 py-2 border-b border-[var(--border-subtle)] mt-0">
                        <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{displayName}</p>
                        <p className="text-[11px] text-[var(--text-tertiary)] truncate">{user.email}</p>
                      </div>
                      <button
                        role="menuitem"
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg)] hover:text-[var(--danger)] transition-colors cursor-pointer"
                      >
                        <LogOut size={14} />
                        {L('로그아웃', 'Sign Out')}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <LocaleLink
                  href="/login"
                  className="px-3.5 py-1.5 rounded-full text-[13px] font-semibold text-[var(--accent)] hover:bg-[var(--ai)]/50 transition-colors"
                >
                  {L('로그인', 'Sign In')}
                </LocaleLink>
              )
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden min-w-[44px] min-h-[44px] inline-flex items-center justify-center p-2.5 hover:bg-[var(--surface)] rounded-lg cursor-pointer transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? L('메뉴 닫기', 'Close menu') : L('메뉴 열기', 'Open menu')}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <nav className="md:hidden border-t border-[var(--border-subtle)] bg-[var(--surface)] animate-slide-down">
          <div className="px-4 py-2 space-y-0.5">
            <button
              onClick={() => { setMobileMenuOpen(false); setCommandPaletteOpen(true); }}
              className="mb-2 flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg)] px-4 text-left text-[13px] text-[var(--text-secondary)]"
              aria-haspopup="dialog"
            >
              <Search size={15} aria-hidden="true" />
              <span className="flex-1">{L('페이지와 기능 찾기', 'Find pages and features')}</span>
              <kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[9px]">Ctrl/⌘ K</kbd>
            </button>
            {navItems.map((item) => {
              const showReturnBadge = item.href === '/project' && dueCount > 0;
              // Same as desktop: the return badge must not share a node with a lock.
              const showLock = item.requiresAuth && !user && !loading && !showReturnBadge;
              return (
                <LocaleLink
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg text-[14px] font-medium transition-colors ${
                    pathname === item.href
                      ? 'bg-[var(--bg)] text-[var(--primary)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span className="relative">
                    {item.label}
                    {showReturnBadge && (
                      <span
                        aria-label={L(`돌아올 결정 ${dueCount}건`, `${dueCount} decision(s) to revisit`)}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMobileMenuOpen(false); router.push(`/${locale}${dueTarget}`); }}
                        className="absolute -top-1.5 -right-4 min-w-[14px] h-[14px] px-[3px] rounded-full flex items-center justify-center text-[9px] font-bold text-white leading-none cursor-pointer"
                        style={{ background: 'var(--gold)' }}
                      >
                        {dueCount}
                      </span>
                    )}
                  </span>
                  {showLock && <Lock size={11} className="opacity-60" />}
                </LocaleLink>
              );
            })}
            {/* Former sidebar utilities (H1-C4) — same list as the desktop overflow */}
            <div className="pt-1 mt-1 border-t border-[var(--border-subtle)]">
              {utilityItems.map((item, i) => {
                const Icon = item.icon;
                const firstOperator = item.section === 'operator' && utilityItems[i - 1]?.section !== 'operator';
                return (
                  <div key={item.href}>
                    {firstOperator && <div className="my-1 border-t border-[var(--border-subtle)]" role="separator" />}
                    <LocaleLink
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 min-h-[44px] rounded-lg text-[14px] text-[var(--text-secondary)] hover:bg-[var(--bg)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <Icon size={15} strokeWidth={1.75} />
                      {item.label}
                    </LocaleLink>
                  </div>
                );
              })}
            </div>
            {/* Mobile locale toggle */}
            <div className="pt-2 mt-1 border-t border-[var(--border-subtle)] flex items-center gap-2 px-4">
              <span className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">{L('언어', 'Language')}</span>
              <div className="flex items-center rounded-full bg-[var(--bg)] border border-[var(--border-subtle)] overflow-hidden ml-auto">
                <button
                  onClick={() => handleLocaleChange('ko')}
                  className={`px-4 min-h-[44px] inline-flex items-center text-[12px] font-bold transition-colors cursor-pointer ${
                    locale === 'ko' ? 'bg-[var(--primary)] text-[var(--bg)]' : 'text-[var(--text-secondary)]'
                  }`}
                  aria-pressed={locale === 'ko'}
                >
                  KO
                </button>
                <button
                  onClick={() => handleLocaleChange('en')}
                  className={`px-4 min-h-[44px] inline-flex items-center text-[12px] font-bold transition-colors cursor-pointer ${
                    locale === 'en' ? 'bg-[var(--primary)] text-[var(--bg)]' : 'text-[var(--text-secondary)]'
                  }`}
                  aria-pressed={locale === 'en'}
                >
                  EN
                </button>
              </div>
            </div>
            {/* Mobile auth */}
            {!loading && (
              <div className="pt-1 mt-1 border-t border-[var(--border-subtle)]">
                {user ? (
                  <button
                    onClick={() => { setMobileMenuOpen(false); handleSignOut(); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-[14px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg)] hover:text-[var(--danger)] transition-colors cursor-pointer"
                  >
                    <LogOut size={14} />
                    {L('로그아웃', 'Sign Out')} ({displayName})
                  </button>
                ) : (
                  <LocaleLink
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-2.5 rounded-lg text-[14px] font-semibold text-[var(--accent)]"
                  >
                    {L('로그인', 'Sign In')}
                  </LocaleLink>
                )}
              </div>
            )}
          </div>
        </nav>
      )}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        locale={locale}
        items={commandItems}
      />
    </header>
  );
}
