export function SkipLink({ locale }: { locale: 'ko' | 'en' }) {
  return (
    <a
      href="#main-content"
      className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-lg bg-[var(--text-primary)] px-4 py-3 text-[13px] font-bold text-[var(--surface)] shadow-lg transition-transform focus:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
    >
      {locale === 'ko' ? '본문으로 건너뛰기' : 'Skip to main content'}
    </a>
  );
}
