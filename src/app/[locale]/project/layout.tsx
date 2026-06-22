import type { Metadata } from 'next';

const META = {
  ko: { title: '프로젝트 — Argus' },
  en: { title: 'Project — Argus' },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const lang: 'ko' | 'en' = locale === 'ko' ? 'ko' : 'en';
  return META[lang];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
