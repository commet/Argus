import type { Metadata } from 'next';

const META = {
  ko: { title: '종합 — Argus', description: '다중 관점을 통합하여 최종 판단을 내립니다.' },
  en: { title: 'Synthesize — Argus', description: 'Integrate multiple perspectives into a final call.' },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const lang: 'ko' | 'en' = locale === 'ko' ? 'ko' : 'en';
  return META[lang];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
