'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, clearUserCache } from './supabase';
import { clearAllStorage } from './storage';
import { setAnalyticsUser } from './analytics';
import { getCurrentLanguage } from './i18n';
import { migrateLocalToAccount } from './account-migration';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: (redirectAfter?: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string, captchaToken?: string) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

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

function translateError(msg: string): string {
  const ko = getCurrentLanguage() === 'ko';
  for (const entry of AUTH_ERRORS) {
    if (msg.includes(entry.match)) return ko ? entry.ko : entry.en;
  }
  return msg;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setAnalyticsUser(session?.user?.id ?? null);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      clearUserCache();
      setSession(session);
      setUser(session?.user ?? null);
      setAnalyticsUser(session?.user?.id ?? null);
      setLoading(false);

      // On a genuine sign-in, eagerly migrate local-first work into the account
      // and confirm it (local-first → "your thinking follows you when you sign up").
      if (_event === 'SIGNED_IN' && session?.user) {
        migrateLocalToAccount()
          .then((count) => {
            if (count > 0 && typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('argus:account-synced', { detail: { count } }));
            }
          })
          .catch(() => { /* migration is best-effort; never block auth */ });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async (redirectAfter?: string) => {
    // Supabase OAuth takes a full-page redirect, so sessionStorage survives the round-trip.
    // auth/callback consumes + clears the key.
    if (redirectAfter && redirectAfter.startsWith('/') && !redirectAfter.startsWith('//')) {
      sessionStorage.setItem('argus:postAuthRedirect', redirectAfter);
    }
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? translateError(error.message) : null };
  };

  const signUpWithEmail = async (email: string, password: string, captchaToken?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        captchaToken,
      },
    });
    return { error: error ? translateError(error.message) : null };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    return { error: error ? translateError(error.message) : null };
  };

  const signOut = async () => {
    clearUserCache();
    clearAllStorage();
    const { error } = await supabase.auth.signOut();
    if (error) {
      // 로그아웃 실패 시에도 로컬 상태는 이미 정리됨
      // 페이지 새로고침으로 세션 강제 종료
      window.location.href = '/login';
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
