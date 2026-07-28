'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Quote,
  SearchCheck,
  UserRound,
} from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { buildWorkspaceDecisionTrace, openTraceLocator } from '@/lib/evidence-trace';
import { useProgressiveStore } from '@/stores/useProgressiveStore';
import { resolveAgentType } from '@/stores/types';
import { personaName } from './shared/persona-format';
import { EASE } from './shared/constants';

type SourceGroup = 'user' | 'team' | 'checks';

export function DecisionEvidenceMap({ onNavigate }: { onNavigate?: () => void } = {}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const session = useProgressiveStore((state) =>
    state.sessions.find((item) => item.id === state.currentSessionId),
  );
  const [openGroup, setOpenGroup] = useState<SourceGroup | null>('user');

  const model = (() => {
    if (!session) return null;
    const latest = session.snapshots.at(-1) ?? null;
    const finalMix = session.final_mix ?? session.mix;
    const workerById = new Map(session.workers.map((worker) => [worker.id, worker]));
    const trace = buildWorkspaceDecisionTrace(session, {
      locale,
      workerName: (workerId) => {
        const worker = workerById.get(workerId);
        if (!worker) return 'AI';
        const agentType = resolveAgentType(worker);
        if (agentType === 'self') return L('내 판단', 'My judgment');
        if (agentType === 'human') return worker.contact?.name || L('외부 응답', 'External response');
        return personaName(worker.persona, locale)
          || 'AI';
      },
    });
    const focus = trace.claims.find((claim) => claim.id === trace.focus_claim_id)!;
    const conclusionKind = finalMix
      ? L('현재 문서의 핵심 주장', 'Core claim in the current document')
      : latest
        ? L('지금 붙잡고 있는 질문', 'Question currently under review')
        : L('처음 적은 상황', 'Original situation');

    const userSources = trace.sources.filter((source) => source.kind === 'message');
    const teamRows = trace.sources
      .filter((source) => source.kind === 'analysis')
      .map((source) => ({
        id: source.id,
        locator: source.locator,
        name: source.label,
        task: source.detail || '',
        finding: source.excerpt,
        reviewed: source.reviewed,
      }));
    const assumptions = trace.claims
      .filter((claim) => claim.role === 'assumption')
      .map((claim) => claim.text)
      .slice(0, 6);
    const flags = latest?.honesty_flags || [];

    return {
      conclusion: focus.text,
      conclusionKind,
      userSources,
      teamRows,
      assumptions,
      flags,
    };
  })();

  if (!model) return null;

  const navigate = (locator: string) => {
    onNavigate?.();
    openTraceLocator(locator);
  };

  const groups = [
    {
      key: 'user' as const,
      icon: UserRound,
      label: L('내가 말한 것', 'What I said'),
      count: model.userSources.length,
      tone: 'text-[var(--text-primary)]',
    },
    {
      key: 'team' as const,
      icon: Bot,
      label: L('팀 분석', 'Team analysis'),
      count: model.teamRows.length,
      tone: 'text-[var(--accent)]',
    },
    {
      key: 'checks' as const,
      icon: AlertTriangle,
      label: L('아직 확인할 것', 'Still needs checking'),
      count: model.assumptions.length + model.flags.length,
      tone: 'text-amber-600 dark:text-amber-400',
    },
  ].filter((group) => group.key === 'user' || group.count > 0);

  return (
    <div className="px-4 pb-6" data-testid="decision-evidence-map">
      <div className="relative overflow-hidden border-y border-[var(--border-subtle)] py-4">
        <div className="mb-2 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
          <SearchCheck size={12} className="text-[var(--accent)]" />
          {model.conclusionKind}
        </div>
        <p className="text-[14px] font-semibold leading-[1.55] text-[var(--text-primary)]">
          {model.conclusion}
        </p>
      </div>

      <div className="relative mt-3 pl-3">
        <div aria-hidden="true" className="absolute bottom-5 left-[3px] top-0 w-px bg-[var(--border)]" />
        {groups.map((group) => {
          const Icon = group.icon;
          const open = openGroup === group.key;
          return (
            <section key={group.key} className="relative border-b border-[var(--border-subtle)] last:border-b-0">
              <span aria-hidden="true" className="absolute -left-3 top-[21px] h-[7px] w-[7px] rounded-full border border-[var(--surface)] bg-[var(--text-tertiary)]" />
              <button
                type="button"
                onClick={() => setOpenGroup(open ? null : group.key)}
                aria-expanded={open}
                className="flex min-h-12 w-full items-center gap-2 py-2 text-left"
              >
                <Icon size={14} className={`shrink-0 ${group.tone}`} />
                <span className="flex-1 text-[12.5px] font-semibold text-[var(--text-primary)]">{group.label}</span>
                <span className="tabular-nums text-[12px] text-[var(--text-tertiary)]">{group.count}</span>
                <ChevronDown size={13} className={`text-[var(--text-tertiary)] transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.24, ease: EASE }}
                    className="overflow-hidden"
                  >
                    <div className="pb-3 pl-[22px]">
                      {group.key === 'user' && (
                        <div className="space-y-3">
                          {model.userSources.map((source) => (
                            <EvidenceQuote
                              key={source.id}
                              label={source.label}
                              text={source.excerpt}
                              openLabel={L(`${source.label} 원문 보기`, `Open source: ${source.label}`)}
                              onOpen={() => navigate(source.locator)}
                            />
                          ))}
                        </div>
                      )}

                      {group.key === 'team' && (
                        <div className="divide-y divide-[var(--border-subtle)]">
                          {model.teamRows.map((row) => (
                            <button
                              type="button"
                              key={row.id}
                              onClick={() => navigate(row.locator)}
                              className="group block w-full py-2.5 text-left first:pt-0 last:pb-0"
                              aria-label={L(`${row.name} 보고서 원문 보기`, `Open ${row.name} report`)}
                            >
                              <div className="mb-1 flex items-center gap-1.5">
                                <span className="truncate text-[12.5px] font-semibold text-[var(--text-primary)]">{row.name}</span>
                                <span className="truncate text-[13px] text-[var(--text-tertiary)]">{row.task}</span>
                                {row.reviewed && <CheckCircle2 size={11} className="ml-auto shrink-0 text-[var(--success)]" aria-label={L('직접 반영함', 'Reviewed and applied')} />}
                                <ArrowUpRight size={11} className="shrink-0 text-[var(--text-tertiary)] transition-colors group-hover:text-[var(--accent)]" aria-hidden="true" />
                              </div>
                              <p className="text-[13px] leading-[1.55] text-[var(--text-secondary)]">{row.finding}</p>
                            </button>
                          ))}
                        </div>
                      )}

                      {group.key === 'checks' && (
                        <div className="space-y-3">
                          {model.flags.map((flag) => (
                            <div key={`${flag.kind}-${flag.text}`} className="border-l-2 border-amber-500/55 pl-2.5">
                              <p className="text-[12px] font-semibold text-amber-700 dark:text-amber-400">{L('외부 근거 필요', 'External evidence needed')}</p>
                              <p className="mt-0.5 text-[13px] leading-[1.5] text-[var(--text-primary)]">{flag.text}</p>
                              {flag.stake && <p className="mt-1 text-[12.5px] leading-[1.45] text-[var(--text-secondary)]">{flag.stake}</p>}
                              {flag.where && <p className="mt-1 inline-flex items-start gap-1 text-[12px] leading-[1.4] text-[var(--accent)]"><SearchCheck size={10} className="mt-0.5 shrink-0" />{flag.where}</p>}
                            </div>
                          ))}
                          {model.assumptions.map((assumption) => (
                            <div key={assumption} className="flex items-start gap-2">
                              <CircleHelp size={12} className="mt-0.5 shrink-0 text-[var(--text-tertiary)]" />
                              <div>
                                <p className="text-[13px] leading-[1.5] text-[var(--text-primary)]">{assumption}</p>
                                <p className="mt-0.5 text-[13px] text-[var(--text-tertiary)]">{L('문서 전체가 기대는 가정', 'Assumption supporting the document as a whole')}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          );
        })}
      </div>

      <p className="mt-3 flex items-start gap-1.5 text-[13px] leading-[1.45] text-[var(--text-tertiary)]">
        <CircleHelp size={10} className="mt-0.5 shrink-0" />
        {L('출처 위치를 확인할 수 있는 내용만 연결했습니다. 가정은 근거처럼 표시하지 않습니다.', 'Only material with a traceable source location is connected. Assumptions are kept separate.')}
      </p>
    </div>
  );
}

function EvidenceQuote({ label, text, openLabel, onOpen }: { label: string; text: string; openLabel: string; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="group block w-full text-left" aria-label={openLabel}>
      <p className="mb-1 flex items-center gap-1 text-[13px] font-semibold text-[var(--text-tertiary)]">
        <Quote size={9} /> <span className="flex-1">{label}</span>
        <ArrowUpRight size={10} className="transition-colors group-hover:text-[var(--accent)]" aria-hidden="true" />
      </p>
      <p className="border-l border-[var(--border)] pl-2.5 text-[13px] leading-[1.55] text-[var(--text-secondary)]">
        {text}
      </p>
    </button>
  );
}
