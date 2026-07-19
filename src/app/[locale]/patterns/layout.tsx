import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return locale === 'ko'
    ? { title: '판단 패턴 — Argus', description: '근거를 확인한 뒤 공개된 판단 패턴을 살펴봅니다.' }
    : { title: 'Decision Patterns — Argus', description: 'Explore decision patterns published after evidence review.' };
}

export default function PatternsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
