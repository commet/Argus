'use client';

import { usePathname } from 'next/navigation';
import { MotionConfig } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { AuthGuard } from './AuthGuard';
import { isPublicPath } from '@/lib/public-paths';

export function LayoutShell({ children }: { children: React.ReactNode }) {
  // All framer-motion animations app-wide respect the OS reduced-motion setting.
  return (
    <MotionConfig reducedMotion="user">
      <LayoutShellInner>{children}</LayoutShellInner>
    </MotionConfig>
  );
}

function LayoutShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
  const isBoss = pathname.startsWith('/boss');
  if (isWorkspace || isBoss) {
    return <div className="flex-1">{content}</div>;
  }

  return (
    <>
      <Sidebar />
      <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-5xl mx-auto w-full animate-fade-in">
        {content}
      </main>
    </>
  );
}
