/**
 * PlateLabel — the consistent " § N · TITLE " mono header used at the top
 * of each Act. Connecting hairlines on either side give it the formality
 * of an 18th-c. plate caption.
 */

export function PlateLabel({
  numeral,
  title,
  align = 'center',
  className,
}: {
  numeral: string;     // e.g. "I", "II", "III"
  title: string;       // already-localized
  align?: 'center' | 'left';
  className?: string;
}) {
  const isCenter = align === 'center';
  // Hangul inherits the heavy mono tracking and reads loose/disjointed — tighten
  // it when the (already-localized) title contains Korean; keep Latin formal.
  const hasKo = /[가-힣]/.test(title);
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCenter ? 'center' : 'flex-start',
        gap: 14,
      }}
    >
      {isCenter && <span aria-hidden="true" style={{ width: 36, height: 1, background: 'var(--bp-ink-faint)' }} />}
      <span
        className="bp-mono"
        style={{
          color: 'var(--bp-ink-soft)',
          fontSize: 11.5,
          letterSpacing: hasKo ? '0.15em' : '0.32em',
          textTransform: 'uppercase',
          fontWeight: 500,
          whiteSpace: 'nowrap',
        }}
      >
        § {numeral} · {title}
      </span>
      {isCenter && <span aria-hidden="true" style={{ width: 36, height: 1, background: 'var(--bp-ink-faint)' }} />}
    </div>
  );
}
