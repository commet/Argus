import type { Metadata } from 'next';

const META = {
  ko: { title: '수정 반영 — Argus', description: '피드백을 반영하여 수렴합니다.' },
  en: { title: 'Refine — Argus', description: 'Apply feedback and converge to the final draft.' },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const lang: 'ko' | 'en' = locale === 'ko' ? 'ko' : 'en';
  return META[lang];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
