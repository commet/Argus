import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Argus — 내 전문 분야가 아닌 걸 해야 할 때';
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

        {/* Subtle staff lines */}
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: `${180 + i * 18}px`,
              left: '80px',
              right: '80px',
              height: '1px',
              background: 'rgba(184, 150, 62, 0.06)',
            }}
          />
        ))}

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

          {/* Main title */}
          <div
            style={{
              fontSize: '52px',
              fontWeight: 800,
              lineHeight: 1.2,
              color: '#fafaf9',
              letterSpacing: '-0.02em',
            }}
          >
            내 전문 분야가 아닌 걸
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
            해야 할 때.
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
            질문 하나 던지면, 30초 안에 뼈대가 나옵니다.
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
