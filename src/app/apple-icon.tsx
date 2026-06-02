import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default async function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1a1410 0%, #2a2218 50%, #1c1917 100%)',
          position: 'relative',
        }}
      >
        {/* Soft gold glow */}
        <div
          style={{
            position: 'absolute',
            top: '15%',
            left: '15%',
            width: '70%',
            height: '70%',
            background: 'radial-gradient(ellipse, rgba(184, 150, 62, 0.25) 0%, transparent 70%)',
          }}
        />
        {/* Letter mark */}
        <div
          style={{
            display: 'flex',
            fontSize: 120,
            fontWeight: 800,
            letterSpacing: '-0.04em',
            background: 'linear-gradient(135deg, #d4b968 0%, #96782e 100%)',
            backgroundClip: 'text',
            color: 'transparent',
            position: 'relative',
            lineHeight: 1,
          }}
        >
          A
        </div>
        {/* Bottom accent */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 3,
            background: 'linear-gradient(90deg, transparent, #b8963e 50%, transparent)',
          }}
        />
      </div>
    ),
    { ...size }
  );
}
