import { LocaleLink } from '@/components/ui/LocaleLink';
import { ArgusFaceMark, type ArgusFaceMarkSize } from '@/components/brand/ArgusFaceMark';

/**
 * Argus 브랜드 락업 — 정본 얼굴 + 워드마크. Header·로그인이 같은
 * 락업을 각자 다시 그려 색(--primary/--text-primary)·크기·굵기·배지 라운드가
 * 어긋났다. 단일 정본으로 통일한다. (공유페이지·히어로의 다른 락업은 별개.)
 */
const SIZES = {
  sm: { face: 'sm' as ArgusFaceMarkSize, word: 'text-[15px]' },
  md: { face: 'md' as ArgusFaceMarkSize, word: 'text-[18px]' },
  lg: { face: 'lg' as ArgusFaceMarkSize, word: 'text-[22px]' },
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
      <ArgusFaceMark size={s.face} />
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
