'use client';

import { usePathname } from 'next/navigation';
import { MotionConfig } from 'framer-motion';
import { AuthGuard } from './AuthGuard';
import { isPublicPath } from '@/lib/public-paths';
import { stripLocale } from '@/lib/locale-path';

export function LayoutShell({ children }: { children: React.ReactNode }) {
  // All framer-motion animations app-wide respect the OS reduced-motion setting.
  return (
    <MotionConfig reducedMotion="user">
      <LayoutShellInner>{children}</LayoutShellInner>
    </MotionConfig>
  );
}

function LayoutShellInner({ children }: { children: React.ReactNode }) {
  const pathname = stripLocale(usePathname());
  const isWorkspace = pathname.startsWith('/workspace');
  const isLanding = pathname === '/';
  const isDesign = pathname.startsWith('/design');
  const isLogin = pathname === '/login';
  const isCallback = pathname.startsWith('/auth/callback');
  const needsAuth = !isPublicPath(pathname);

  // Login & callback — no chrome, no auth guard
  if (isLogin || isCallback) {
    return <main className="flex-1 w-full">{children}</main>;
  }

  // Landing & design showcase — full width, no auth, no app chrome.
  // The /design/* pages are public component/film references with their own
  // headers, so they get the same bare full-width shell as the landing.
  if (isLanding || isDesign) {
    return (
      <main className="flex-1 w-full animate-fade-in">
        {children}
      </main>
    );
  }

  // Protected routes
  const content = needsAuth ? <AuthGuard>{children}</AuthGuard> : children;

  // Full-width, no sidebar (workspace, boss)
  // min-w-0: this is a flex item in the row `<div className="flex flex-1">`
  // (layout.tsx). A flex item defaults to min-width:auto, so it refuses to
  // shrink below its content's min-content width — any wide descendant (a
  // nowrap/truncate line, a long option) then pushes the whole page past the
  // viewport, which iOS Safari resolves by zooming out. min-w-0 lets it shrink
  // to the viewport so descendants wrap/clip instead of overflowing.
  if (isWorkspace) {
    return <main className="flex-1 min-w-0">{content}</main>;
  }
  const isBoss = pathname.startsWith('/boss');
  if (isBoss) {
    return <div className="flex-1 min-w-0">{content}</div>;
  }
  const isPatterns = pathname.startsWith('/patterns');
  if (isPatterns) {
    return <div className="flex-1 min-w-0">{content}</div>;
  }

  // The 224px <Sidebar /> that used to render here is gone (Argus 2.0 H1-C4):
  // on every one of these pages it was an almost-empty white column that read
  // as "unfinished". Its contents moved — utility links + operator dashboard
  // into the Header overflow menu, personas to /teams via that menu, and the
  // current-project label to the /project page itself.
  return (
    <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-5xl mx-auto w-full animate-fade-in">
      {content}
    </main>
  );
}
