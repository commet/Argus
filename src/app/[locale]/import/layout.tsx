import type { Metadata } from 'next';

const META = {
  ko: { title: '플러그인 기록 가져오기 — Argus', description: '터미널에서 봉인한 판단 기록을 Argus 계정에 연결합니다.' },
  en: { title: 'Import plugin records — Argus', description: 'Connect judgments sealed in the terminal to your Argus account.' },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return META[locale === 'ko' ? 'ko' : 'en'];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
