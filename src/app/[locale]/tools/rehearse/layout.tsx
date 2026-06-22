import type { Metadata } from 'next';

const META = {
  ko: { title: '사전 검증 — Argus', description: '이해관계자 반응을 시뮬레이션합니다.' },
  en: { title: 'Rehearse — Argus', description: 'Simulate how stakeholders will react.' },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const lang: 'ko' | 'en' = locale === 'ko' ? 'ko' : 'en';
  return META[lang];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
