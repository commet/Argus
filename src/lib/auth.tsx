'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, clearUserCache, getSessionWithTimeout, isRealUser } from './supabase';
import { clearAllStorage, STORAGE_KEYS } from './storage';
import { setAnalyticsUser, track } from './analytics';
import { getCurrentLanguage } from './i18n';
import { migrateLocalToAccount } from './account-migration';
import type { User, Session } from '@supabase/supabase-js';
import { localeFromPath, withLocale, type AppLocale } from './locale-path';
import { purgeCurrentBrowserContinuity } from './epistemic/browser-lifecycle';
import { safePostAuthRedirect } from './auth-redirect';
import {
  claimAnonymousAccountTransfer,
  prepareAnonymousAccountTransfer,
} from './anonymous-account-transfer';
import { reportSyncFailure } from './sync-health';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: (redirectAfter?: string) => Promise<{ error: string | null }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string, captchaToken?: string, profile?: { name?: string; role?: string }) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function browserLocale(): AppLocale {
  if (typeof window === 'undefined') return 'en';
  return localeFromPath(window.location.pathname) || (getCurrentLanguage() === 'ko' ? 'ko' : 'en');
}

// Each entry: Supabase error substring → { ko, en } localized message.
// EN users were previously getting Korean messages from this map; the table
// now carries both translations and the lookup picks via getCurrentLanguage().
const AUTH_ERRORS: Array<{ match: string; ko: string; en: string }> = [
  {
    match: 'Invalid login credentials',
    ko: '이메일 또는 비밀번호가 올바르지 않습니다.',
    en: "Email or password doesn't match.",
  },
  // Intentionally vague to prevent email enumeration.
  {
    match: 'User already registered',
    ko: '가입을 완료할 수 없습니다. 이미 계정이 있다면 로그인해주세요.',
    en: "Couldn't complete sign-up. If you already have an account, please sign in.",
  },
  {
    match: 'Email not confirmed',
    ko: '가입을 완료할 수 없습니다. 이미 계정이 있다면 로그인해주세요.',
    en: "Couldn't complete sign-up. If you already have an account, please sign in.",
  },
  {
    match: 'Password should be at least 6 characters',
    ko: '비밀번호는 최소 6자 이상이어야 합니다.',
    en: 'Password must be at least 6 characters.',
  },
  {
    match: 'Signup requires a valid password',
    ko: '유효한 비밀번호를 입력해주세요.',
    en: 'Please enter a valid password.',
  },
];

/**
 * True when this browser has completed a sign-in before — a single local
 * boolean, no name/email stored. Lets logged-out surfaces tell a returning
 * account-holder ("session expired, work still saved here") apart from a
 * first-time anonymous visitor ("free trial") without a server round-trip.
 * Cleared by clearAllStorage() on explicit sign-out, so a deliberate
 * sign-out never reads as an expiry. (P0-5 session-expiry honesty.)
 */
export function hasKnownUser(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEYS.KNEW_YOU) === '1';
  } catch {
    return false;
  }
}

function translateError(msg: string): string {
  const ko = getCurrentLanguage() === 'ko';
  for (const entry of AUTH_ERRORS) {
    if (msg.includes(entry.match)) return ko ? entry.ko : entry.en;
  }
  return msg;
}

