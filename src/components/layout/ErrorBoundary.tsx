'use client';

import React from 'react';
import Link from 'next/link';
import { handleError } from '@/lib/error-handler';
import { getCurrentLanguage } from '@/lib/i18n';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
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
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Class component — can't use hooks. Read locale from storage directly.
      const ko = getCurrentLanguage() === 'ko';

      return (
        <div className="min-h-[50vh] flex items-center justify-center p-8">
          <div className="max-w-md text-center space-y-4">
            <div className="text-4xl">⚠</div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {ko ? '문제가 발생했습니다' : 'Something went wrong'}
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              {ko
                ? '예기치 않은 오류가 발생했습니다. 새로고침 후 다시 시도해주세요.'
                : 'An unexpected error occurred. Please refresh and try again.'}
            </p>
            <div className="flex flex-col items-center gap-2.5">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--bg)] hover:shadow-[var(--shadow-sm)] hover:-translate-y-[1px] active:translate-y-0 transition-all"
              >
                {ko ? '다시 시도' : 'Try again'}
              </button>
              {/* Always-safe escape: if retry keeps re-throwing the same broken
                  subtree, a full nav to /workspace remounts the app cleanly. */}
              <Link
                href="/workspace"
                className="text-xs text-[var(--text-tertiary)] underline underline-offset-2 hover:text-[var(--text-secondary)] transition-colors"
              >
                {ko ? '워크스페이스로 돌아가기' : 'Back to workspace'}
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
