import type { Metadata } from 'next';
import { headers } from 'next/headers';

const META = {
  ko: { title: '사전 검증 — Argus', description: '이해관계자 반응을 시뮬레이션합니다.' },
  en: { title: 'Rehearse — Argus', description: 'Simulate how stakeholders will react.' },
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
