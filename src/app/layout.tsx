import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { LayoutShell } from '@/components/layout/LayoutShell';
import { Providers } from '@/components/layout/Providers';
import { Analytics } from '@/components/layout/Analytics';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';

const SITE_URL = 'https://argus.voyage';

type Lang = 'ko' | 'en';

const META_STRINGS: Record<Lang, { title: string; description: string; descriptionShort: string; descriptionTwitter: string; ogLocale: string }> = {
  ko: {
    title: 'Argus — 내 전문 분야가 아닌 걸 해야 할 때',
    description: '질문 하나 던지면, 30초 안에 기획안 뼈대가 나옵니다. 채울수록 날카로워집니다. 인지과학 + 전략기획 실무 기반.',
    descriptionShort: '질문 하나 던지면, 30초 안에 기획안 뼈대가 나옵니다. 채울수록 날카로워집니다.',
    descriptionTwitter: '질문 하나 던지면, 30초 안에 기획안 뼈대가 나옵니다.',
    ogLocale: 'ko_KR',
  },
  en: {
    title: 'Argus — For work outside your expertise',
    description: 'Drop a question, get a draft proposal skeleton in 30 seconds. It sharpens as you fill it in. Built on cognitive science and strategic planning practice.',
    descriptionShort: 'Drop a question, get a draft proposal skeleton in 30 seconds. It sharpens as you fill it in.',
    descriptionTwitter: 'Drop a question, get a draft proposal skeleton in 30 seconds.',
    ogLocale: 'en_US',
  },
};

function pickLangFromAcceptLanguage(header: string | null): Lang {
  if (!header) return 'en';
  const first = header.split(',')[0]?.toLowerCase() ?? '';
  return first.startsWith('ko') ? 'ko' : 'en';
}

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const lang = pickLangFromAcceptLanguage(h.get('accept-language'));
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
  const lang = pickLangFromAcceptLanguage(h.get('accept-language'));

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
      </body>
    </html>
  );
}
