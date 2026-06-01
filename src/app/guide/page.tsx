'use client';

import { Card } from '@/components/ui/Card';
import {
  ArrowRight,
  Zap,
  Bot,
  MessageSquare,
  Search,
  MessageCircle,
  Users,
  Layers,
  Eye,
  Edit3,
  Check,
  Workflow,
  Settings2,
} from 'lucide-react';
import Link from 'next/link';
import { useLocale } from '@/hooks/useLocale';
import {
  CHAIN_UNLOCK_THRESHOLDS,
  NAVIGATOR_UNLOCK_THRESHOLD,
  NAVIGATOR_SESSION_THRESHOLD,
  AGENT_LEVELS,
} from '@/stores/agent-types';

type Locale = 'ko' | 'en';

interface FlowStep {
  icon: typeof Search;
  label: string;
  desc: string;
  tone: 'ai' | 'you' | 'done';
}

function getFlowSteps(locale: Locale): FlowStep[] {
  if (locale === 'ko') {
    return [
      { icon: Search, label: '분석', desc: '숨은 가정과 진짜 질문을 찾아냅니다.', tone: 'ai' },
      { icon: MessageCircle, label: '대화', desc: '질문 2~3개에 답하면 맥락이 정교해지고 팀이 배정됩니다.', tone: 'you' },
      { icon: Users, label: '팀 작업', desc: '배정된 에이전트들이 병렬로 분석·조사·작성을 진행합니다.', tone: 'ai' },
      { icon: Layers, label: '종합', desc: '리드 에이전트와 항해장(Navigator)이 결과를 하나의 초안으로 통합합니다.', tone: 'ai' },
      { icon: Eye, label: '검증', desc: '의사결정자(상사·고객 등) 관점에서 약점을 시뮬레이션합니다.', tone: 'ai' },
      { icon: Edit3, label: '수정', desc: '피드백을 반영해 초안을 다듬습니다. 직접 손봐도 되고 자동 반영도 가능합니다.', tone: 'you' },
      { icon: Check, label: '완성', desc: '제출 가능한 문서 — 복사·다운로드·팀장 시뮬레이터로 바로 연결됩니다.', tone: 'done' },
    ];
  }
  return [
    { icon: Search, label: 'Analyze', desc: 'Surface hidden assumptions and the real question behind your problem.', tone: 'ai' },
    { icon: MessageCircle, label: 'Converse', desc: 'Answer 2–3 questions — context sharpens and the team auto-assembles.', tone: 'you' },
    { icon: Users, label: 'Team work', desc: 'The assigned agents analyze, research, and write in parallel.', tone: 'ai' },
    { icon: Layers, label: 'Mix', desc: 'The lead agent and Navigator merge results into a single draft.', tone: 'ai' },
    { icon: Eye, label: 'Review', desc: "Simulate how a decision-maker (boss, customer, etc.) would react and surface weak spots.", tone: 'ai' },
    { icon: Edit3, label: 'Refine', desc: 'Apply feedback — manually or automatically — to tighten the draft.', tone: 'you' },
    { icon: Check, label: 'Done', desc: 'A ready-to-send document — copy, download, or jump into Boss Simulator.', tone: 'done' },
  ];
}

