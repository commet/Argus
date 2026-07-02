import type { Metadata } from 'next';

const META = {
  ko: { title: '문서 검수 — Argus', description: '문서의 숨은 전제와 검증 의무를 표면화합니다.' },
  en: { title: 'Document Review — Argus', description: 'Surface the hidden assumptions and judgment obligations in your document.' },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const lang: 'ko' | 'en' = locale === 'ko' ? 'ko' : 'en';
  return META[lang];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
