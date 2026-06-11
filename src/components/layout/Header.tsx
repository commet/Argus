'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, LogOut, Sun, Moon, Lock } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { RateLimitBadge } from '@/components/ui/RateLimitBadge';
import { SyncStatus } from '@/components/ui/SyncStatus';
import { StorageErrorToast } from '@/components/ui/StorageErrorToast';
import { ForkLimitToast } from '@/components/ui/ForkLimitToast';
import { useLocaleSwitch } from '@/hooks/useLocaleSwitch';

export function Header() {
  const { locale, switchTo: handleLocaleChange } = useLocaleSwitch();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;

  // W1.3 단일 진입: first-line nav is [워크스페이스·프로젝트·설정] only.
  // /agents·/boss·/guide routes are NOT deleted — they're reachable from
  // inside the workspace (crew-roster row), just no longer top-level doors.
  const navItems: Array<{ href: string; label: string; primary?: boolean; requiresAuth?: boolean }> = [
    { href: '/workspace', label: L('워크스페이스', 'Workspace'), primary: true },
    { href: '/project', label: L('프로젝트', 'Projects'), requiresAuth: true },
    { href: '/settings', label: L('설정', 'Settings') },
  ];

  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  // Landing page renders its own minimal header (LandingHeader). This bail
  // exists because <Header /> is rendered globally from layout.tsx; the
  // alternative — moving header rendering into LayoutShell — would couple
  // landing-vs-app routing to a single component without changing the
  // visual divergence here, so we keep the bail until both headers share
  // primitive components worth lifting.
  const isLanding = pathname === '/';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

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
    router.push('/login');
  };

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';
  const avatarUrl = user?.user_metadata?.avatar_url;

  // Landing renders LandingHeader instead — keep app chrome out of the marketing canvas
  if (isLanding) return null;

  return (
    <header className="sticky top-0 z-40 bg-[var(--bg)]/80 backdrop-blur-xl border-b border-[var(--border-subtle)]">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shadow-[var(--shadow-sm)] group-hover:shadow-[var(--glow-gold)] transition-all duration-300" style={{ background: 'var(--gradient-gold)' }}>
              <span className="text-white text-[13px] font-black tracking-tight">A</span>
            </div>
            <span className="text-[var(--primary)] font-extrabold text-[18px] tracking-tight">Argus</span>
          </Link>

          <div className="hidden md:flex items-center gap-3">
            {/* Desktop nav */}
            <nav className="flex items-center gap-0.5 bg-[var(--surface)]/60 backdrop-blur-sm rounded-full px-1.5 py-1 border border-[var(--border-subtle)] shadow-[var(--shadow-xs)]">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const showLock = item.requiresAuth && !user && !loading;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all duration-200 flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-[var(--surface)] text-[var(--primary)] shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                    title={showLock ? L('로그인이 필요해요', 'Requires sign-in') : undefined}
                  >
                    {item.label}
                    {showLock && <Lock size={10} className="opacity-60" />}
                  </Link>
                );
              })}
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
              >
                {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              {user && (
                <>
                  <SyncStatus />
                  <RateLimitBadge />
                </>
              )}
              {/* Ungated: storage write failures (e.g. quota) affect anonymous users too */}
              <StorageErrorToast />
              {/* Ungated: the branch-cap toast applies to any voyage */}
              <ForkLimitToast />
            </div>

            {/* User area */}
            {!loading && (
              user ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-[var(--surface)] transition-colors cursor-pointer"
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
                <Link
                  href="/login"
                  className="px-3.5 py-1.5 rounded-full text-[13px] font-semibold text-[var(--accent)] hover:bg-[var(--ai)]/50 transition-colors"
                >
                  {L('로그인', 'Sign In')}
                </Link>
              )
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2.5 hover:bg-[var(--surface)] rounded-lg cursor-pointer transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <nav className="md:hidden border-t border-[var(--border-subtle)] bg-[var(--surface)]/95 backdrop-blur-xl animate-slide-down">
          <div className="px-4 py-2 space-y-0.5">
            {navItems.map((item) => {
              const showLock = item.requiresAuth && !user && !loading;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[14px] font-medium transition-colors ${
                    pathname === item.href
                      ? 'bg-[var(--bg)] text-[var(--primary)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span>{item.label}</span>
                  {showLock && <Lock size={11} className="opacity-60" />}
                </Link>
              );
            })}
            {/* Mobile locale toggle */}
            <div className="pt-2 mt-1 border-t border-[var(--border-subtle)] flex items-center gap-2 px-4">
              <span className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">{L('언어', 'Language')}</span>
              <div className="flex items-center rounded-full bg-[var(--bg)] border border-[var(--border-subtle)] overflow-hidden ml-auto">
                <button
                  onClick={() => handleLocaleChange('ko')}
                  className={`px-3 py-1.5 text-[12px] font-bold transition-colors cursor-pointer ${
                    locale === 'ko' ? 'bg-[var(--primary)] text-[var(--bg)]' : 'text-[var(--text-secondary)]'
                  }`}
                  aria-pressed={locale === 'ko'}
                >
                  KO
                </button>
                <button
                  onClick={() => handleLocaleChange('en')}
                  className={`px-3 py-1.5 text-[12px] font-bold transition-colors cursor-pointer ${
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
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-2.5 rounded-lg text-[14px] font-semibold text-[var(--accent)]"
                  >
                    {L('로그인', 'Sign In')}
                  </Link>
                )}
              </div>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