export default function GuidePage() {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const flowSteps = getFlowSteps(locale);

  const quickStartSteps = locale === 'ko'
    ? [
        '고민을 그대로 입력 → 30초 안에 진짜 질문·숨은 가정·초안 골격',
        '질문 2~3개에 답변 → 에이전트 팀 자동 배정',
        '팀이 병렬 작업 → 결과 승인하거나 수정 요청',
        '의사결정자 시뮬레이션으로 약점 점검 → 완성',
      ]
    : [
        'Drop your problem → real question, hidden assumptions, and skeleton in 30 seconds',
        'Answer 2–3 questions → the agent team auto-assembles',
        'Team works in parallel → approve or request changes',
        'Simulate decision-maker reactions → finalize',
      ];

  const lv2Xp = AGENT_LEVELS.find(l => l.level === 2)?.xp ?? 100;
  const lv3Xp = AGENT_LEVELS.find(l => l.level === 3)?.xp ?? 300;
  const lv5Xp = AGENT_LEVELS.find(l => l.level === 5)?.xp ?? 1000;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-[24px] font-bold text-[var(--text-primary)] tracking-tight">
          {L('사용 가이드', 'Guide')}
        </h1>
        <p className="text-[14px] text-[var(--text-secondary)] mt-2 leading-relaxed max-w-2xl">
          {L(
            '고민 하나 던지면, 에이전트 팀이 분석·조사·작성·검증까지 자동으로 진행하고 제출 가능한 초안을 만들어줍니다. 처음이라면 아래 빠른 시작만 봐도 충분해요.',
            "Drop in a problem and the agent team analyzes, researches, drafts, and reviews — producing a document you can actually send. If you're new here, the Quick Start below is all you need.",
          )}
        </p>
      </div>

      {/* ── 1. Quick Start ── */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--gradient-gold)' }}>
            <Zap size={18} className="text-white" />
          </div>
          <h2 className="text-[18px] font-bold text-[var(--text-primary)]">{L('빠른 시작', 'Quick Start')}</h2>
        </div>
        <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed mb-4">
          {L(
            '워크스페이스에 고민을 입력하는 순간 자동으로 흐릅니다. 중간에 멈추고 손볼 수 있고, 결정이 필요한 곳에서는 알아서 잠깐 멈춰줍니다.',
            "It runs automatically the moment you drop in a problem. You can stop and edit anytime, and it pauses on its own where a human decision is needed.",
          )}
        </p>
        <div className="space-y-2.5 mb-5">
          {quickStartSteps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <span
                className="text-[11px] font-bold tabular-nums leading-none pt-1 shrink-0 select-none w-5 h-5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center"
              >
                {i + 1}
              </span>
              <p className="text-[13.5px] text-[var(--text-primary)] leading-[1.6] flex-1">{step}</p>
            </div>
          ))}
        </div>
        <Link
          href="/workspace"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-[13px] font-semibold hover:shadow-[var(--shadow-md)] transition-all"
          style={{ background: 'var(--gradient-gold)' }}
        >
          {L('워크스페이스로 가기', 'Go to workspace')} <ArrowRight size={14} />
        </Link>
      </Card>

      {/* ── 2. Flow walkthrough ── */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--accent)]/10">
            <Workflow size={18} className="text-[var(--accent)]" />
          </div>
          <h2 className="text-[18px] font-bold text-[var(--text-primary)]">{L('흐름 한눈에', 'How it flows')}</h2>
        </div>
        <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed mb-5">
          {L(
            '워크스페이스 한 세션 안에서 차례로 진행됩니다. 옆의 색은 단계의 성격입니다 — AI가 일하는 단계, 당신이 결정하는 단계, 완료 상태.',
            'All of this runs inside one workspace session. The colored dot tells you who acts: AI working, your turn, or done.',
          )}
        </p>

        {/* Tone legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-5 text-[11px] text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)]" /> {L('AI 작업', 'AI working')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--gradient-gold)' }} /> {L('당신 차례', 'Your turn')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--success)]" /> {L('완료', 'Done')}
          </span>
        </div>

        {/* Phase timeline */}
        <ol className="relative">
          {flowSteps.map((step, i) => {
            const Icon = step.icon;
            const isLast = i === flowSteps.length - 1;
            const dotColor =
              step.tone === 'you'
                ? 'var(--gradient-gold)'
                : step.tone === 'done'
                ? 'var(--success)'
                : 'var(--accent)';
            return (
              <li key={step.label} className="flex gap-3.5 pb-4 last:pb-0 relative">
                {/* Connector line */}
                {!isLast && (
                  <span
                    aria-hidden
                    className="absolute left-[15px] top-[28px] bottom-0 w-px bg-[var(--border)]"
                  />
                )}
                {/* Dot */}
                <span
                  className="relative z-10 mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-[3px] border-[var(--surface)]"
                  style={{
                    background:
                      step.tone === 'done'
                        ? 'var(--collab)'
                        : step.tone === 'you'
                        ? 'var(--checkpoint)'
                        : 'var(--ai)',
                  }}
                >
                  <span
                    className="absolute inset-1 rounded-full"
                    style={{ background: dotColor }}
                  />
                  <Icon size={11} className="relative text-white" strokeWidth={2.5} />
                </span>
                {/* Content */}
                <div className="flex-1 min-w-0 pt-1">
                  <h3 className="text-[14px] font-bold text-[var(--text-primary)] leading-tight">
                    {step.label}
                  </h3>
                  <p className="text-[13px] text-[var(--text-secondary)] leading-[1.6] mt-1">
                    {step.desc}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      {/* ── 3. Agent Team ── */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--surface)] border border-[var(--border)]">
            <Bot size={18} className="text-[var(--text-secondary)]" />
          </div>
          <h2 className="text-[18px] font-bold text-[var(--text-primary)]">{L('에이전트 팀', 'Agent Team')}</h2>
        </div>
        <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed mb-4">
          {L(
            '17명의 전문 에이전트가 각자의 방법론으로 일합니다. 사용할수록 레벨업하고, 당신의 패턴을 학습해서 결과가 점점 달라집니다.',
            '17 specialists, each with their own methodology. They level up and learn your patterns the more you use them — outputs shift over time.',
          )}
        </p>

        {/* Chains */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
          <ChainRow tone="ai" label={L('리서치', 'Research')} agents={locale === 'ko' ? '하윤 → 다은 → 도윤' : 'Hayoon → Daeun → Doyoon'} />
          <ChainRow tone="strategy" label={L('전략', 'Strategy')} agents={locale === 'ko' ? '정민 → 현우 → 승현' : 'Jungmin → Hyunwoo → Seunghyun'} />
          <ChainRow tone="execution" label={L('실행', 'Execution')} agents={locale === 'ko' ? '서연 · 규민 · 혜연 · 수진 · 민서 · 준서 · 예린' : 'Seoyeon · Gyumin · Hyeyeon · Sujin · Minseo · Junseo · Yerin'} />
          <ChainRow tone="validation" label={L('검증', 'Validation')} agents={locale === 'ko' ? '동혁 · 지은 · 윤석' : 'Donghyuk · Jieun · Yunseok'} />
        </div>

        {/* Unlock & level — two compact panels */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl px-4 py-3.5 bg-[var(--bg)] border border-[var(--border-subtle)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)] mb-2">
              {L('해금 조건', 'Unlocks')}
            </p>
            <ul className="space-y-1.5 text-[12.5px] text-[var(--text-primary)] leading-[1.55]">
              <li>
                <strong>{L('두 번째 에이전트', 'Second agent')}</strong>{' '}
                <span className="text-[var(--text-secondary)]">— {L(`체인 작업 ${CHAIN_UNLOCK_THRESHOLDS.senior}회`, `${CHAIN_UNLOCK_THRESHOLDS.senior} chain tasks`)}</span>
              </li>
              <li>
                <strong>{L('세 번째 에이전트', 'Third agent')}</strong>{' '}
                <span className="text-[var(--text-secondary)]">— {L(`체인 작업 ${CHAIN_UNLOCK_THRESHOLDS.master}회`, `${CHAIN_UNLOCK_THRESHOLDS.master} chain tasks`)}</span>
              </li>
              <li>
                <strong>{L('항해장 (Navigator)', 'Navigator')}</strong>{' '}
                <span className="text-[var(--text-secondary)]">— {L(
                  `전체 작업 ${NAVIGATOR_UNLOCK_THRESHOLD}회 또는 세션 ${NAVIGATOR_SESSION_THRESHOLD}회 완료`,
                  `${NAVIGATOR_UNLOCK_THRESHOLD} total tasks or ${NAVIGATOR_SESSION_THRESHOLD} sessions`,
                )}</span>
              </li>
            </ul>
          </div>
          <div className="rounded-xl px-4 py-3.5 bg-[var(--bg)] border border-[var(--border-subtle)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)] mb-2">
              {L('레벨', 'Levels')}
            </p>
            <ul className="space-y-1.5 text-[12.5px] text-[var(--text-primary)] leading-[1.55]">
              <li>
                <strong>Lv.1</strong>{' '}
                <span className="text-[var(--text-secondary)]">— {L('시작 시 모든 에이전트에 부여', 'all agents start here')}</span>
              </li>
              <li>
                <strong>Lv.2</strong> <span className="text-[var(--text-tertiary)] tabular-nums">({lv2Xp} XP)</span>{' '}
                <span className="text-[var(--text-secondary)]">— {L('당신의 관찰 3개를 프롬프트에 주입', "injects 3 of your observations into the prompt")}</span>
              </li>
              <li>
                <strong>Lv.3</strong> <span className="text-[var(--text-tertiary)] tabular-nums">({lv3Xp} XP)</span>{' '}
                <span className="text-[var(--text-secondary)]">— {L('관찰 5개 + 크로스 컨텍스트', '5 observations + cross-context')}</span>
              </li>
              <li>
                <strong>Lv.5</strong> <span className="text-[var(--text-tertiary)] tabular-nums">({lv5Xp} XP)</span>{' '}
                <span className="text-[var(--text-secondary)]">— {L('자기개선 제안까지', 'self-improvement suggestions')}</span>
              </li>
            </ul>
          </div>
        </div>

        <Link href="/agents" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--accent)] hover:underline mt-4">
          {L('에이전트 허브', 'Agent hub')} <ArrowRight size={14} />
        </Link>
      </Card>

      {/* ── 4. Boss Simulator ── */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-red-50 border border-red-100">
            <MessageSquare size={18} className="text-red-500" />
          </div>
          <h2 className="text-[18px] font-bold text-[var(--text-primary)]">{L('팀장 시뮬레이터', 'Boss Simulator')}</h2>
        </div>
        <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed mb-4">
          {L(
            '실제 팀장의 성격을 설정하고 보고 연습을 해볼 수 있습니다. 팀장의 기분이 실시간으로 변하고, 입력창 힌트가 즉석에서 코칭해줍니다.',
            "Configure a real-life boss's personality and rehearse a report. The boss's mood shifts live, and input hints coach you on the fly.",
          )}
        </p>

        <div className="rounded-xl px-4 py-3.5 bg-[var(--bg)] border border-[var(--border-subtle)] mb-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)] mb-2">
            {L('성격 설정 방식', 'Personality input')}
          </p>
          <ul className="space-y-1.5 text-[12.5px] text-[var(--text-primary)] leading-[1.55]">
            <li>
              <strong>{L('🤔 쉽게 (기본)', '🤔 Easy (default)')}</strong>{' '}
              <span className="text-[var(--text-secondary)]">— {L('직장 상황 퀴즈로 4축 설정. MBTI 몰라도 됩니다.', 'A workplace-situation quiz fills the 4 axes. No MBTI knowledge needed.')}</span>
            </li>
            <li>
              <strong>{L('🎯 MBTI', '🎯 MBTI')}</strong>{' '}
              <span className="text-[var(--text-secondary)]">— {L('이미 알고 있다면 바로 4축을 골라서 입력.', 'Already know it? Pick the 4 axes directly.')}</span>
            </li>
            <li>
              <strong>{L('생년월일 (선택)', 'Birth date (optional)')}</strong>{' '}
              <span className="text-[var(--text-secondary)]">— {L('사주 기반의 기본 무드와 daily mood가 더해집니다.', 'Adds saju-based baseline mood and daily mood shifts.')}</span>
            </li>
          </ul>
        </div>

        <Link href="/boss" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--accent)] hover:underline">
          {L('팀장 시뮬레이터 열기', 'Open Boss Simulator')} <ArrowRight size={14} />
        </Link>
      </Card>

      {/* ── 5. Advanced ── */}
      <details className="group rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] open:shadow-[var(--shadow-sm)] transition-shadow">
        <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer list-none">
          <span className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--bg)] border border-[var(--border-subtle)]">
              <Settings2 size={15} className="text-[var(--text-secondary)]" />
            </span>
            <span className="flex flex-col">
              <span className="text-[15px] font-bold text-[var(--text-primary)]">
                {L('고급 — 단계별로 직접 사용', 'Advanced — use stages standalone')}
              </span>
              <span className="text-[12px] text-[var(--text-tertiary)] mt-0.5">
                {L('대부분은 빠른 시작만으로 충분합니다.', "Most users won't need this — Quick Start covers it.")}
              </span>
            </span>
          </span>
          <ArrowRight size={14} className="text-[var(--text-tertiary)] transition-transform group-open:rotate-90 shrink-0" />
        </summary>
        <div className="px-5 pb-5 pt-1 space-y-3">
          <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
            {L(
              '워크스페이스 URL에 ?step=… 을 붙이면 4탭 레거시 인터페이스로 진입합니다. 분석을 따로 돌려서 다른 도구에 붙여넣고 싶을 때 유용합니다.',
              'Append ?step=… to the workspace URL to enter the legacy 4-tab interface. Useful when you want to run a single stage and paste the result elsewhere.',
            )}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <LegacyChip href="/workspace?step=reframe" label={L('문제 재정의', 'Reframe')} />
            <LegacyChip href="/workspace?step=recast" label={L('실행 설계', 'Recast')} />
            <LegacyChip href="/workspace?step=rehearse" label={L('사전 검증', 'Rehearse')} />
            <LegacyChip href="/workspace?step=refine" label={L('수정 반영', 'Refine')} />
            <LegacyChip href="/workspace?step=synthesize" label={L('종합', 'Synthesize')} />
          </div>
        </div>
      </details>
    </div>
  );
}

/* ─── Helpers ─── */

function ChainRow({ tone, label, agents }: { tone: 'ai' | 'strategy' | 'execution' | 'validation'; label: string; agents: string }) {
  const dotColor =
    tone === 'ai'
      ? 'bg-[#2d4a7c]'
      : tone === 'strategy'
      ? 'bg-[#8b6914]'
      : tone === 'execution'
      ? 'bg-[#2d6b2d]'
      : 'bg-[#9b5de5]';
  return (
    <div className="flex items-start gap-2.5 text-[12.5px] text-[var(--text-primary)] leading-[1.55]">
      <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${dotColor}`} />
      <div className="min-w-0">
        <span className="text-[var(--text-tertiary)] font-medium">{label}</span>
        <span className="ml-1.5">{agents}</span>
      </div>
    </div>
  );
}

function LegacyChip({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border-subtle)] hover:border-[var(--accent)]/30 hover:shadow-[var(--shadow-sm)] transition-all text-[12.5px] text-[var(--text-primary)] font-medium group/chip"
    >
      <span className="truncate">{label}</span>
      <ArrowRight size={11} className="text-[var(--text-tertiary)] group-hover/chip:text-[var(--accent)] transition-colors shrink-0" />
    </Link>
  );
}
