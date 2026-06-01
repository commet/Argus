import type { Metadata } from 'next';
import { headers } from 'next/headers';

const META = {
  ko: { title: '문제 재정의 — Argus', description: '숨겨진 전제를 발견하고 문제를 재정의합니다.' },
  en: { title: 'Reframe — Argus', description: 'Surface hidden assumptions and redefine the question.' },
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
