'use client';

import { Card } from '@/components/ui/Card';
import {
  ArrowRight,
  Zap,
  Search,
  MessageCircle,
  Users,
  Compass,
  Edit3,
  Check,
  Anchor,
  Workflow,
  HelpCircle,
  UserCheck,
  Download,
  Bot,
} from 'lucide-react';
import { LocaleLink } from '@/components/ui/LocaleLink';
import { useLocale } from '@/hooks/useLocale';

type Locale = 'ko' | 'en';

interface FlowStep {
  icon: typeof Search;
  label: string;
  desc: string;
  tone: 'ai' | 'you' | 'done';
}

// The CURRENT spine, nothing else (창업자 2026-07-19 전면 재작성): write →
// clarify → analysis → Current Heading → seal → return. The old 7-step
// crew-chain walkthrough and the XP/level card described the demoted game UI,
// not what a new user actually sees.
function getFlowSteps(locale: Locale): FlowStep[] {
  if (locale === 'ko') {
    return [
      { icon: Edit3, label: '적기', desc: '상황을 한 줄로 적으면 바로 질문 정리가 시작돼요.', tone: 'you' },
      { icon: MessageCircle, label: '명료화', desc: '질문 2~3개에 답하면 분석이 구체화됩니다. 언제든 건너뛸 수 있어요.', tone: 'you' },
      { icon: Search, label: '분석', desc: 'AI가 숨은 전제와 열린 질문을 찾아냅니다. 결론을 내려주는 게 아니라, 결정이 기대고 있는 것을 보여줘요.', tone: 'ai' },
      { icon: Compass, label: '내 판단 확정', desc: '검토 결과를 바탕으로 마지막 문장을 직접 고치고 확정합니다. 이전 문장은 지워지지 않아요.', tone: 'you' },
      { icon: Anchor, label: '다시 볼 조건', desc: '무엇을 언제 다시 볼지 날짜나 사건으로 정합니다. 기록만 남길 때는 돌아올 약속이 없어도 돼요.', tone: 'you' },
      { icon: Check, label: '돌아와 답하기', desc: '그때 문장부터 본 뒤, 실제로 어땠는지와 지금도 같은 기준인지 따로 답합니다. 점수는 매기지 않아요.', tone: 'done' },
    ];
  }
  return [
    { icon: Edit3, label: 'Write', desc: 'Put the situation in one line and question clarification starts.', tone: 'you' },
    { icon: MessageCircle, label: 'Clarify', desc: 'Answer 2–3 questions to sharpen the analysis. Skip anytime.', tone: 'you' },
    { icon: Search, label: 'Analyze', desc: "The AI surfaces hidden premises and open questions — it shows what the decision rests on, it doesn't hand you a verdict.", tone: 'ai' },
    { icon: Compass, label: 'Confirm my call', desc: 'Edit and confirm the final sentence yourself. Earlier wording stays in the record.', tone: 'you' },
    { icon: Anchor, label: 'Set the return', desc: 'Choose the date or event that should reopen it. If you only want to preserve the moment, no return is needed.', tone: 'you' },
    { icon: Check, label: 'Return and answer', desc: 'Read the original first, then answer what happened and whether you still hold the same standard. No score.', tone: 'done' },
  ];
}

