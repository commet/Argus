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
  HelpCircle,
} from 'lucide-react';
import { LocaleLink } from '@/components/ui/LocaleLink';
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
      { icon: MessageCircle, label: '대화', desc: '질문 2~3개에 답하면 맥락이 정교해지고 선원이 배정됩니다.', tone: 'you' },
      { icon: Users, label: '선원 작업', desc: '배정된 선원들이 병렬로 분석·조사·작성을 진행합니다.', tone: 'ai' },
      { icon: Layers, label: '종합', desc: '리드 선원과 항해장이 결과를 하나의 초안으로 통합합니다.', tone: 'ai' },
      { icon: Eye, label: '검증', desc: '의사결정자(상사·고객 등) 관점에서 약점을 시뮬레이션합니다.', tone: 'ai' },
      { icon: Edit3, label: '수정', desc: '피드백을 반영해 초안을 다듬습니다. 직접 손봐도 되고 자동 반영도 가능합니다.', tone: 'you' },
      { icon: Check, label: '도착', desc: '결론·근거·확인할 것이 현재 방위 한 화면에 모입니다. 봉인하면 정한 날짜에 돌아와 물어요.', tone: 'done' },
    ];
  }
  return [
    { icon: Search, label: 'Analyze', desc: 'Surface hidden assumptions and the real question behind your problem.', tone: 'ai' },
    { icon: MessageCircle, label: 'Converse', desc: 'Answer 2–3 questions — context sharpens and your crew assembles.', tone: 'you' },
    { icon: Users, label: 'Crew work', desc: 'Your crew analyzes, researches, and writes in parallel.', tone: 'ai' },
    { icon: Layers, label: 'Mix', desc: 'The lead crew member and the Navigator merge results into a single draft.', tone: 'ai' },
    { icon: Eye, label: 'Review', desc: "Simulate how a decision-maker (boss, customer, etc.) would react and surface weak spots.", tone: 'ai' },
    { icon: Edit3, label: 'Refine', desc: 'Apply feedback — manually or automatically — to tighten the draft.', tone: 'you' },
    { icon: Check, label: 'Arrival', desc: 'Conclusion, reasoning, and what to check — one Current Heading. Seal it, and Argus returns on your chosen date to ask.', tone: 'done' },
  ];
}

