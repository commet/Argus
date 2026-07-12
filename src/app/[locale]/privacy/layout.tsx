import type { Metadata } from 'next';

const META = {
  ko: { title: '개인정보처리방침 — Argus' },
  en: { title: 'Privacy Policy — Argus' },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return META[locale === 'ko' ? 'ko' : 'en'];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
