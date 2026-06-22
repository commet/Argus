import type { Metadata } from 'next';

const META = {
  ko: { title: '설정 — Argus' },
  en: { title: 'Settings — Argus' },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const lang: 'ko' | 'en' = locale === 'ko' ? 'ko' : 'en';
  return META[lang];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
