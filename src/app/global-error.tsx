'use client';

import { useEffect, useState } from 'react';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
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
          fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          textAlign: 'center',
        }}
      >
        <main style={{ boxSizing: 'border-box', width: '100%', maxWidth: 420, padding: 24 }}>
          <p style={{ fontSize: 12, letterSpacing: '0.24em', opacity: 0.55, margin: 0 }}>ARGUS</p>
          <h1 style={{ fontSize: 22, margin: '12px 0 8px' }}>{ko ? '문제가 생겼어요' : 'Something went wrong'}</h1>
          <p style={{ fontSize: 14, opacity: 0.78, margin: 0, lineHeight: 1.65 }}>
            {ko
              ? '잠깐 스친 문제일 가능성이 커요. 이미 저장한 내용은 이 브라우저에 그대로 남아 있습니다.'
              : 'Most likely a passing problem. Anything already saved remains in this browser.'}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 22,
              minHeight: 44,
              padding: '10px 24px',
              borderRadius: 10,
              border: 'none',
              background: '#b8963e',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {ko ? '다시 시도' : 'Try again'}
          </button>
        </main>
      </body>
    </html>
  );
}
