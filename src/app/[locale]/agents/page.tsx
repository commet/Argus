import { AgentHub } from '@/components/agents/AgentHub';
import type { Metadata } from 'next';

const META = {
  ko: { title: '선원 명부 — Argus', description: '항해를 함께하는 페르소나들을 둘러보세요.' },
  en: { title: 'Crew Roster — Argus', description: 'Meet the personas who sail with you.' },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const lang: 'ko' | 'en' = locale === 'ko' ? 'ko' : 'en';
  return META[lang];
}

export default function AgentsPage() {
  return <AgentHub />;
}
