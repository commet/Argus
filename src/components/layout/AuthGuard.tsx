'use client';

import { LocaleLink } from '@/components/ui/LocaleLink';
import { usePathname } from 'next/navigation';
import { useAuth, hasKnownUser } from '@/lib/auth';
import { useLocale } from '@/hooks/useLocale';
import { stripLocale } from '@/lib/locale-path';
import { Lock, ChevronRight } from 'lucide-react';

/**
 * Soft wall: when anonymous, renders an in-page sign-in card instead of redirecting.
 * Preserves header + nav chrome so the user can explore other public routes.
 */

type PageKey = 'project' | 'agents' | 'teams' | 'other';

function detectPage(pathname: string): PageKey {
  if (pathname.startsWith('/project')) return 'project';
  if (pathname.startsWith('/agents')) return 'agents';
  if (pathname.startsWith('/teams')) return 'teams';
  return 'other';
}

function getCopy(page: PageKey, ko: boolean, knewYou: boolean) {
  const L = (k: string, e: string) => (ko ? k : e);
  // P0-5: a returning account-holder (knew-you flag) isn't a stranger to
  // pitch — recognize the return and just ask for the sign-in.
  if (knewYou) {
    return {
      title: L('다시 오셨네요 — 로그인만 다시 해주세요', 'Welcome back — just sign in again'),
      description: L(
        '기록은 계정에 그대로 있어요. 로그인하면 저장한 결정과 확인 일정을 다시 볼 수 있어요.',
        'Your records are safe in your account. Sign in to see your saved decisions and review dates.',
      ),
    };
  }
  switch (page) {
    case 'project':
      return {
        title: L('프로젝트는 로그인이 필요해요', 'Projects need an account'),
        description: L(
          '로그인하면 지금까지 작업한 내용이 프로젝트로 저장되고, 다음 번에 이어서 작업할 수 있어요.',
          'Sign in to save your work as projects and pick up where you left off next time.',
        ),
      };
    case 'agents':
      return {
        title: L('에이전트는 로그인이 필요해요', 'Agents need an account'),
        description: L(
          '로그인하면 나만의 리뷰어 팀을 저장하고, 워크스페이스에서 바로 쓸 수 있어요.',
          'Sign in to save your own reviewer team and use them directly in the workspace.',
        ),
      };
    case 'teams':
      return {
        title: L('팀은 로그인이 필요해요', 'Teams need an account'),
        description: L(
          '결정을 사람 팀과 공유하고, 각자 검토한 의견을 한 번에 모아볼 수 있어요.',
          'Share decisions with people, collect independent feedback, and review it together.',
        ),
      };
    default:
      return {
        title: L('로그인이 필요해요', 'Sign in required'),
        description: L(
          '이 페이지는 로그인한 사용자만 사용할 수 있어요.',
          'This page is only available to signed-in users.',
        ),
      };
  }
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const locale = useLocale();
  const ko = locale === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          {/* 09 S7: a silent circle reads as a hang — one line of machine-state fact. */}
          <p className="text-[13px] text-[var(--text-secondary)]">{L('세션을 확인하는 중이에요…', 'Checking your session…')}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    const page = detectPage(stripLocale(pathname || '/'));
    const { title, description } = getCopy(page, ko, hasKnownUser());
    // Keep the full locale-prefixed path so login returns the user to it.
    const redirectTo = encodeURIComponent(pathname || '/');

    return (
      <div className="flex-1 flex items-center justify-center py-16 px-4">
        <div className="max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--accent)]/10 mb-5">
            <Lock size={22} className="text-[var(--accent)]" />
          </div>
          <h1 className="text-[20px] font-bold text-[var(--text-primary)] mb-2">{title}</h1>
          <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed mb-6">{description}</p>
          <div className="flex flex-col gap-2 items-center">
            <LocaleLink
              href={`/login?redirect=${redirectTo}`}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[var(--accent-fg)] text-[14px] font-semibold transition-all hover:shadow-[var(--shadow-sm)]"
              style={{ background: 'var(--gradient-gold)' }}
            >
              {L('로그인하고 계속하기', 'Sign in to continue')} <ChevronRight size={14} />
            </LocaleLink>
            <LocaleLink
              href="/workspace"
              className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
            >
              {L('로그인 없이 워크스페이스 써보기 →', 'Try the workspace without signing in →')}
            </LocaleLink>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
