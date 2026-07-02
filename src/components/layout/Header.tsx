'use client';

import { LocaleLink } from '@/components/ui/LocaleLink';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, LogOut, Sun, Moon, Lock, MoreHorizontal, Download, Users, BookOpen, BarChart3, UserCheck } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useDueCount } from '@/hooks/useDueCount';
import { RateLimitBadge } from '@/components/ui/RateLimitBadge';
import { SyncStatus } from '@/components/ui/SyncStatus';
import { StorageErrorToast } from '@/components/ui/StorageErrorToast';
import { SessionExpiredToast } from '@/components/ui/SessionExpiredToast';
import { useLocaleSwitch } from '@/hooks/useLocaleSwitch';
import { stripLocale } from '@/lib/locale-path';

const OPERATOR_EMAILS = new Set(['time22say@gmail.com', 'yclee913@gmail.com']);

export function Header() {
  const { locale, switchTo: handleLocaleChange } = useLocaleSwitch();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;

  // W1.3 단일 진입: first-line nav is [워크스페이스·프로젝트·설정] only.
  // /agents·/boss·/guide routes are NOT deleted — they're reachable from
  // inside the workspace (crew-roster row), just no longer top-level doors.
  // /project is PUBLIC (public-paths.ts) and localStorage-first — it shows the user's
  // own (anon-included) decisions and the due-return strip. It must NOT wear a 🔒:
  // the seal promises anon users a dated return there, so a lock next to the due badge
  // told the exact cohort we courted that their own decision was off-limits (they never
  // clicked, the loop never closed). Login is nudged for SYNC at the seal, not here.
  const navItems: Array<{ href: string; label: string; primary?: boolean; requiresAuth?: boolean }> = [
    { href: '/workspace', label: L('워크스페이스', 'Workspace'), primary: true },
    { href: '/project', label: L('프로젝트', 'Projects') },
    { href: '/settings', label: L('설정', 'Settings') },
  ];

  const pathname = stripLocale(usePathname());
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  // Secondary tools that used to live in the (mostly empty) 224px sidebar —
  // the aside is gone (H1-C4), so they move into an overflow menu here. The
  // operator dashboard keeps its email gate, moved verbatim from Sidebar.
  const isOperator = !!user?.email && OPERATOR_EMAILS.has(user.email);
  const utilityItems: Array<{ href: string; label: string; icon: typeof Download }> = [
    { href: '/import', label: L('가져오기', 'Import'), icon: Download },
    { href: '/teams', label: L('팀', 'Teams'), icon: Users },
    // /boss moved here from the workspace idle chips (P0-7) — the route lives on,
    // only the extra doorway on the landing was removed.
    { href: '/boss', label: L('보고 상대 설정', 'Set your reviewer'), icon: UserCheck },
    { href: '/guide', label: L('사용 가이드', 'Guide'), icon: BookOpen },
    ...(isOperator ? [{ href: '/admin', label: L('계기판', 'Dashboard'), icon: BarChart3 }] : []),
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
  const [darkMode, setDarkMode] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

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

  // Theme initialization + cross-tab sync
  useEffect(() => {
    const saved = localStorage.getItem('argus-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved === 'dark' || (!saved && prefersDark);
    setDarkMode(isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');

    const handleStorage = (e: StorageEvent) => {
      if (e.key !== 'argus-theme' || e.newValue == null) return;
      const nextDark = e.newValue === 'dark';
      setDarkMode(nextDark);
      document.documentElement.setAttribute('data-theme', nextDark ? 'dark' : 'light');
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
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
    <header className="sticky top-0 z-40 bg-[var(--bg)] border-b border-[var(--border-subtle)]">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="h-16 flex items-center justify-between">
          <LocaleLink href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-[var(--shadow-sm)] group-hover:shadow-[var(--glow-gold)] transition-all duration-300" style={{ background: 'var(--gradient-gold)' }}>
              <span className="text-white text-[13px] font-black tracking-tight">A</span>
            </div>
            <span className="text-[var(--primary)] font-extrabold text-[18px] tracking-tight">Argus</span>
          </LocaleLink>

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
                        ? 'bg-[var(--surface)] text-[var(--primary)] shadow-sm'
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
                  <div className="absolute right-0 top-full mt-2 w-44 bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-[var(--shadow-lg)] overflow-hidden animate-fade-in py-1">
                    {utilityItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <LocaleLink
                          key={item.href}
                          href={item.href}
                          onClick={() => setMoreMenuOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg)] hover:text-[var(--text-primary)] transition-colors"
                        >
                          <Icon size={14} strokeWidth={1.75} />
                          {item.label}
                        </LocaleLink>
                      );
                    })}
                  </div>
                )}
              </div>
            </nav>

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
                  title="한국어"
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
                  title="English"
                >
                  EN
                </button>
              </div>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
                title={darkMode ? 'Light mode' : 'Dark mode'}
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
                      <span className="text-white text-[11px] font-bold">{displayName.charAt(0).toUpperCase()}</span>
                    </div>
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-56 bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-[var(--shadow-lg)] overflow-hidden animate-fade-in">
                      <div className="h-[2px] w-full" style={{ background: 'var(--gradient-gold)' }} />
                      <div className="px-3 py-2 border-b border-[var(--border-subtle)] mt-0">
                        <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{displayName}</p>
                        <p className="text-[11px] text-[var(--text-tertiary)] truncate">{user.email}</p>
                      </div>
                      <button
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
              {utilityItems.map((item) => {
                const Icon = item.icon;
                return (
                  <LocaleLink
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 min-h-[44px] rounded-lg text-[14px] text-[var(--text-secondary)] hover:bg-[var(--bg)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <Icon size={15} strokeWidth={1.75} />
                    {item.label}
                  </LocaleLink>
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
    </header>
  );
}
