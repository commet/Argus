import { ImageResponse } from 'next/og';
import { headers } from 'next/headers';

// Twitter / Facebook standard
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Boss Simulator — Rehearse before you speak';

// Render on first request and cache at the edge.
// Avoids local-build network fetches for the Pretendard webfont.
export const dynamic = 'force-dynamic';
export const revalidate = false;

// Pretendard from CDN — supports Korean glyphs AND Latin
const PRETENDARD_BOLD =
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/woff2/Pretendard-Bold.woff2';
const PRETENDARD_SEMIBOLD =
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/woff2/Pretendard-SemiBold.woff2';
const PRETENDARD_REGULAR =
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/woff2/Pretendard-Regular.woff2';

async function tryFetchFont(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    // Sanity-check: woff2 magic bytes are 'wOF2'. Any HTML/error page would fail this.
    const head = new Uint8Array(buf.slice(0, 4));
    const isWoff2 = head[0] === 0x77 && head[1] === 0x4f && head[2] === 0x46 && head[3] === 0x32;
    return isWoff2 ? buf : null;
  } catch {
    return null;
  }
}

interface Copy {
  brandSubtitle: string;
  userBubble: string;
  bossTag: string;
  bossLine: string;
  tagline: string;
  subtitle: string;
}

const COPY_KO: Copy = {
  brandSubtitle: '팀장 시뮬레이터',
  userBubble: '팀장님, 재택 좀 더 하고 싶은데요',
  bossTag: 'ENTJ · 호랑이띠',
  bossLine: '"그래서, 결과는 더 나오고?"',
  tagline: '팀장한테 할 말, 미리 들어보기',
  subtitle: '성격유형 + 타고난 결로 진짜 반응을 시뮬레이션',
};

const COPY_EN: Copy = {
  brandSubtitle: 'Boss Simulator',
  userBubble: 'Hey — could I work from home one day next week?',
  bossTag: 'ENTJ · The Bold Commander',
  bossLine: '"Sure. And how do the numbers move if you\'re remote?"',
  tagline: 'Got something to tell your boss? Hear it first.',
  subtitle: 'Personality + birth-energy → a simulation that actually lands',
};

function detectLocale(acceptLanguage: string | null): 'ko' | 'en' {
  if (!acceptLanguage) return 'ko';
  // First language token wins. Korean OS locales lead with 'ko-...' or 'ko_...'.
  const first = acceptLanguage.split(',')[0]?.toLowerCase().trim() ?? '';
  return first.startsWith('ko') ? 'ko' : 'en';
}

export default async function Image() {
  const h = await headers();
  const locale = detectLocale(h.get('accept-language'));
  const copy = locale === 'ko' ? COPY_KO : COPY_EN;

  // Best-effort font load. On Vercel these fetches succeed and Korean/Latin
  // glyphs render crisply. If they fail (e.g. sandboxed local build with no
  // outbound network), we fall back to ImageResponse's default font.
  const [bold, semibold, regular] = await Promise.all([
    tryFetchFont(PRETENDARD_BOLD),
    tryFetchFont(PRETENDARD_SEMIBOLD),
    tryFetchFont(PRETENDARD_REGULAR),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background:
            'radial-gradient(ellipse at top left, #2a1f17 0%, #1a1410 55%, #120e0b 100%)',
          padding: '64px 72px',
          fontFamily: 'Pretendard',
          position: 'relative',
        }}
      >
        {/* Subtle gold accent line top */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: 'linear-gradient(90deg, transparent, #d4a574 25%, #d4a574 75%, transparent)',
          }}
        />

        {/* Brand mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 56 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 11,
              background: 'linear-gradient(135deg, #e6b885, #b8895c)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 20,
              fontWeight: 900,
              boxShadow: '0 4px 12px rgba(212, 165, 116, 0.3)',
            }}
          >
            O
          </div>
          <span style={{ color: '#e8d8c0', fontSize: 24, fontWeight: 800, letterSpacing: '-0.01em' }}>
            Argus
          </span>
          <span style={{ color: '#5d5044', fontSize: 18, marginLeft: 8 }}>·</span>
          <span style={{ color: '#8a7e6e', fontSize: 18, fontWeight: 600 }}>{copy.brandSubtitle}</span>
        </div>

        {/* User line — mundane workplace question */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 22 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              background: '#3a2e26',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              flexShrink: 0,
            }}
          >
            🧑‍💼
          </div>
          <div
            style={{
              display: 'flex',
              background: 'rgba(255, 252, 245, 0.06)',
              border: '1px solid rgba(255, 252, 245, 0.1)',
              borderRadius: '20px 20px 20px 6px',
              padding: '18px 26px',
              maxWidth: 820,
            }}
          >
            <span style={{ color: '#e8e2d6', fontSize: 28, fontWeight: 500, lineHeight: 1.35 }}>
              {copy.userBubble}
            </span>
          </div>
        </div>

        {/* Boss reaction — the value prop, in character */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 14,
            marginLeft: 'auto',
            flexDirection: 'row-reverse',
            marginBottom: 'auto',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              background: 'linear-gradient(135deg, #4a3525, #2c1f17)',
              border: '1.5px solid rgba(212, 165, 116, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              flexShrink: 0,
            }}
          >
            👔
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              background: 'linear-gradient(135deg, rgba(212, 165, 116, 0.18), rgba(212, 165, 116, 0.08))',
              border: '1px solid rgba(212, 165, 116, 0.35)',
              borderRadius: '20px 20px 6px 20px',
              padding: '18px 26px',
              maxWidth: 820,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  color: '#d4a574',
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}
              >
                {copy.bossTag}
              </span>
            </div>
            <span style={{ color: '#fff8eb', fontSize: 32, fontWeight: 700, lineHeight: 1.3 }}>
              {copy.bossLine}
            </span>
          </div>
        </div>

        {/* Bottom tagline — the promise */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            marginTop: 56,
            paddingTop: 24,
            borderTop: '1px solid rgba(212, 165, 116, 0.15)',
          }}
        >
          <span style={{ color: '#f5ead6', fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em' }}>
            {copy.tagline}
          </span>
          <span style={{ color: '#8a7e6e', fontSize: 18, fontWeight: 500 }}>
            {copy.subtitle}
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      ...(regular && semibold && bold
        ? {
            fonts: [
              { name: 'Pretendard', data: regular, weight: 400 as const, style: 'normal' as const },
              { name: 'Pretendard', data: semibold, weight: 600 as const, style: 'normal' as const },
              { name: 'Pretendard', data: bold, weight: 800 as const, style: 'normal' as const },
            ],
          }
        : {}),
    },
  );
}