function transferPreparationError(): string {
  return getCurrentLanguage() === 'ko'
    ? '기존 작업을 계정에 안전하게 옮길 준비를 하지 못했습니다. 잠시 후 다시 시도해 주세요.'
    : "We couldn't safely prepare your existing work for this account. Please try again.";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let migrationInFlight: Promise<void> | null = null;
    const finishPermanentAccountMigration = (forceLocalMigration: boolean) => {
      if (migrationInFlight) return migrationInFlight;
      migrationInFlight = claimAnonymousAccountTransfer()
        .then(async (transfer) => {
          if (!transfer.ok) {
            reportSyncFailure('anonymous-account-transfer', { message: transfer.error || 'claim failed' });
          }
          if (!forceLocalMigration && !transfer.needed) return null;
          const migrated = await migrateLocalToAccount();
          return { ...migrated, partial: migrated.partial || !transfer.ok };
        })
        .then((result) => {
          if (!result) return;
          const { projects, partial } = result;
          if (projects > 0 && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('argus:account-synced', { detail: { count: projects, partial } }));
          }
        })
        .catch(() => { /* migration is best-effort; sync health owns retry visibility */ })
        .finally(() => {
          migrationInFlight = null;
        });
      return migrationInFlight;
    };

    // 4s cap on the front-door session read: if auth stalls, open the app as
    // signed-out instead of an endless boot spinner. onAuthStateChange below is
    // the safety net — a real session re-fills user/session moments later.
    getSessionWithTimeout().then((session) => {
      // Anonymous sessions (durable server identity for logged-out voyagers) are
      // NOT a signed-in user for the app's UX — only a real account is.
      const realUser = isRealUser(session?.user) ? session!.user : null;
      setSession(session);
      setUser(realUser);
      setAnalyticsUser(realUser?.id ?? null);
      setLoading(false);
      // A prepared transfer can outlive the OAuth/email callback (for example a
      // transient database outage). Retry it whenever a permanent session boots,
      // not only on the one SIGNED_IN event.
      if (realUser) void finishPermanentAccountMigration(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      clearUserCache();
      // Anonymous sessions are server-identity plumbing, not a signed-in user —
      // keep every real-account gate (wall/header/migration/expiry) keyed on a
      // real user so anon auth changes nothing about the logged-out experience.
      const realUser = isRealUser(session?.user) ? session!.user : null;
      setSession(session);
      setUser(realUser);
      setAnalyticsUser(realUser?.id ?? null);
      setLoading(false);

      // P0-5 session-expiry honesty: remember (boolean only) that this browser
      // has signed in; when the session later drops while the flag is still set
      // (token expiry — explicit sign-out clears the flag FIRST via
      // clearAllStorage), announce it once so the silence doesn't read as
      // "everything is still backing up". Consumed by SessionExpiredToast.
      // An anonymous session is neither a real sign-in nor an expiry, so it must
      // not set the flag or fire the expiry signal.
      try {
        if (realUser) {
          localStorage.setItem(STORAGE_KEYS.KNEW_YOU, '1');
        } else if (localStorage.getItem(STORAGE_KEYS.KNEW_YOU) === '1' && !session?.user) {
          window.dispatchEvent(new CustomEvent('argus:session-expired'));
        }
      } catch { /* storage unavailable — skip the courtesy signal */ }

      // On a genuine sign-in, eagerly migrate local-first work into the account
      // and confirm it (local-first → "your thinking follows you when you sign up").
      if (_event === 'SIGNED_IN' && realUser) {
        // Claim server-backed anonymous rows FIRST. Otherwise the local fallback
        // collides with rows still owned by the old anonymous uid and RLS rejects
        // the upsert. The one-time ticket remains retryable on failure.
        void finishPermanentAccountMigration(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async (redirectAfter?: string) => {
    track('login_attempt', { method: 'google' });
    const transfer = await prepareAnonymousAccountTransfer();
    if (!transfer.ok) {
      track('login_failure', { method: 'google', reason: transfer.error || 'transfer_prepare_failed' });
      return { error: transferPreparationError() };
    }
    // Supabase OAuth takes a full-page redirect, so sessionStorage survives the round-trip.
    // auth/callback consumes + clears the key.
    if (redirectAfter) sessionStorage.setItem('argus:postAuthRedirect', safePostAuthRedirect(redirectAfter));
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${withLocale(browserLocale(), '/auth/callback')}`,
      },
    });
    if (error) track('login_failure', { method: 'google', reason: error.message.slice(0, 80) });
    return { error: error ? translateError(error.message) : null };
  };

  const signInWithEmail = async (email: string, password: string) => {
    track('login_attempt', { method: 'email' });
    const transfer = await prepareAnonymousAccountTransfer();
    if (!transfer.ok) return { error: transferPreparationError() };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) track('login_failure', { method: 'email', reason: error.message.slice(0, 80) });
    return { error: error ? translateError(error.message) : null };
  };

  const signUpWithEmail = async (email: string, password: string, captchaToken?: string, profile?: { name?: string; role?: string }) => {
    track('signup_attempt', { method: 'email' });
    const transfer = await prepareAnonymousAccountTransfer();
    if (!transfer.ok) return { error: transferPreparationError() };
    // Optional profile — stored on user_metadata for greeting + decision-context personalization.
    const displayName = profile?.name?.trim();
    const role = profile?.role?.trim();
    const data: Record<string, string> = {};
    if (displayName) data.display_name = displayName;
    if (role) data.role = role;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${withLocale(browserLocale(), '/auth/callback')}`,
        captchaToken,
        ...(Object.keys(data).length ? { data } : {}),
      },
    });
    if (error) track('signup_failure', { method: 'email', reason: error.message.slice(0, 80) });
    else track('signup_success', { method: 'email', named: !!displayName, role: role || 'none' });
    return { error: error ? translateError(error.message) : null };
  };

  const resetPassword = async (email: string) => {
    const transfer = await prepareAnonymousAccountTransfer();
    if (!transfer.ok) return { error: transferPreparationError() };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${withLocale(browserLocale(), '/auth/callback')}`,
    });
    return { error: error ? translateError(error.message) : null };
  };

  const signOut = async () => {
    clearUserCache();
    if (user?.id) {
      try { await purgeCurrentBrowserContinuity(user.id); }
      catch { /* explicit sign-out still clears known localStorage below */ }
    }
    clearAllStorage();
    const { error } = await supabase.auth.signOut();
    if (error) {
      // 로그아웃 실패 시에도 로컬 상태는 이미 정리됨
      // 페이지 새로고침으로 세션 강제 종료
      window.location.href = withLocale(browserLocale(), '/login');
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
