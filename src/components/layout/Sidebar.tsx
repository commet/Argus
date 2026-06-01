'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useProjectStore } from '@/stores/useProjectStore';
import { usePersonaStore } from '@/stores/usePersonaStore';
import { Layers, Map, Users, Settings, BookOpen, FolderOpen, RefreshCw, User, Sparkles } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';

export function Sidebar() {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;

  const processSteps = [
    { step: 'reframe', label: L('항로 재설정', 'Interpret'), subtitle: L('문제 재정의', 'Reframe'), icon: Layers, color: '#2d4a7c' },
    { step: 'recast', label: L('선원 배치', 'Arrange'), subtitle: L('실행 설계', 'Recast'), icon: Map, color: '#8b6914' },
    { step: 'rehearse', label: L('리허설', 'Rehearse'), subtitle: L('사전 검증', 'Pre-validate'), icon: Users, color: '#6b4c9a' },
    { step: 'refine', label: L('종합 연습', 'Ensemble'), subtitle: L('피드백 반영', 'Refine'), icon: RefreshCw, color: '#2d6b2d' },
    { step: 'synthesize', label: L('종합', 'Synthesize'), subtitle: L('다중 관점 통합', 'Multi-perspective'), icon: Sparkles, color: '#9b5de5' },
  ];

  const utilityItems = [
    { href: '/project', label: L('프로젝트', 'Projects'), icon: FolderOpen },
    { href: '/teams', label: L('팀', 'Teams'), icon: Users },
    { href: '/guide', label: L('사용 가이드', 'Guide'), icon: BookOpen },
    { href: '/settings', label: L('설정', 'Settings'), icon: Settings },
  ];

  const pathname = usePathname();
  const { projects, currentProjectId, loadProjects } = useProjectStore();
  const { personas, loadData: loadPersonas } = usePersonaStore();

  useEffect(() => {
    loadProjects();
    loadPersonas();
  }, [loadProjects, loadPersonas]);

  const currentProject = currentProjectId ? projects.find(p => p.id === currentProjectId) : null;

  // Hide on landing, login
  if (pathname === '/' || pathname === '/login' || pathname.startsWith('/auth')) return null;

  // Determine which step is active (from workspace URL or tool page path)
  const activeStep = pathname.startsWith('/tools/')
    ? pathname.replace('/tools/', '')
    : null;

  return (
    <aside className="hidden lg:flex flex-col w-56 bg-[var(--surface)]/60 backdrop-blur-sm border-r border-[var(--border-subtle)] shrink-0 overflow-y-auto relative">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--gradient-surface)' }} />
      {/* Current project */}
      {currentProject && (
        <div className="px-3 pt-4 pb-2">
          <div className="flex items-center gap-2 text-[var(--accent)]">
            <FolderOpen size={12} />
            <span className="text-[10px] font-bold uppercase tracking-wider">{L('프로젝트', 'Project')}</span>
          </div>
          <p className="text-[13px] font-semibold text-[var(--text-primary)] mt-1 truncate">
            {currentProject.name}
          </p>
        </div>
      )}

      {/* Process steps — primary navigation */}
      <nav className="px-2 py-3 space-y-0.5">
        <p className="px-2 text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
          {L('프로세스', 'Process')}
        </p>
        {processSteps.map((item) => {
          const Icon = item.icon;
          const isActive = activeStep === item.step;
          return (
            <Link
              key={item.step}
              href={`/workspace?step=${item.step}`}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all duration-200 ${
                isActive
                  ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-sm border border-[var(--border-subtle)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)]'
              }`}
              style={isActive ? { borderLeft: `2px solid ${item.color}` } : undefined}
            >
              <Icon size={16} strokeWidth={isActive ? 2 : 1.5} style={isActive ? { color: item.color } : undefined} />
              <div className="flex items-baseline gap-1.5">
                <span className="font-medium">{item.label}</span>
                <span className={`text-[10px] ${isActive ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-tertiary)]'}`}>
                  {item.subtitle}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Personas */}
      {personas.length > 0 && (
        <div className="px-3 py-2 border-t border-[var(--border-subtle)]">
          <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
            {L('페르소나', 'Personas')}
          </p>
          <div className="space-y-0.5">
            {personas.slice(0, 4).map((p) => (
              <Link
                key={p.id}
                href="/workspace?step=rehearse"
                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)] transition-colors"
              >
                <div className="w-5 h-5 rounded-full bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center shrink-0">
                  <User size={10} />
                </div>
                <span className="truncate">{p.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Utility links */}
      <div className="mt-auto px-2 py-3 border-t border-[var(--border-subtle)]">
        {utilityItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-sm border border-[var(--border-subtle)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)]'
              }`}
            >
              <Icon size={16} strokeWidth={isActive ? 2 : 1.5} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