export default function GuidePage() {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const flowSteps = getFlowSteps(locale);

  // The voyage's four beats (05 S4) — the quick start teaches the CURRENT flow:
  // write → tie the rope → see what it rests on → return and answer.
  const quickStartSteps = locale === 'ko'
    ? [
        '상황을 한 줄 적어요 → 진짜 질문과 숨은 가정이 드러납니다',
        'AI 의견을 보기 전에 내 예상을 한 줄 남겨요 → 선택사항이며, 나중에 실제 결과와 비교해요',
        'AI 검토자가 숨은 전제와 열린 질문을 보여줘요 → 필요한 곳을 고치고 마지막 문장은 내가 확정해요',
        '날짜나 사건이 오면 그때 문장부터 다시 봐요 → 현실과 지금의 기준을 따로 답하고, 점수는 매기지 않아요',
      ]
    : [
        'Write the situation in one line → the real question and hidden assumptions surface',
        'Leave your initial expectation before seeing the AI view → optional, and useful for later comparison',
        'AI reviewers surface hidden premises and open questions → revise what needs work, then confirm the final sentence yourself',
        'Return on the date or event you chose and read the original first → answer reality and your present standard separately, with no score',
      ];

  const moreTools = [
    {
      href: '/teams',
      icon: Users,
      label: L('팀', 'Teams'),
      desc: L('결정을 공유하고 함께 검토할 사람을 초대합니다.', 'Invite people to review shared decisions.'),
    },
    {
      href: '/boss',
      icon: UserCheck,
      label: L('팀장 시뮬레이터', 'Boss Simulator'),
      desc: L('실제 1:1 전에 팀장의 반응을 미리 연습합니다. MBTI를 몰라도 상황 퀴즈로 설정할 수 있어요.', "Rehearse a manager's response before a real 1:1. No MBTI knowledge needed — a situation quiz fills it in."),
    },
    {
      href: '/import',
      icon: Download,
      label: L('기록 가져오기', 'Import records'),
      desc: L('터미널·MCP에서 기록한 결정을 이 계정으로 모읍니다.', 'Gather decisions recorded in the terminal or MCP into this account.'),
    },
    {
      href: '/agents',
      icon: Bot,
      label: L('AI 검토자', 'AI reviewers'),
      desc: L('분석 단계에서 병렬로 일하는 전문 에이전트들을 구경할 수 있어요.', 'Meet the specialist agents that work in parallel during analysis.'),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-[24px] font-bold text-[var(--text-primary)] tracking-tight">
          {L('사용 가이드', 'Guide')}
        </h1>
        <p className="text-[14px] text-[var(--text-secondary)] mt-2 leading-relaxed max-w-2xl">
          {L(
            '결정 하나를 적으면 질문 정리부터 검토까지 이어집니다. 마지막 판단은 직접 확정하고, 날짜나 사건이 오면 그때 문장부터 다시 본 뒤 지금의 답을 덧붙여요. 처음이라면 아래 빠른 시작만 봐도 충분해요.',
            'Write down one decision and Argus takes it from clarification through review. You confirm the final call; when its date or event arrives, Argus shows the original first and appends your answer. New here? The Quick Start below is all you need.',
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
            '워크스페이스에 상황을 적으면 질문 정리가 바로 시작됩니다. 중간에 멈추고 손볼 수 있고, 직접 결정해야 하는 곳에서는 잠깐 멈춥니다.',
            "Question framing starts as soon as you describe the situation. You can stop and edit anytime, and the flow pauses wherever your judgment is needed.",
          )}
        </p>
        <div className="space-y-2.5 mb-5">
          {quickStartSteps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <span
                className="text-[12.5px] font-bold tabular-nums leading-none pt-1 shrink-0 select-none w-5 h-5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center"
              >
                {i + 1}
              </span>
              <p className="text-[13.5px] text-[var(--text-primary)] leading-[1.6] flex-1">{step}</p>
            </div>
          ))}
        </div>
        <LocaleLink
          href="/workspace"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[var(--accent-fg)] text-[13px] font-semibold hover:shadow-[var(--shadow-md)] transition-all"
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
            '워크스페이스 한 세션 안에서 차례로 진행됩니다. 색은 그 단계의 주인입니다 — AI가 일하는 단계, 당신이 결정하는 단계, 완료.',
            'All of this runs inside one workspace session. The color tells you who acts: AI working, your turn, or done.',
          )}
        </p>

        {/* Tone legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-5 text-[12.5px] text-[var(--text-secondary)]">
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

      {/* ── 3. FAQ — a novice's real questions ── */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--accent)]/10">
            <HelpCircle size={18} className="text-[var(--accent)]" />
          </div>
          <h2 className="text-[18px] font-bold text-[var(--text-primary)]">{L('자주 묻는 질문', 'Frequently asked questions')}</h2>
        </div>
        <div className="space-y-4">
          {(locale === 'ko'
            ? [
                {
                  q: '왜 바로 답하지 않고 먼저 물어보나요?',
                  a: "상황을 더 정확히 이해하고, 아직 정해지지 않은 쟁점을 줄이기 위해서예요. 언제든 '지금까지 답한 내용으로 초안 만들기'를 눌러 넘어갈 수 있어요.",
                },
                {
                  q: '내가 쓴 내용은 어디로 가나요?',
                  a: '분석에만 쓰여요. 사람에게 전달되지 않고, 브라우저와 내 계정에만 저장돼요.',
                },
                {
                  q: '무료로 어디까지 쓰나요?',
                  a: '일반적인 사용 기준으로 로그인 없이 하루 약 2~3개, 로그인하면 약 4~5개 결정을 살펴볼 수 있어요. 문서 검토처럼 긴 작업은 더 빨리 소진될 수 있습니다.',
                },
                {
                  q: '결과 확인일이 오면 어디에서 알려주나요?',
                  // 약속 정합(P1-B4): 이 답은 SealMoment의 채널 고지 문장과 복사 일치 —
                  // 알림 채널이 늘거나 줄면 SealMoment.tsx와 여기(ko/en)를 같이 고칠 것.
                  a: '정한 날짜에 프로젝트 페이지에 오시면 제가 먼저 물어요. 텔레그램을 연결해 두셨다면 그날 메시지로도 가볍게 알려드려요. 원하면 캘린더 파일로 약속을 넣을 수 있어요.',
                },
                {
                  q: '판단 기록에는 무엇이 들어가나요?',
                  a: '처음 적은 말, 내가 확정한 문장, 작성 주체와 경로·시각, 다시 볼 조건, 나중에 덧붙인 답이 남아요. 이전 문장은 지우지 않고 점수도 저장하지 않아요.',
                },
                // The one product-level faint-lean disclosure (spine rule 4,
                // rounds 5–8): name the limit here, once — never as a
                // per-output tag, never as an absolute "we don't judge" claim.
                {
                  q: 'AI가 은근히 한쪽으로 밀지는 않나요?',
                  a: '저희가 아는 한계예요. 결정을 가장 크게 좌우하는 가정을 짚다 보면, 그 질문 자체가 은근히 한쪽으로 치우칠 수 있어요. 그래서 결론 대신 질문으로 돌려드리고 판정 어휘를 피하도록 설계했지만, 그 치우침이 완전히 사라지진 않아요 — 최종 판단은 언제나 당신 몫이에요.',
                },
              ]
            : [
                {
                  q: 'Why does it ask me questions?',
                  a: 'Your answers sharpen the analysis and narrow the open questions. You can skip anytime with "stop asking, draft now."',
                },
                {
                  q: 'Where does what I write go?',
                  a: "It's used only for analysis. It never goes to a person — it's stored only in your browser and your account.",
                },
                {
                  q: 'How much can I use for free?',
                  a: 'For typical use, you can explore about 2–3 decisions a day without logging in and about 4–5 when logged in. Longer work such as document review may use the allowance faster.',
                },
                {
                  q: 'How will Argus remind me?',
                  // Promise parity (P1-B4): this answer mirrors the SealMoment channel
                  // disclosure — if notification channels change, update SealMoment.tsx
                  // and both locales here together.
                  a: "Visit your project page on the date you set and Argus asks first. If you've connected Telegram, a light message arrives that day too — no marketing emails, ever. You can add the appointment as a calendar file if you like.",
                },
                {
                  q: 'What is in a judgment record?',
                  a: 'Your first words, the sentence you confirmed, its author, path and time, the return condition, and later answers. Earlier wording stays intact, and no score is stored.',
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

      {/* ── 4. More tools — one honest line each, mirrors the ⋯ menu ── */}
      <Card>
        <h2 className="text-[18px] font-bold text-[var(--text-primary)] mb-1">{L('더 있는 도구', 'More tools')}</h2>
        <p className="text-[13px] text-[var(--text-secondary)] mb-4">
          {L('상단 메뉴에서 모두 열 수 있어요. 필요할 때만 쓰면 됩니다.', 'You can open all of these from the main menu. Use them only when you need them.')}
        </p>
        <div className="space-y-1">
          {moreTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <LocaleLink
                key={tool.href}
                href={tool.href}
                className="flex items-start gap-3 rounded-xl px-3 py-2.5 -mx-3 hover:bg-[var(--bg)] transition-colors group/tool"
              >
                <Icon size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[var(--text-tertiary)] group-hover/tool:text-[var(--accent)] transition-colors" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold text-[var(--text-primary)] leading-tight">{tool.label}</span>
                  <span className="block text-[12.5px] text-[var(--text-secondary)] leading-snug mt-0.5">{tool.desc}</span>
                </span>
                <ArrowRight size={13} className="mt-1 shrink-0 text-[var(--text-tertiary)] opacity-0 group-hover/tool:opacity-100 transition-opacity" />
              </LocaleLink>
            );
          })}
        </div>
      </Card>

      {/* Legacy door closed (05 S3): the old "Advanced — ?step=…" section funneled
          new readers into the legacy 4-tab flow. Routes stay alive for bookmarks
          and old projects; the guide just stops advertising them. */}
    </div>
  );
}
