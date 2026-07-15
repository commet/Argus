import { LocaleLink } from '@/components/ui/LocaleLink';

/**
 * Argus 브랜드 락업 — 금색 배지("A") + 워드마크. 예전엔 Header·로그인이 같은
 * 락업을 각자 다시 그려 색(--primary/--text-primary)·크기·굵기·배지 라운드가
 * 어긋났다. 단일 정본으로 통일한다. (공유페이지·히어로의 다른 락업은 별개.)
 */
const SIZES = {
  sm: { badge: 'w-7 h-7 rounded-[8px]', a: 'text-[12px]', word: 'text-[15px]' },
  md: { badge: 'w-8 h-8 rounded-[9px]', a: 'text-[13px]', word: 'text-[18px]' },
  lg: { badge: 'w-9 h-9 rounded-[10px]', a: 'text-[15px]', word: 'text-[22px]' },
} as const;

export function Logo({
  size = 'md',
  href,
  className = '',
}: {
  size?: keyof typeof SIZES;
  /** 링크로 감쌀 경로(로케일 자동). 생략하면 순수 마크만 렌더. */
  href?: string;
  className?: string;
}) {
  const s = SIZES[size];
  const mark = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span
        className={`${s.badge} flex items-center justify-center shadow-[var(--shadow-sm)] group-hover:shadow-[var(--glow-gold)] transition-all duration-300`}
        style={{ background: 'var(--gradient-gold)' }}
      >
        <span className={`text-[var(--accent-fg)] font-black ${s.a} tracking-tight`}>A</span>
      </span>
      <span className={`text-[var(--text-primary)] font-extrabold ${s.word} tracking-tight`}>Argus</span>
    </span>
  );
  return href ? (
    <LocaleLink href={href} className="group inline-flex items-center">
      {mark}
    </LocaleLink>
  ) : (
    mark
  );
}
