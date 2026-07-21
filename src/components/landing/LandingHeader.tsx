'use client';

import { LocaleLink } from '@/components/ui/LocaleLink';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useLocaleSwitch } from '@/hooks/useLocaleSwitch';
import { useDueCount } from '@/hooks/useDueCount';
import { ArgusFaceMark } from '@/components/brand/ArgusFaceMark';
import { LocaleSwitchConfirmation } from '@/components/ui/LocaleSwitchConfirmation';

export function LandingHeader() {
  const {
    locale,
    switchTo: handleLocaleChange,
    pendingLocale,
    confirmSwitch,
    cancelSwitch,
  } = useLocaleSwitch();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const { user, loading } = useAuth();
  // 03 S7: the landing's one quiet recognition — a single gold dot (no number)
  // when a sealed decision is waiting. Same hook as every return surface, so
  // the landing can never disagree with the app about "something is due".
  const { dueCount } = useDueCount();

  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 transition-all duration-300"
      style={{
        // De-glass (§3 identity): the logbook is ink-on-paper, not screen glass.
        // Scrolled state is opaque parchment + an ink hairline, no blur.
        background: scrolled ? 'var(--bp-paper)' : 'transparent',
        borderBottom: scrolled ? '1px solid var(--bp-ink-whisper)' : '1px solid transparent',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <div className="h-14 md:h-16 flex items-center justify-between">
          {/* Wordmark — min 44px hit area for mobile */}
          <LocaleLink
            href="/"
            className="flex items-center gap-2 group"
            style={{ padding: '12px 4px 12px 0', marginLeft: -4 }}
          >
            <ArgusFaceMark size="sm" />
            <span
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--bp-ink)',
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: '-0.01em',
              }}
            >
              Argus
            </span>
          </LocaleLink>

          <div className="flex items-center gap-3 md:gap-5">
            {/* Locale toggle (mono / ink) */}
            <div
              className="flex items-center"
              style={{
                border: '1px solid var(--bp-ink-faint)',
                borderRadius: 999,
                overflow: 'hidden',
              }}
              role="group"
              aria-label="Language"
            >
              <button
                onClick={() => handleLocaleChange('ko')}
                className="bp-mono cursor-pointer transition-colors"
                style={{
                  padding: '12px 14px',
                  minHeight: 44,
                  fontSize: 10.5,
                  letterSpacing: '0.18em',
                  background: locale === 'ko' ? 'var(--bp-ink)' : 'transparent',
                  color: locale === 'ko' ? 'var(--bp-paper)' : 'var(--bp-ink-soft)',
                }}
                aria-pressed={locale === 'ko'}
              >
                KO
              </button>
              <button
                onClick={() => handleLocaleChange('en')}
                className="bp-mono cursor-pointer transition-colors"
                style={{
                  padding: '12px 14px',
                  minHeight: 44,
                  fontSize: 10.5,
                  letterSpacing: '0.18em',
                  background: locale === 'en' ? 'var(--bp-ink)' : 'transparent',
                  color: locale === 'en' ? 'var(--bp-paper)' : 'var(--bp-ink-soft)',
                }}
                aria-pressed={locale === 'en'}
              >
                EN
              </button>
            </div>

            {/* Auth area — min 44px tap area */}
            {!loading && (
              user ? (
                <LocaleLink
                  href="/workspace"
                  className="bp-mono transition-opacity hover:opacity-70 inline-flex items-center"
                  style={{
                    color: 'var(--bp-ink)',
                    fontSize: 11,
                    letterSpacing: locale === 'ko' ? '0.04em' : '0.16em',
                    textTransform: 'uppercase',
                    padding: '12px 6px',
                    minHeight: 44,
                    minWidth: 44,
                    justifyContent: 'center',
                  }}
                >
                  {dueCount > 0 && (
                    <span
                      aria-hidden
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        background: 'var(--bp-gold)',
                        marginRight: 7,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  {L('워크스페이스 →', 'Workspace →')}
                </LocaleLink>
              ) : (
                <LocaleLink
                  href="/login"
                  className="bp-mono transition-opacity hover:opacity-70 inline-flex items-center"
                  style={{
                    color: 'var(--bp-ink-soft)',
                    fontSize: 11,
                    letterSpacing: locale === 'ko' ? '0.04em' : '0.16em',
                    textTransform: 'uppercase',
                    padding: '12px 6px',
                    minHeight: 44,
                    minWidth: 44,
                    justifyContent: 'center',
                  }}
                >
                  {L('로그인', 'Sign In')}
                </LocaleLink>
              )
            )}
          </div>
        </div>
      </div>
      <LocaleSwitchConfirmation
        locale={locale}
        pendingLocale={pendingLocale}
        onConfirm={confirmSwitch}
        onCancel={cancelSwitch}
      />
    </header>
  );
}
