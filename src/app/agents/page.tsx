import { AgentHub } from '@/components/agents/AgentHub';
import { headers } from 'next/headers';
import type { Metadata } from 'next';

const META = {
  ko: { title: '선원 명부 — Argus', description: '항해를 함께하는 페르소나들을 둘러보세요.' },
  en: { title: 'Crew Roster — Argus', description: 'Meet the personas who sail with you.' },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const first = (h.get('accept-language') || '').split(',')[0]?.toLowerCase() ?? '';
  const lang: 'ko' | 'en' = first.startsWith('ko') ? 'ko' : 'en';
  return META[lang];
}

export default function AgentsPage() {
  return <AgentHub />;
}
