'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useProjectStore } from '@/stores/useProjectStore';
import { usePersonaStore } from '@/stores/usePersonaStore';
import { Users, Settings, BookOpen, FolderOpen, User, Download, BarChart3 } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { useAuth } from '@/lib/auth';

const OPERATOR_EMAILS = new Set(['time22say@gmail.com', 'yclee913@gmail.com']);

export function Sidebar() {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const { user } = useAuth();
  const isOperator = !!user?.email && OPERATOR_EMAILS.has(user.email);

  const utilityItems = [
    { href: '/project', label: L('프로젝트', 'Projects'), icon: FolderOpen },
    { href: '/import', label: L('가져오기', 'Import'), icon: Download },
    { href: '/teams', label: L('팀', 'Teams'), icon: Users },
    { href: '/guide', label: L('사용 가이드', 'Guide'), icon: BookOpen },
    { href: '/settings', label: L('설정', 'Settings'), icon: Settings },
    ...(isOperator ? [{ href: '/admin', label: L('계기판', 'Dashboard'), icon: BarChart3 }] : []),
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

      {/* Process steps (legacy ?step= tools) removed — the workspace's
          progressive flow is the single entry point now. */}

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
