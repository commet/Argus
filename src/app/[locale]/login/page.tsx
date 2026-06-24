'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { LocaleLink } from '@/components/ui/LocaleLink';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { useLocale } from '@/hooks/useLocale';
import { useLocaleRouter } from '@/hooks/useLocaleRouter';
import { DAILY_LIMIT, ANON_LIMIT } from '@/lib/quota-config';
import { Zap, FolderOpen, Users, MessageSquare } from 'lucide-react';

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

function getAuthErrors(locale: 'ko' | 'en'): Record<string, string> {
  if (locale === 'ko') {
    return {
      auth_failed: '로그인에 실패했어요. 다시 시도해 주세요.',
      oauth_denied: 'Google 로그인이 취소됐어요.',
    };
  }
  return {
    auth_failed: 'Sign-in failed. Please try again.',
    oauth_denied: 'Google sign-in was canceled.',
  };
}

// Optional role chips on sign-up — decision-context personalization (stored on
// user_metadata.role). Ids stay stable in English; labels are localized.
const SIGNUP_ROLES = [
  { id: 'founder', ko: '창업·대표', en: 'Founder' },
  { id: 'product', ko: '기획·PM', en: 'Product / PM' },
  { id: 'engineering', ko: '개발', en: 'Engineering' },
  { id: 'design', ko: '디자인', en: 'Design' },
  { id: 'marketing', ko: '마케팅·그로스', en: 'Marketing' },
  { id: 'leadership', ko: '경영·리더', en: 'Leadership' },
  { id: 'other', ko: '기타', en: 'Other' },
] as const;