export default function GuidePage() {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const flowSteps = getFlowSteps(locale);

  const quickStartSteps = locale === 'ko'
    ? [
        '결정이나 고민을 그대로 입력 → 진짜 질문과 숨은 가정이 드러납니다',
        '질문 2~3개에 답변 → 선원(에이전트) 팀이 자동으로 꾸려집니다',
        '선원들이 병렬로 작업 → 필요한 곳만 수정 요청',
        '의사결정자 시뮬레이션으로 약점 점검 → 현재 방위 완성',
      ]
    : [
        'Write your decision as-is → the real question and hidden assumptions surface',
        'Answer 2–3 questions → your crew of agents assembles automatically',
        'The crew works in parallel → request changes only where needed',
        'Simulate decision-maker reactions → arrive at your Current Heading',
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
            '결정 하나를 적으면 항해가 시작됩니다. 선원들이 분석하고 검증한 것이 현재 방위 한 화면으로 모이고 — 결정을 봉인하면, 정한 날짜에 돌아와 물어요. "그래서, 어떻게 됐어요?" 처음이라면 아래 빠른 시작만 봐도 충분해요.',
            'Write down one decision and the voyage begins. Your crew\'s work converges into a single Current Heading — and once you seal the decision, Argus comes back on the date you chose to ask: "So, how did it go?" New here? The Quick Start below is all you need.',
          )}
        </p>
      </div>

      {/* ── 0. FAQ — a novice's real questions, answered first ── */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--accent)]/10">
            <HelpCircle size={18} className="text-[var(--accent)]" />
          </div>
          <h2 className="text-[18px] font-bold text-[var(--text-primary)]">{L('자주 묻는 것', 'Common questions')}</h2>
        </div>
        <div className="space-y-4">
          {(locale === 'ko'
            ? [
                {
                  q: '질문은 왜 하나요?',
                  a: "답이 분석을 구체화하고, 갈리는 지점을 좁혀요. 언제든 '그만 묻고 초안 만들기'로 건너뛸 수 있어요.",
                },
                {
                  q: '내가 쓴 내용은 어디로 가나요?',
                  a: '분석에만 쓰여요. 사람에게 전달되지 않고, 브라우저와 내 계정에만 저장돼요.',
                },
                {
                  q: '무료로 어디까지 쓰나요?',
                  a: '로그인 없이 하루 결정 2~3개 분량, 로그인하면 더 넉넉해요.',
                },
                {
                  q: "'물어봐 준다'는 게 어떻게 오나요?",
                  a: '정한 날짜에 프로젝트 페이지에 오시면 제가 먼저 물어요 — 메일·알림은 보내지 않아요. 원하면 캘린더 파일로 약속을 넣을 수 있어요.',
                },
                {
                  q: '현재 방위가 뭔가요?',
                  a: '이 결정이 지금 향하는 방향을 한 장으로 압축한 요약이에요 — 결론·이유·남은 확인거리·다음 할 일.',
                },
                // The one product-level faint-lean disclosure (spine rule 4,
                // rounds 5–8): name the limit here, once — never as a
                // per-output tag, never as an absolute "we don't judge" claim.
                {
                  q: 'AI가 은근히 한쪽으로 밀지는 않나요?',
                  a: '저희가 아는 한계예요. 결정을 가장 크게 좌우하는 가정을 짚는 일에는 그 자체로 희미한 기울기가 남아요. 그래서 결론 대신 질문으로 돌려드리고 판정 어휘를 피하도록 설계했지만, 기울기가 완전히 사라지진 않아요 — 최종 판단은 언제나 당신 몫이에요.',
                },
              ]
            : [
                {
                  q: 'Why does it ask me questions?',
                  a: 'Your answers sharpen the analysis and narrow where things fork. You can skip anytime with "stop asking, draft now."',
                },
                {
                  q: 'Where does what I write go?',
                  a: "It's used only for analysis. It never goes to a person — it's stored only in your browser and your account.",
                },
                {
                  q: 'How much can I use for free?',
                  a: 'Without logging in, about 2–3 decisions a day; logging in gives you more room.',
                },
                {
                  q: 'How does "coming back to ask" work?',
                  // Honesty: there is no email-reminder UI yet (the cron
                  // requires an opt-in flag nothing sets) — don't promise one.
                  a: 'Visit your project page on the date you set and Argus asks first — no emails or notifications. You can add the appointment as a calendar file if you like.',
                },
                {
                  q: 'What is a Current Heading?',
                  a: "A one-page summary of where this decision is headed right now — conclusion, reasoning, what's left to check, and what to do next.",
                },
                {
                  q: "Doesn't the AI quietly lean one way?",
                  a: "A limit we own. Surfacing the assumption a decision most rests on carries a faint lean by its nature. That's why Argus hands back questions instead of conclusions and avoids verdict language — but the lean never fully disappears, so the final call stays yours.",
                },
              ]
          ).map((item, i) => (
            <div key={i}>
              <p className="text-[13.5px] font-bold text-[var(--text-primary)] leading-snug">{item.q}</p>
              <p className="text-[13px] text-[var(--text-secondary)] leading-[1.65] mt-1">{item.a}</p>
            </div>
          ))}
        </div>
      </Card>

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
            "It starts the moment you type your problem. You can stop and edit anytime, and it pauses on its own wherever a human decision is needed.",
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
        <LocaleLink
          href="/workspace"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-[13px] font-semibold hover:shadow-[var(--shadow-md)] transition-all"
          style={{ background: 'var(--gradient-gold)' }}
        >
          {L('워크스페이스로 가기', 'Go to workspace')} <ArrowRight size={14} />
        </LocaleLink>
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
          <h2 className="text-[18px] font-bold text-[var(--text-primary)]">{L('선원들 — 에이전트 팀', 'The Crew — Agent Team')}</h2>
        </div>
        <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed mb-4">
          {L(
            '17명의 전문 선원이 각자의 방법론으로 일합니다. 당신은 키를 잡고, 선원들은 배 아래에서 일해요. 함께 항해할수록 당신의 패턴을 학습해서 결과가 점점 달라집니다.',
            '17 specialist crew members, each with their own methodology. You hold the helm; they work below deck. The more voyages you share, the better they learn your patterns — outputs shift over time.',
          )}
        </p>

        {/* Chains */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
          <ChainRow tone="ai" label={L('리서치', 'Research')} agents={locale === 'ko' ? '하윤 → 다은 → 도윤' : 'Hayoon → Daeun → Doyoon'} />
          <ChainRow tone="strategy" label={L('전략', 'Strategy')} agents={locale === 'ko' ? '정민 → 현우 → 승현' : 'Jungmin → Hyunwoo → Seunghyun'} />
          <ChainRow tone="execution" label={L('실행', 'Execution')} agents={locale === 'ko' ? '서연 · 규민 · 혜연 · 수진 · 민서 · 준서 · 예린' : 'Seoyeon · Gyumin · Hyeyeon · Sujin · Minseo · Junseo · Yerin'} />
          <ChainRow tone="validation" label={L('검증', 'Validation')} agents={locale === 'ko' ? '동혁 · 지은 · 윤석' : 'Donghyuk · Jieun · Yunseok'} />
        </div>

        {/* Unlock & level — demoted into a collapsed details; novices don't need XP first */}
        <details className="group/growth rounded-xl border border-[var(--border-subtle)] bg-[var(--bg)]">
          <summary className="flex items-center justify-between gap-2 px-4 py-3 cursor-pointer list-none">
            <span className="text-[12.5px] font-semibold text-[var(--text-secondary)]">
              {L('선원 성장 시스템 (선택)', 'Crew growth system (optional)')}
            </span>
            <ArrowRight size={12} className="text-[var(--text-tertiary)] transition-transform group-open/growth:rotate-90 shrink-0" />
          </summary>
          <div className="px-4 pb-4">
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
                <strong>{L('항해장', 'Navigator')}</strong>{' '}
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
          </div>
        </details>

        <LocaleLink href="/agents" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--accent)] hover:underline mt-4">
          {L('선원 명부', 'Crew roster')} <ArrowRight size={14} />
        </LocaleLink>
      </Card>

      {/* ── 4. Boss Simulator ── */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          {/* Token-based tint — the old bg-red-50 hardcode broke dark mode. */}
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--danger)]/10 border border-[var(--danger)]/20">
            <MessageSquare size={18} className="text-[var(--danger)]" />
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

        <LocaleLink href="/boss" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--accent)] hover:underline">
          {L('팀장 시뮬레이터 열기', 'Open Boss Simulator')} <ArrowRight size={14} />
        </LocaleLink>
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
              '워크스페이스 URL에 ?step=… 을 붙이면 단계별 인터페이스로 진입합니다. 한 단계만 따로 돌려서 결과를 다른 도구에 붙여넣고 싶을 때 유용합니다.',
              'Append ?step=… to the workspace URL to run a single stage on its own. Useful when you want to paste the result elsewhere.',
            )}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <LegacyChip href="/workspace?step=reframe" label={L('문제 재정의', 'Reframe')} />
            <LegacyChip href="/workspace?step=recast" label={L('실행 설계', 'Recast')} />
            <LegacyChip href="/workspace?step=rehearse" label={L('사전 검증', 'Rehearse')} />
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
    <LocaleLink
      href={href}
      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border-subtle)] hover:border-[var(--accent)]/30 hover:shadow-[var(--shadow-sm)] transition-all text-[12.5px] text-[var(--text-primary)] font-medium group/chip"
    >
      <span className="truncate">{label}</span>
      <ArrowRight size={11} className="text-[var(--text-tertiary)] group-hover/chip:text-[var(--accent)] transition-colors shrink-0" />
    </LocaleLink>
  );
}
