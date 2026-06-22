import type { Metadata } from 'next';
import { headers } from 'next/headers';

const META = {
  ko: { title: '종합 — Argus', description: '다중 관점을 통합하여 최종 판단을 내립니다.' },
  en: { title: 'Synthesize — Argus', description: 'Integrate multiple perspectives into a final call.' },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const first = (h.get('accept-language') || '').split(',')[0]?.toLowerCase() ?? '';
  const lang: 'ko' | 'en' = first.startsWith('ko') ? 'ko' : 'en';
  return META[lang];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
