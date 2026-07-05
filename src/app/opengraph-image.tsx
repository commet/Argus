import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Argus — So, how did it turn out?';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #1a1410 0%, #2a2218 40%, #1c1917 100%)',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Gold accent glow */}
        <div
          style={{
            position: 'absolute',
            top: '-20%',
            left: '30%',
            width: '40%',
            height: '60%',
            background: 'radial-gradient(ellipse, rgba(184, 150, 62, 0.15) 0%, transparent 70%)',
          }}
        />

        {/* Sea-chart graticule — replaces the retired staff lines (music era) */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(184, 150, 62, 0.055) 0px, rgba(184, 150, 62, 0.055) 1px, transparent 1px, transparent 63px), repeating-linear-gradient(90deg, rgba(184, 150, 62, 0.055) 0px, rgba(184, 150, 62, 0.055) 1px, transparent 1px, transparent 63px)',
          }}
        />

        {/* Decision trail — waypoints crossing the chart, arriving at gold */}
        <svg
          width="1200"
          height="200"
          viewBox="0 0 1200 200"
          style={{ position: 'absolute', bottom: 30, left: 0 }}
        >
          <path
            d="M 80 160 C 280 150, 380 120, 560 110 C 740 100, 860 80, 1050 56"
            fill="none"
            stroke="rgba(212, 185, 104, 0.4)"
            strokeWidth="2"
            strokeDasharray="2 9"
          />
          <circle cx="80" cy="160" r="5" fill="none" stroke="rgba(250, 250, 249, 0.35)" strokeWidth="2" />
          <circle cx="430" cy="118" r="5" fill="none" stroke="rgba(250, 250, 249, 0.35)" strokeWidth="2" />
          <circle cx="720" cy="98" r="7" fill="none" stroke="rgba(212, 185, 104, 0.55)" strokeWidth="2" />
          <circle cx="1050" cy="56" r="9" fill="#d4b968" />
          <circle cx="1050" cy="56" r="17" fill="none" stroke="rgba(212, 185, 104, 0.45)" strokeWidth="2" />
        </svg>

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
            padding: '0 80px',
            textAlign: 'center',
            position: 'relative',
          }}
        >
          {/* Brand */}
          <div
            style={{
              fontSize: '22px',
              fontWeight: 700,
              letterSpacing: '0.15em',
              color: 'rgba(184, 150, 62, 0.8)',
              textTransform: 'uppercase' as const,
            }}
          >
            ARGUS
          </div>

          {/* Main title — English primary (a shared link can land on anyone) */}
          <div
            style={{
              fontSize: '52px',
              fontWeight: 800,
              lineHeight: 1.2,
              color: '#fafaf9',
              letterSpacing: '-0.02em',
            }}
          >
            &ldquo;So &mdash; how did
          </div>
          <div
            style={{
              fontSize: '52px',
              fontWeight: 800,
              lineHeight: 1.2,
              background: 'linear-gradient(135deg, #d4b968 0%, #96782e 100%)',
              backgroundClip: 'text',
              color: 'transparent',
              letterSpacing: '-0.02em',
              marginTop: '-16px',
            }}
          >
            it turn out?&rdquo;
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: '20px',
              color: 'rgba(250, 250, 249, 0.5)',
              lineHeight: 1.5,
              marginTop: '8px',
            }}
          >
            Navigate a big decision like a voyage — then return, on the date you set, to ask.
          </div>

          {/* Korean brand echo — keeps the origin voice under the English hook */}
          <div
            style={{
              fontSize: '17px',
              color: 'rgba(184, 150, 62, 0.6)',
              lineHeight: 1.5,
            }}
          >
            중요한 결정을 항해처럼 — 정한 날에 돌아와 묻습니다.
          </div>
        </div>

        {/* Bottom accent line */}
        <div
          style={{
            position: 'absolute',
            bottom: '0',
            left: '0',
            right: '0',
            height: '4px',
            background: 'linear-gradient(90deg, transparent 0%, #b8963e 30%, #d4b968 50%, #b8963e 70%, transparent 100%)',
          }}
        />
      </div>
    ),
    { ...size }
  );
}