function LoginContent() {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const router = useLocaleRouter();
  const searchParams = useSearchParams();
  const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } = useAuth();
  const [isReset, setIsReset] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const turnstileRef = useRef<TurnstileInstance>(null);

  // Handle error/redirect params from middleware or callback
  useEffect(() => {
    const errorParam = searchParams.get('error');
    const errors = getAuthErrors(locale);
    if (errorParam && errors[errorParam]) {
      setError(errors[errorParam]);
    }
  }, [searchParams, locale]);

  useEffect(() => {
    if (!loading && user) {
      const raw = searchParams.get('redirect') || '/workspace';
      // Prevent open redirect — only allow relative paths on the same origin
      const safeRedirect = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/workspace';
      router.replace(safeRedirect);
    }
  }, [user, loading, router, searchParams]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);

    if (isReset) {
      const { error } = await resetPassword(email);
      if (error) {
        setError(error);
      } else {
        setMessage(L('비밀번호 재설정 링크를 보냈어요. 이메일을 확인해 주세요.', 'Password reset link sent. Please check your email.'));
      }
    } else if (isSignUp) {
      const { error } = await signUpWithEmail(email, password, captchaToken || undefined, { name, role });
      if (error) {
        setError(error);
        turnstileRef.current?.reset();
        setCaptchaToken('');
      } else {
        setMessage(L('확인 메일을 보냈어요. 이메일을 확인해 주세요.', 'Confirmation email sent. Please check your email.'));
      }
    } else {
      const { error } = await signInWithEmail(email, password);
      if (error) {
        setError(error);
      }
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[13px] text-[var(--text-secondary)]">{L('워크스페이스로 이동 중...', 'Taking you to the workspace...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Calm token-based backdrop — a faint gold wash over the app bg.
          (Piano photo retired — leftover Overture-era music metaphor.) */}
      <div className="absolute inset-0 bg-[var(--bg)]" />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.06]"
        style={{ background: 'var(--gradient-gold)' }}
      />

      <div className="relative w-full max-w-[400px]">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2.5 mb-3">
            {/* Overture-era 'O' logo retired (W1.3) — voyage-vocabulary text
                wordmark, matching the app header's badge. */}
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shadow-[var(--shadow-sm)]" style={{ background: 'var(--gradient-gold)' }}>
              <span className="text-white font-black text-[15px]">A</span>
            </div>
            <span className="text-[22px] font-extrabold text-[var(--text-primary)] tracking-tight">Argus</span>
          </div>
          <p className="text-[14px] text-[var(--text-secondary)]">
            {L('결정의 궤적을 이어가려면 — 로그인해 주세요', "Pick up your decision's trail — sign in.")}
          </p>
        </div>

        {/* Benefits — only shown in sign-up mode (not reset or sign-in) */}
        {isSignUp && !isReset && (
          <div className="mb-4 p-4 rounded-2xl bg-[var(--accent)]/8 border border-[var(--accent)]/15">
            <p className="text-[12px] font-bold text-[var(--accent)] uppercase tracking-wider mb-3">
              {L('가입하면 이런 게 풀려요', 'Sign up unlocks')}
            </p>
            <ul className="space-y-2 text-[13px] text-[var(--text-primary)]">
              <li className="flex items-start gap-2">
                <Zap size={14} className="text-[var(--accent)] shrink-0 mt-0.5" />
                <span>{locale === 'ko'
                  ? <>하루 <strong>{DAILY_LIMIT}회</strong> 무료 사용 (비회원 {ANON_LIMIT}회)</>
                  : <><strong>{DAILY_LIMIT} free calls per day</strong> (vs {ANON_LIMIT} for guests)</>}</span>
              </li>
              <li className="flex items-start gap-2">
                <FolderOpen size={14} className="text-[var(--accent)] shrink-0 mt-0.5" />
                <span>{L('프로젝트 저장 · 다음에 이어서 작업', 'Save projects and pick up where you left off')}</span>
              </li>
              <li className="flex items-start gap-2">
                <Users size={14} className="text-[var(--accent)] shrink-0 mt-0.5" />
                <span>{L('나만의 리뷰어 팀 저장 · 어디서든 호출', 'Save your reviewer team and call them anywhere')}</span>
              </li>
              <li className="flex items-start gap-2">
                <MessageSquare size={14} className="text-[var(--accent)] shrink-0 mt-0.5" />
                <span>{L('팀장 프로필 저장 · 리허설 반복', 'Save boss profiles and run rehearsals repeatedly')}</span>
              </li>
            </ul>
          </div>
        )}

        {/* Auth Card */}
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-lg)] overflow-hidden">
          <div className="h-[2px] w-full" style={{ background: 'var(--gradient-gold)' }} />
          <div className="p-6 space-y-5">
          {/* Google OAuth */}
          <button
            onClick={() => signInWithGoogle(searchParams.get('redirect') || undefined)}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-[var(--border)] shadow-[var(--shadow-xs)] hover:shadow-[var(--shadow-sm)] hover:border-[var(--accent)] hover:bg-[var(--ai)]/30 transition-all cursor-pointer text-[14px] font-semibold text-[var(--text-primary)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {L('Google로 시작하기', 'Continue with Google')}
          </button>
          <p className="text-[11px] text-[var(--text-tertiary)] text-center leading-relaxed">
            {locale === 'ko' ? (
              <>시작하면 <a href="/terms" target="_blank" className="text-[var(--accent)] hover:underline">이용약관</a> 및 <a href="/privacy" target="_blank" className="text-[var(--accent)] hover:underline">개인정보처리방침</a>에 동의합니다</>
            ) : (
              <>By continuing you agree to our <a href="/terms" target="_blank" className="text-[var(--accent)] hover:underline">Terms</a> and <a href="/privacy" target="_blank" className="text-[var(--accent)] hover:underline">Privacy Policy</a></>
            )}
          </p>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[var(--border)]" />
            <span className="text-[12px] text-[var(--text-tertiary)]">{L('또는', 'or')}</span>
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-3">
            {isSignUp && (
              <div>
                <input
                  type="text"
                  maxLength={40}
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={L('어떻게 불러드릴까요? (선택)', 'What should we call you? (optional)')}
                  className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--gold-muted),var(--glow-accent)] transition-all"
                />
                <p className="mt-1 px-1 text-[11px] text-[var(--text-tertiary)] leading-snug">
                  {L('정산할 때 이 이름으로 인사하고, 결정 기록에 함께 남겨요.', 'We greet you by this name and keep it with your decision log.')}
                </p>
              </div>
            )}
            {isSignUp && (
              <div>
                <p className="mb-1.5 px-1 text-[12px] text-[var(--text-secondary)]">
                  {L('무슨 일을 하세요? (선택)', 'What do you do? (optional)')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SIGNUP_ROLES.map((r) => {
                    const active = role === r.id;
                    return (
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => setRole(active ? '' : r.id)}
                        aria-pressed={active}
                        className={`px-3 py-1.5 rounded-full text-[12.5px] border transition-all cursor-pointer ${
                          active
                            ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] font-medium'
                            : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40'
                        }`}
                      >
                        {L(r.ko, r.en)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div>
              <input
                type="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={L('이메일', 'Email')}
                className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--gold-muted),var(--glow-accent)] transition-all"
              />
            </div>
            {!isReset && (
              <div>
                <input
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={L('비밀번호 (8자 이상)', 'Password (8+ characters)')}
                  className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--gold-muted),var(--glow-accent)] transition-all"
                />
              </div>
            )}

            {error && (
              <p className="text-[12px] text-[var(--danger)] bg-[var(--danger)]/10 border border-[var(--danger)]/25 rounded-lg px-3 py-2">{error}</p>
            )}
            {message && (
              <p className="text-[12px] text-[var(--success)] bg-[var(--success)]/10 border border-[var(--success)]/25 rounded-lg px-3 py-2">{message}</p>
            )}

            {/* Terms agreement on sign-up */}
            {isSignUp && (
              <div className="space-y-2 pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedTerms}
                    onChange={(e) => setAgreedTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-[var(--border)] accent-[var(--accent)] cursor-pointer"
                  />
                  <span className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
                    <span className="text-[var(--danger)]">{L('[필수]', '[Required]')}</span>{' '}
                    {locale === 'ko' ? (
                      <><a href="/terms" target="_blank" className="text-[var(--accent)] underline">서비스 이용약관</a>에 동의합니다</>
                    ) : (
                      <>I agree to the <a href="/terms" target="_blank" className="text-[var(--accent)] underline">Terms of Service</a></>
                    )}
                  </span>
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedPrivacy}
                    onChange={(e) => setAgreedPrivacy(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-[var(--border)] accent-[var(--accent)] cursor-pointer"
                  />
                  <span className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
                    <span className="text-[var(--danger)]">{L('[필수]', '[Required]')}</span>{' '}
                    {locale === 'ko' ? (
                      <><a href="/privacy" target="_blank" className="text-[var(--accent)] underline">개인정보처리방침</a>에 동의합니다</>
                    ) : (
                      <>I agree to the <a href="/privacy" target="_blank" className="text-[var(--accent)] underline">Privacy Policy</a></>
                    )}
                  </span>
                </label>
              </div>
            )}

            {isSignUp && TURNSTILE_SITE_KEY && (
              <div className="flex justify-center pt-1">
                <Turnstile
                  ref={turnstileRef}
                  siteKey={TURNSTILE_SITE_KEY}
                  onSuccess={setCaptchaToken}
                  onExpire={() => setCaptchaToken('')}
                  options={{ theme: 'auto', size: 'normal' }}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || (isSignUp && (!agreedTerms || !agreedPrivacy || (!!TURNSTILE_SITE_KEY && !captchaToken)))}
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--primary)] text-[var(--bg)] text-[14px] font-semibold hover:bg-[var(--primary-light)] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {submitting
                ? L('처리 중...', 'Working...')
                : isReset
                  ? L('재설정 링크 보내기', 'Send reset link')
                  : isSignUp
                    ? L('회원가입', 'Sign up')
                    : L('로그인', 'Sign in')}
            </button>
          </form>

          {/* Forgot password link (login mode only) */}
          {!isSignUp && !isReset && (
            <button
              onClick={() => { setIsReset(true); setError(''); setMessage(''); }}
              className="w-full text-center text-[12px] text-[var(--text-tertiary)] hover:text-[var(--accent)] cursor-pointer transition-colors"
            >
              {L('비밀번호를 잊으셨나요?', 'Forgot your password?')}
            </button>
          )}

          {/* Toggle Sign Up / Sign In / Reset */}
          <p className="text-center text-[13px] text-[var(--text-secondary)]">
            {isReset
              ? L('비밀번호가 기억나셨나요?', 'Remembered your password?')
              : isSignUp
                ? L('이미 계정이 있으신가요?', 'Already have an account?')
                : L('처음이신가요?', 'New here?')}
            <button
              onClick={() => { setIsSignUp(isReset ? false : !isSignUp); setIsReset(false); setError(''); setMessage(''); }}
              className="ml-1.5 text-[var(--accent)] font-semibold hover:underline cursor-pointer"
            >
              {isReset
                ? L('로그인', 'Sign in')
                : isSignUp
                  ? L('로그인', 'Sign in')
                  : L('회원가입', 'Sign up')}
            </button>
          </p>
          </div>
        </div>

        {/* Escape hatch — anon users can keep exploring */}
        <div className="text-center mt-5">
          <LocaleLink
            href="/workspace"
            className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
          >
            {L(`로그인 없이 계속 → 하루 ${ANON_LIMIT}회 무료`, `Continue without login → ${ANON_LIMIT} free calls/day`)}
          </LocaleLink>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
