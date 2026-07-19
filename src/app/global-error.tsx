'use client';

import { useEffect, useState } from 'react';

/**
 * Last line of defense — fires only when the root layout itself fails, so
 * nothing from globals.css or the app shell can be assumed. Inline styles,
 * parchment-and-ink palette, both languages (no locale machinery available).
 */

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [locale, setLocale] = useState<'ko' | 'en'>('ko');
  useEffect(() => {
    setLocale(window.location.pathname === '/en' || window.location.pathname.startsWith('/en/') ? 'en' : 'ko');
  }, []);
  const ko = locale === 'ko';

  return (
    <html lang={locale}>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f4ede0',
          color: '#1a2a3a',
          fontFamily:
            "Pretendard, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          textAlign: 'center',
        }}
      >
        <div style={{ padding: 24, maxWidth: 420 }}>
          <p style={{ fontSize: 12, letterSpacing: '0.24em', opacity: 0.55, margin: 0 }}>ARGUS</p>
          <h1 style={{ fontSize: 22, margin: '12px 0 8px' }}>{ko ? '문제가 생겼어요' : 'Something went wrong'}</h1>
          <p style={{ fontSize: 14, opacity: 0.78, margin: 0, lineHeight: 1.65 }}>
            {ko
              ? '잠깐 스친 문제일 가능성이 커요. 이미 저장된 내용은 이 브라우저에 남아 있습니다.'
              : 'Most likely a passing problem. Anything already saved remains in this browser.'}
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 22,
              padding: '10px 24px',
              borderRadius: 10,
              border: 'none',
              background: '#b8963e',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              minHeight: 44,
            }}
          >
            {ko ? '다시 시도' : 'Try again'}
          </button>
        </div>
      </body>
    </html>
  );
}
