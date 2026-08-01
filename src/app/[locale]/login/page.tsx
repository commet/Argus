'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { LocaleLink } from '@/components/ui/LocaleLink';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { useLocale } from '@/hooks/useLocale';
import { useLocaleRouter } from '@/hooks/useLocaleRouter';
import { Zap, FolderOpen, Users, MessageSquare, MailCheck, Mail, Lock, User, Check } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { safePostAuthRedirect } from '@/lib/auth-redirect';

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
  const [signupSentTo, setSignupSentTo] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const turnstileRef = useRef<TurnstileInstance>(null);
  const authTitle = isReset
    ? L('비밀번호 재설정', 'Reset your password')
    : isSignUp
      ? L('Argus 시작하기', 'Create your Argus account')
      : L('Argus에 로그인', 'Sign in to Argus');
  const authDescription = isReset
    ? L('이메일로 안전한 재설정 링크를 보내드려요.', 'We’ll email you a secure reset link.')
    : isSignUp
      ? L('결정 기록을 저장하고 어디서든 이어가세요.', 'Save your decision records and continue anywhere.')
      : L('저장한 결정 기록을 이어서 보려면 로그인해 주세요.', 'Sign in to continue with your saved decision records.');

  // Handle error/redirect params from middleware or callback
  useEffect(() => {
    const errorParam = searchParams.get('error');
    const errors = getAuthErrors(locale);
    if (errorParam && errors[errorParam]) {
      setError(errors[errorParam]);
    }
  }, [searchParams, locale]);

  // `?signup=1` — 봉인 직후처럼 "가입하러 왔다"가 이미 확실한 진입은 가입 모드로
  // 연다. 전에는 로그인 모드로 떨어져서, 방금 봉인한 사람이 "이메일로 가입하기"를
  // 누르고도 **가입 폼이 아닌 화면**을 만나 한 번 더 전환 링크를 찾아야 했다.
  // 폼 자체는 복제하지 않는다 — 약관·개인정보 동의와 캡차가 두 곳에 생기면
  // 한쪽만 고쳐지는 날이 온다. 여기 정본 하나에 정확히 데려다 놓는 것으로 족하다.
  useEffect(() => {
    if (searchParams.get('signup') === '1') setIsSignUp(true);
  }, [searchParams]);

  useEffect(() => {
    if (!loading && user) {
      router.replace(safePostAuthRedirect(searchParams.get('redirect')));
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
      if (password.length < 8) {
        setError(L('비밀번호는 8자 이상이어야 해요.', 'Password must be at least 8 characters.'));
        setSubmitting(false);
        return;
      }
      const { error } = await signUpWithEmail(email, password, captchaToken || undefined, { name, role });
      if (error) {
        setError(error);
        turnstileRef.current?.reset();
        setCaptchaToken('');
      } else {
        setSignupSentTo(email);
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
        <div className="text-center" role="status" aria-live="polite">
          <div aria-hidden="true" className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin motion-reduce:animate-none mx-auto mb-3" />
          {/* 09 S7: a silent circle reads as a hang — one line of machine-state fact. */}
          <p className="text-[13px] text-[var(--text-secondary)]">{L('세션을 확인하는 중이에요…', 'Checking your session…')}</p>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center" role="status" aria-live="polite">
          <div aria-hidden="true" className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin motion-reduce:animate-none mx-auto mb-3" />
          <p className="text-[13px] text-[var(--text-secondary)]">{L('워크스페이스로 이동 중...', 'Taking you to the workspace...')}</p>
        </div>
      </div>
    );
  }

  if (signupSentTo) {
    return (
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px] text-center">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center border border-[var(--accent)]/20 shadow-[0_2px_8px_rgba(184,150,62,0.18),0_6px_16px_rgba(184,150,62,0.08),inset_0_1px_0_rgba(255,255,255,0.5)]" style={{ background: 'var(--gradient-gold)' }}>
            <MailCheck size={26} className="text-white" />
          </div>
          <h1 className="text-[20px] font-bold text-[var(--text-primary)] mb-2">{L('확인 메일을 보냈어요', 'Check your email')}</h1>
          <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
            {L(`${signupSentTo}로 보낸 메일의 링크를 누르면 가입이 끝나요.`, `Click the link in the email we sent to ${signupSentTo} to finish signing up.`)}
          </p>
          <p className="text-[12.5px] text-[var(--text-tertiary)] mt-3 leading-relaxed">
            {L('메일이 안 보이면 스팸함도 확인해 주세요 — 도착까지 1~2분 걸릴 수 있어요.', 'Don’t see it? Check your spam folder — it can take a minute or two.')}
          </p>
          <button
            onClick={() => { setSignupSentTo(null); setMessage(''); }}
            className="mt-6 text-[13px] font-medium text-[var(--accent)] hover:underline cursor-pointer"
          >
            {L('다른 이메일로 다시 시도', 'Use a different email')}
          </button>
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
        {/* Logo — 단일 정본 컴포넌트 (Header와 동일 락업) */}
        <div className="text-center mb-6">
          <div className="mb-3"><Logo size="lg" /></div>
          <h1 className="text-[20px] font-bold text-[var(--text-primary)]">{authTitle}</h1>
          <p className="text-[14px] text-[var(--text-secondary)]">
            {authDescription}
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
                <span>{L('기기가 바뀌어도 저장한 판단과 확인일 이어보기', 'Keep saved judgments and review dates across devices')}</span>
              </li>
              <li className="flex items-start gap-2">
                <FolderOpen size={14} className="text-[var(--accent)] shrink-0 mt-0.5" />
                <span>{L('프로젝트 저장 · 다음에 이어서 작업', 'Save projects and pick up where you left off')}</span>
              </li>
              <li className="flex items-start gap-2">
                <Users size={14} className="text-[var(--accent)] shrink-0 mt-0.5" />
                <span>{L('판단 기록을 초대한 사람과 공유 · 의견 모으기', 'Share judgment records with invited people and gather feedback')}</span>
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
            onClick={async () => {
              setError('');
              setSubmitting(true);
              const { error: googleError } = await signInWithGoogle(
                safePostAuthRedirect(searchParams.get('redirect')),
              );
              if (googleError) {
                setError(googleError);
                setSubmitting(false);
              }
            }}
            aria-busy={submitting}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-[var(--border)] shadow-[var(--shadow-xs)] hover:shadow-[var(--shadow-sm)] hover:border-[var(--accent)] hover:bg-[var(--ai)]/30 transition-all cursor-pointer text-[14px] font-semibold text-[var(--text-primary)]"
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {L('Google로 시작하기', 'Continue with Google')}
          </button>
          <p className="text-[12.5px] text-[var(--text-tertiary)] text-center leading-relaxed">
            {locale === 'ko' ? (
              <>시작하면 <LocaleLink href="/terms" target="_blank" className="text-[var(--accent)] hover:underline">이용약관</LocaleLink> 및 <LocaleLink href="/privacy" target="_blank" className="text-[var(--accent)] hover:underline">개인정보처리방침</LocaleLink>에 동의합니다</>
            ) : (
              <>By continuing you agree to our <LocaleLink href="/terms" target="_blank" className="text-[var(--accent)] hover:underline">Terms</LocaleLink> and <LocaleLink href="/privacy" target="_blank" className="text-[var(--accent)] hover:underline">Privacy Policy</LocaleLink></>
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
                <label htmlFor="auth-name" className="mb-1.5 block px-1 text-[12px] font-semibold text-[var(--text-secondary)]">
                  {L('이름 (선택)', 'Name (optional)')}
                </label>
                <div className="relative group">
                  <User size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] transition-colors group-focus-within:text-[var(--accent)]" />
                  <input
                    id="auth-name"
                    type="text"
                    maxLength={40}
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={L('어떻게 불러드릴까요? (선택)', 'What should we call you? (optional)')}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border-[1.5px] border-[var(--border)] bg-[var(--bg)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--gold-muted),var(--glow-accent)] transition-all"
                  />
                </div>
                <p className="mt-1 px-1 text-[12.5px] text-[var(--text-tertiary)] leading-snug">
                  {L('판단을 다시 볼 때 이 이름으로 인사하고, 결정 기록에 함께 남겨요.', 'We greet you by this name and keep it with your decision log.')}
                </p>
              </div>
            )}
            {isSignUp && (
              <fieldset>
                <legend className="mb-1.5 px-1 text-[12px] text-[var(--text-secondary)]">
                  {L('무슨 일을 하세요? (선택 — 건너뛰어도 돼요)', 'What do you do? (optional — feel free to skip)')}
                </legend>
                <div className="grid grid-cols-3 gap-1.5">
                  {SIGNUP_ROLES.map((r) => {
                    const active = role === r.id;
                    return (
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => setRole(active ? '' : r.id)}
                        aria-pressed={active}
                        className={`w-full px-2 py-2 rounded-lg text-[12.5px] text-center border transition-all cursor-pointer ${
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
              </fieldset>
            )}
            <div>
              <label htmlFor="auth-email" className="mb-1.5 block px-1 text-[12px] font-semibold text-[var(--text-secondary)]">
                {L('이메일', 'Email')}
              </label>
              <div className="relative group">
                <Mail size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] transition-colors group-focus-within:text-[var(--accent)]" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={L('이메일', 'Email')}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border-[1.5px] border-[var(--border)] bg-[var(--bg)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--gold-muted),var(--glow-accent)] transition-all"
                />
              </div>
            </div>
            {!isReset && (
              <div>
                <label htmlFor="auth-password" className="mb-1.5 block px-1 text-[12px] font-semibold text-[var(--text-secondary)]">
                  {L('비밀번호', 'Password')}
                </label>
                <div className="relative group">
                  <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] transition-colors group-focus-within:text-[var(--accent)]" />
                  <input
                    id="auth-password"
                    type="password"
                    required
                    minLength={8}
                    maxLength={128}
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={L('8자 이상', '8+ characters')}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border-[1.5px] border-[var(--border)] bg-[var(--bg)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--gold-muted),var(--glow-accent)] transition-all"
                  />
                </div>
              </div>
            )}

            {error && (
              <p role="alert" className="text-[12px] text-[var(--danger)] bg-[var(--danger)]/10 border border-[var(--danger)]/25 rounded-lg px-3 py-2">{error}</p>
            )}
            {message && (
              <p role="status" aria-live="polite" className="text-[12px] text-[var(--success)] bg-[var(--success)]/10 border border-[var(--success)]/25 rounded-lg px-3 py-2">{message}</p>
            )}

            {/* Terms agreement on sign-up */}
            {isSignUp && (
              <div className="space-y-2 pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedTerms}
                    onChange={(e) => setAgreedTerms(e.target.checked)}
                    className="peer sr-only"
                  />
                  <span className={`mt-0.5 grid place-items-center w-[18px] h-[18px] shrink-0 rounded-[6px] border-[1.5px] transition-all peer-focus-visible:shadow-[0_0_0_3px_var(--gold-muted)] ${
                    agreedTerms ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--border)] bg-[var(--bg)]'
                  }`}>
                    {agreedTerms && <Check size={12} strokeWidth={3} className="text-white" />}
                  </span>
                  <span className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
                    <span className="text-[var(--danger)]">{L('[필수]', '[Required]')}</span>{' '}
                    {locale === 'ko' ? (
                      <><LocaleLink href="/terms" target="_blank" className="text-[var(--accent)] underline">서비스 이용약관</LocaleLink>에 동의합니다</>
                    ) : (
                      <>I agree to the <LocaleLink href="/terms" target="_blank" className="text-[var(--accent)] underline">Terms of Service</LocaleLink></>
                    )}
                  </span>
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedPrivacy}
                    onChange={(e) => setAgreedPrivacy(e.target.checked)}
                    className="peer sr-only"
                  />
                  <span className={`mt-0.5 grid place-items-center w-[18px] h-[18px] shrink-0 rounded-[6px] border-[1.5px] transition-all peer-focus-visible:shadow-[0_0_0_3px_var(--gold-muted)] ${
                    agreedPrivacy ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--border)] bg-[var(--bg)]'
                  }`}>
                    {agreedPrivacy && <Check size={12} strokeWidth={3} className="text-white" />}
                  </span>
                  <span className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
                    <span className="text-[var(--danger)]">{L('[필수]', '[Required]')}</span>{' '}
                    {locale === 'ko' ? (
                      <><LocaleLink href="/privacy" target="_blank" className="text-[var(--accent)] underline">개인정보처리방침</LocaleLink>에 동의합니다</>
                    ) : (
                      <>I agree to the <LocaleLink href="/privacy" target="_blank" className="text-[var(--accent)] underline">Privacy Policy</LocaleLink></>
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
              aria-busy={submitting}
              disabled={submitting || (isSignUp && (!agreedTerms || !agreedPrivacy || (!!TURNSTILE_SITE_KEY && !captchaToken)))}
              className="w-full px-4 py-3 rounded-xl bg-[var(--primary)] text-[var(--bg)] text-[14px] font-semibold hover:bg-[var(--primary-light)] hover:shadow-[var(--shadow-sm)] disabled:opacity-50 disabled:hover:shadow-none transition-all cursor-pointer"
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
              type="button"
              onClick={() => { setIsReset(true); setError(''); setMessage(''); }}
              className="inline-flex min-h-11 w-full items-center justify-center text-center text-[12px] text-[var(--text-tertiary)] hover:text-[var(--accent)] cursor-pointer transition-colors"
            >
              {L('비밀번호를 잊으셨나요?', 'Forgot your password?')}
            </button>
          )}

          {/* Toggle Sign Up / Sign In / Reset */}
          <div className="flex min-h-11 items-center justify-center text-center text-[13px] text-[var(--text-secondary)]">
            <span>{isReset
              ? L('비밀번호가 기억나셨나요?', 'Remembered your password?')
              : isSignUp
                ? L('이미 계정이 있으신가요?', 'Already have an account?')
                : L('처음이신가요?', 'New here?')}</span>
            <button
              type="button"
              onClick={() => { setIsSignUp(isReset ? false : !isSignUp); setIsReset(false); setError(''); setMessage(''); }}
              className="ml-0.5 inline-flex min-h-11 items-center px-1 text-[var(--accent)] font-semibold hover:underline cursor-pointer"
            >
              {isReset
                ? L('로그인', 'Sign in')
                : isSignUp
                  ? L('로그인', 'Sign in')
                  : L('회원가입', 'Sign up')}
            </button>
          </div>
          </div>
        </div>

        {/* Escape hatch — anon users can keep exploring */}
        <div className="text-center mt-5">
          <LocaleLink
            href="/workspace"
            className="inline-flex min-h-11 items-center text-[12px] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
          >
            {L('로그인 없이 계속 →', 'Continue without login →')}
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
