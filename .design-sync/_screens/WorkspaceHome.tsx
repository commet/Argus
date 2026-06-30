'use client';

/**
 * WorkspaceHome — design-sync-only SCREEN COMPOSITION (not production code).
 *
 * The redesigned workspace first/home screen (the `idle` HeroFlow state),
 * rebuilt from Argus DS primitives so it can live as a card in the Claude
 * Design project and be iterated there. Mirrors the code redesign in
 * src/app/[locale]/workspace/page.tsx: a crew anchor (AI identity), an
 * elevated gold-topped input as THE hero affordance, branded section headers,
 * and consistent card containment for "이어서 작업" + "처음이라면".
 *
 * Pure (Card/Badge/Button need no provider). Korean sample copy matches the
 * live screen. Crew faces are inline token-coloured initials (the real
 * WorkerAvatar is workspace-internal, not in the DS bundle).
 */
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';

const CREW: { initial: string; emoji: string; color: string }[] = [
  { initial: '승', emoji: '🧭', color: '#2d4a7c' },
  { initial: '현', emoji: '📊', color: '#8b6914' },
  { initial: '지', emoji: '🎨', color: '#6b4c9a' },
  { initial: '예', emoji: '🗂️', color: '#1d7d3f' },
  { initial: '윤', emoji: '⚖️', color: '#b5651d' },
];

const STEPS = [
  '상황을 적으면',
  'AI 팀이 갈리는 자리를 보여드리고',
  '문서와 결론 요약 한 장(현재 방위)이 남아요',
];

const RECENT: { name: string; when: string }[] = [
  { name: '제조업 구매 직종에 근무하는데, 앞으로 향후 커리어를 어떻게 가져가야할지', when: '22일 전' },
  { name: '포워딩 물류회사의 AX를 어떻게 해야 할까?', when: '1달 전' },
  { name: 'AI를 전략 업무에 어떻게 도입해야 할지 모르겠어.', when: '1달 전' },
];

const DEMOS: { icon: string; title: string; quote: string }[] = [
  { icon: '📝', title: '기획안', quote: '대표님이 갑자기 신사업 기획안을 2주 안에 만들어오라고 했어. 백…' },
  { icon: '🎯', title: '제안서', quote: '다음 주 금요일에 대형 유통사 물류 자동화 경쟁 PT야. 상대는 S사(대…' },
  { icon: '⚖️', title: '대응 전략', quote: '경쟁사 T사가 갑자기 구독 가격을 30% 내렸어. 우리는 B2B SaaS …' },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="h-3.5 w-[3px] rounded-full" style={{ background: 'var(--gradient-gold)' }} />
      <p className="text-[11px] text-[var(--text-secondary)] uppercase tracking-[0.12em] font-semibold">{children}</p>
    </div>
  );
}

export function WorkspaceHome() {
  return (
    <div
      className="w-full px-6 md:px-8 py-10"
      style={{ background: 'var(--bg)', backgroundImage: 'var(--gradient-concert-hall)' }}
    >
      <div className="max-w-2xl mx-auto">
        {/* ── HERO: crew anchor + headline + steps ── */}
        <div className="mb-6">
          <div className="flex items-center gap-2.5 mb-3.5">
            <div className="flex items-center -space-x-1.5">
              {CREW.map((c, i) => (
                <div
                  key={i}
                  className="relative w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: `${c.color}18`, border: `1.5px solid ${c.color}40`, zIndex: CREW.length - i }}
                >
                  <span className="text-[10px] font-bold" style={{ color: c.color }}>{c.initial}</span>
                  <span className="absolute -bottom-0.5 -right-0.5 text-[7px] leading-none">{c.emoji}</span>
                </div>
              ))}
            </div>
            <Badge variant="gold">AI 의사결정 팀</Badge>
          </div>

          <h1
            className="text-[22px] md:text-[28px] font-bold leading-[1.32] tracking-[-0.01em] text-[var(--text-primary)] mb-3.5"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            지금 들고 있는 결정, 어디서 갈리는지 봐 드릴게요
          </h1>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11.5px] text-[var(--text-secondary)]">
            {STEPS.map((step, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                {i > 0 && <span className="text-[var(--text-tertiary)]/60">›</span>}
                <span
                  className="w-[18px] h-[18px] rounded-full text-white flex items-center justify-center font-bold text-[10px]"
                  style={{ background: 'var(--gradient-gold)', boxShadow: 'var(--shadow-xs)' }}
                >
                  {i + 1}
                </span>
                {step}
              </span>
            ))}
          </div>
        </div>

        {/* ── PRIMARY: the input hero — elevated gold-topped card ── */}
        <div className="mb-10">
          <label className="block text-[13px] font-semibold text-[var(--text-primary)] mb-1">어떤 상황인가요?</label>
          <p className="text-[12px] text-[var(--text-tertiary)] mb-2.5 leading-relaxed">
            분야·형식 상관없어요. 떠오르는 대로 편하게 적어주세요 — 나머지는 팀이 정리해요.
          </p>
          <Card variant="elevated" className="!p-0 overflow-hidden">
            <div className="p-4">
              <p className="text-[15px] text-[var(--text-tertiary)] leading-[1.65] min-h-[66px]">
                예: 다음 주까지 보고서를 써야 하는데 어디서 시작해야 할지 모르겠어
              </p>
              <div className="flex items-center justify-between gap-3 mt-2">
                <span className="text-[11px] text-[var(--text-tertiary)]">한 줄만 적어도 시작할 수 있어요</span>
                <Button variant="accent" size="md">시작 ›</Button>
              </div>
            </div>
          </Card>

          {/* tertiary nav */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--text-tertiary)]">
            <span>AI 팀 소개</span><span>·</span>
            <span>보고 상대 설정</span><span>·</span>
            <span>팀</span><span>·</span>
            <span>가이드</span>
          </div>
        </div>

        {/* ── SECONDARY: 이어서 작업 ── */}
        <div className="mb-10">
          <SectionLabel>이어서 작업</SectionLabel>
          <div className="space-y-1.5">
            {RECENT.map((p, i) => (
              <Card key={i} variant="default" hoverable className="!p-0">
                <div className="flex items-center gap-2.5 px-3.5 py-3">
                  <span className="text-[var(--accent)] text-[13px]">▸</span>
                  <span className="text-[13px] text-[var(--text-primary)] truncate flex-1">{p.name}</span>
                  <span className="text-[11px] text-[var(--text-tertiary)] shrink-0" style={{ fontFamily: 'var(--font-mono)' }}>{p.when}</span>
                </div>
              </Card>
            ))}
          </div>
          <p className="mt-2 px-1 text-[11.5px] text-[var(--text-tertiary)]">전체 30개 보기 ▾</p>
        </div>

        {/* ── TERTIARY: 처음이라면 — 시나리오 ── */}
        <div>
          <SectionLabel>처음이라면 — 시나리오로 둘러보기</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {DEMOS.map((d, i) => (
              <Card key={i} variant="default" hoverable>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[16px]">{d.icon}</span>
                  <span className="text-[13px] font-semibold text-[var(--text-primary)]">{d.title}</span>
                </div>
                <p className="text-[12px] text-[var(--text-tertiary)] leading-relaxed">&ldquo;{d.quote}&rdquo;</p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
