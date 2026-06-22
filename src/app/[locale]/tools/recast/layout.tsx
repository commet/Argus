import type { Metadata } from 'next';

const META = {
  ko: { title: '실행 설계 — Argus', description: '구조와 역할을 설계합니다.' },
  en: { title: 'Recast — Argus', description: 'Design the structure and split of roles.' },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const lang: 'ko' | 'en' = locale === 'ko' ? 'ko' : 'en';
  return META[lang];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
