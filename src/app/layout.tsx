import type { Metadata, Viewport } from 'next';
import { headers, cookies } from 'next/headers';
import { buildLocaleAlternates } from '@/lib/locale-path';
import './globals.css';

const SITE_URL = 'https://argus.voyage';

// viewportFit:'cover' is what makes env(safe-area-inset-*) resolve to real
// values on notched iOS devices — without it the insets are 0 and our fixed
// bottom bars sit under the home indicator. width/initial-scale restate the
// Next.js default so this export fully replaces (not merges with) it.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

type Lang = 'ko' | 'en';

const META_STRINGS: Record<Lang, { title: string; description: string; descriptionShort: string; descriptionTwitter: string; ogLocale: string }> = {
  ko: {
    title: 'Argus — 결정을 다음 움직임으로',
    description: '막힌 결정을 다음 움직임으로 바꾸고, 현실이 답할 때 돌아와 결과를 다음 판단의 규칙으로 남깁니다.',
    descriptionShort: '막힌 결정을 다음 움직임으로 바꾸고, 현실이 답하면 다음 판단까지 이어갑니다.',
    descriptionTwitter: '결정을 다음 움직임으로. 현실이 답하면, 다음 판단까지.',
    ogLocale: 'ko_KR',
  },
  en: {
    title: 'Argus — Turn decisions into movement',
    description: 'Turn a stuck decision into one observable next move, then return when reality can shape the next call.',
    descriptionShort: 'Turn a stuck decision into a next move, then return when reality answers.',
    descriptionTwitter: 'Turn decisions into movement. Let reality shape the next call.',
    ogLocale: 'en_US',
  },
};

function pickLangFromAcceptLanguage(header: string | null): Lang {
  if (!header) return 'en';
  const first = header.split(',')[0]?.toLowerCase() ?? '';
  return first.startsWith('ko') ? 'ko' : 'en';
}

/**
 * Resolve the SSR language. Priority:
 *   1. x-locale header — the value the proxy already resolved for this request
 *      (it folds in the [locale] route segment / ?lang / argus-locale cookie /
 *      Accept-Language), so in the routed world this is authoritative.
 *   2. argus-locale cookie — the user's explicit choice, as a fallback if the
 *      proxy header is somehow absent.
 *   3. Accept-Language — when no explicit choice has been made.
 */
async function resolveLang(): Promise<Lang> {
  const h = await headers();
  const fromHeader = h.get('x-locale');
  if (fromHeader === 'ko' || fromHeader === 'en') return fromHeader;
  const cookieLang = (await cookies()).get('argus-locale')?.value;
  if (cookieLang === 'ko' || cookieLang === 'en') return cookieLang;
  return pickLangFromAcceptLanguage(h.get('accept-language'));
}

export async function generateMetadata(): Promise<Metadata> {
  const lang = await resolveLang();
  const m = META_STRINGS[lang];
  // The locale-less path of THIS request (set by proxy.ts), e.g. '' or '/guide'.
  // Without it every page would inherit the homepage's canonical/hreflang and
  // Google would treat sub-pages as duplicates of the locale homepage.
  const path = (await headers()).get('x-pathname') || '';

  return {
    title: m.title,
    description: m.description,
    metadataBase: new URL(SITE_URL),
    alternates: buildLocaleAlternates(SITE_URL, lang, path),
    openGraph: {
      title: m.title,
      description: m.descriptionShort,
      url: `${SITE_URL}/${lang}${path}`,
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
    <html lang={lang} suppressHydrationWarning data-scroll-behavior="smooth">
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
        {/* Nanum Myeongjo — a classical Korean serif used for the hero film's
            Homeric quotes AND the decision-voyage SeaChart's Korean labels, so
            both read as old print, distinct from the UI's Noto Serif KR. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&display=swap"
        />
        {/* Cormorant Garamond — an elegant high-contrast Garamond for the
            SeaChart's Latin cartographic labels / cartouche / compass: reads as
            fine engraving rather than blunt press ink (see --font-chart). */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&display=swap"
        />
        {/* Theme resolution (pre-paint, no FOUC). Stored 'argus-theme' is
            'light' | 'dark' | 'system'. When UNSET the default is surface-aware
            (option C): the landing '/' — the brand's first impression — forces
            light, while the app follows the OS. An explicit choice always wins. */}
        <script suppressHydrationWarning nonce={nonce} dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('argus-theme');var p=location.pathname.replace(/^\\/(ko|en)(?=\\/|$)/,'')||'/';var sys=window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches;var d;if(t==='dark')d=true;else if(t==='light')d=false;else if(t==='system')d=!!sys;else d=(p==='/')?false:!!sys;if(d)document.documentElement.setAttribute('data-theme','dark');else document.documentElement.removeAttribute('data-theme');}catch(e){}})()` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
