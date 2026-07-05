'use client';

import React from 'react';
import { handleError } from '@/lib/error-handler';
import { getCurrentLanguage } from '@/lib/i18n';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  /** Preferred over `fallback`: receives the boundary's own `reset` so a custom
   *  fallback can offer IN-PLACE retry (cheap re-render, no state loss) instead
   *  of a full reload. A bare `fallback` node can't reach `reset`, so it can only
   *  reload — which discards typed input / streaming analysis / session position. */
  renderFallback?: (reset: () => void) => React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    handleError(error, `ErrorBoundary:${errorInfo.componentStack?.split('\n')[1]?.trim() || 'unknown'}`);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Prefer the reset-aware render-prop (in-place retry, no state loss).
      if (this.props.renderFallback) {
        return this.props.renderFallback(this.handleRetry);
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Class component — can't use hooks. Read locale from storage directly.
      const ko = getCurrentLanguage() === 'ko';

      return (
        <div className="min-h-[50vh] flex items-center justify-center p-8" role="alert">
          <div className="max-w-md text-center space-y-4">
            <div className="text-4xl">⚠</div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {ko ? '여기서 암초에 걸렸어요' : 'We hit a reef here'}
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              {ko
                ? '이 구역만 잠깐 멈춘 거예요. 작업 내용은 이 브라우저에 그대로 남아 있어요.'
                : 'Only this section paused. Your work is still right here in this browser.'}
            </p>
            <div className="flex flex-col items-center gap-2.5">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--bg)] hover:shadow-[var(--shadow-sm)] hover:-translate-y-[1px] active:translate-y-0 transition-all"
              >
                {ko ? '다시 시도' : 'Try again'}
              </button>
              {/* Always-safe escape: if retry keeps re-throwing the same broken
                  subtree, a full nav to /workspace remounts the app cleanly. A
                  client-side <Link> would keep the broken React tree, so a raw
                  <a> (full reload) is intentional here. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/workspace"
                className="text-xs text-[var(--text-tertiary)] underline underline-offset-2 hover:text-[var(--text-secondary)] transition-colors"
              >
                {ko ? '워크스페이스로 돌아가기' : 'Back to workspace'}
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
