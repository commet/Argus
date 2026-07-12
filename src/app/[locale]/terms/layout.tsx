import type { Metadata } from 'next';

const META = {
  ko: { title: '서비스 이용약관 — Argus' },
  en: { title: 'Terms of Service — Argus' },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return META[locale === 'ko' ? 'ko' : 'en'];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
