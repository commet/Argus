import type { Metadata } from 'next';

const META = {
  ko: { title: '사용 가이드 — Argus', description: 'Argus의 사용 흐름과 각 도구의 목적.' },
  en: { title: 'Guide — Argus', description: 'How to use Argus and what each tool is for.' },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const lang: 'ko' | 'en' = locale === 'ko' ? 'ko' : 'en';
  return META[lang];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
