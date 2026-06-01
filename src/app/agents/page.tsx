import { AgentHub } from '@/components/agents/AgentHub';
import { headers } from 'next/headers';
import type { Metadata } from 'next';

const META = {
  ko: { title: '에이전트 — Argus', description: '당신의 에이전트 팀을 관리하세요.' },
  en: { title: 'Agents — Argus', description: 'Manage your agent team.' },
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
