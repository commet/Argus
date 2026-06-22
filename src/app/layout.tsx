import type { Metadata } from 'next';
import { headers, cookies } from 'next/headers';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { LayoutShell } from '@/components/layout/LayoutShell';
import { Providers } from '@/components/layout/Providers';
import { Analytics } from '@/components/layout/Analytics';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { LocaleProvider } from '@/contexts/LocaleProvider';

const SITE_URL = 'https://argus.voyage';

type Lang = 'ko' | 'en';

const META_STRINGS: Record<Lang, { title: string; description: string; descriptionShort: string; descriptionTwitter: string; ogLocale: string }> = {
  ko: {
    title: 'Argus — 그래서, 어떻게 됐어요?',
    description: '중요한 결정을 그대로 적으면, 갈리는 자리를 보여주고 — 정한 날짜에 먼저 돌아와 묻습니다.',
    descriptionShort: '중요한 결정을 그대로 적으면, 갈리는 자리를 보여주고 — 정한 날짜에 먼저 돌아와 묻습니다.',
    descriptionTwitter: '중요한 결정을 그대로 적으면, 갈리는 자리를 보여주고 — 정한 날짜에 돌아와 묻습니다.',
    ogLocale: 'ko_KR',
  },
  en: {
    title: 'Argus — So, how did it go?',
    description: 'Write down a decision that matters, as-is — Argus shows you where things fork, and comes back first on the date you set to ask.',
    descriptionShort: 'Write down a decision that matters, as-is — Argus shows you where things fork, and comes back on the date you set to ask.',
    descriptionTwitter: 'Argus shows you where your decision forks — and comes back on the date you set to ask.',
    ogLocale: 'en_US',
  },
};

function pickLangFromAcceptLanguage(header: string | null): Lang {
  if (!header) return 'en';
  const first = header.split(',')[0]?.toLowerCase() ?? '';
  return first.startsWith('ko') ? 'ko' : 'en';
}

/**
 * Resolve the SSR language. The argus-locale cookie (set when the user makes an
 * explicit choice — see LocaleProvider / useLocaleSwitch) wins over the
 * browser's Accept-Language, so a returning user who chose Korean on an English
 * browser is served Korean from the first paint (no flash). Falls back to
 * Accept-Language when no explicit choice has been made.
 */
async function resolveLang(): Promise<Lang> {
  const cookieLang = (await cookies()).get('argus-locale')?.value;
  if (cookieLang === 'ko' || cookieLang === 'en') return cookieLang;
  const h = await headers();
  return pickLangFromAcceptLanguage(h.get('accept-language'));
}

export async function generateMetadata(): Promise<Metadata> {
  const lang = await resolveLang();
  const m = META_STRINGS[lang];

  return {
    title: m.title,
    description: m.description,
    metadataBase: new URL(SITE_URL),
    alternates: {
      canonical: SITE_URL,
      languages: {
        ko: `${SITE_URL}?lang=ko`,
        en: `${SITE_URL}?lang=en`,
      },
    },
    openGraph: {
      title: m.title,
      description: m.descriptionShort,
      url: SITE_URL,
      siteName: 'Argus',
      locale: m.ogLocale,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: m.title,
      description: m.descriptionTwitter,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const h = await headers();
  const nonce = h.get('x-nonce') || '';
  const lang = await resolveLang();

  return (
    <html lang={lang}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          integrity="sha384-GIdEBaqGN9mNkDkMkzMHW8EKUqtpPIe/sLj1X7DIrnc9uPtLROJgmuDlh+3rBw0j"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap"
        />
        <script suppressHydrationWarning nonce={nonce} dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('argus-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.setAttribute('data-theme','dark')}}catch(e){}})()` }} />
      </head>
      <body>
        <LocaleProvider locale={lang}>
          <Providers>
            <Analytics />
            <ErrorBoundary>
              <div className="min-h-screen flex flex-col">
                <Header />
                <div className="flex flex-1">
                  <LayoutShell>
                    {children}
                  </LayoutShell>
                </div>
              </div>
            </ErrorBoundary>
          </Providers>
        </LocaleProvider>
      </body>
    </html>
  );
}
