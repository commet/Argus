'use client';

import { useEffect, useState } from 'react';
import { X, Compass, Layers, MessageSquare, Sparkles } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';

export type StepKey = 'reframe' | 'recast' | 'rehearse' | 'synthesize';

interface StepIntroProps {
  stepKey: StepKey;
}

interface Copy {
  emoji: string;
  Icon: typeof Compass;
  title: string;
  purpose: string;
  example: string;
}

function getCopy(stepKey: StepKey, ko: boolean): Copy {
  const L = (k: string, e: string) => (ko ? k : e);
  switch (stepKey) {
    case 'reframe':
      return {
        emoji: '🧭',
        Icon: Compass,
        title: L('항로 재설정 — Reframe', 'Reframe — Set the Heading'),
        purpose: L(
          '주어진 과제 뒤에 숨은 진짜 질문을 찾고, 검증되지 않은 전제를 짚어냅니다.',
          'Find the real question behind the brief and surface the assumptions no one has checked.',
        ),
        example: L(
          '"보고서 빨리 써야 해" → "어떤 결정을 위한 보고서인지부터 정의되지 않았다"',
          '"I need to write a report fast" → "We haven\'t even defined which decision the report should drive."',
        ),
      };
    case 'recast':
      return {
        emoji: '🚣',
        Icon: Layers,
        title: L('선원 배치 — Recast', 'Recast — Crew Assignment'),
        purpose: L(
          '결정된 질문을 실행 가능한 단계로 풀어내고, AI/사람/협업으로 누가 무엇을 할지 배정합니다.',
          'Decompose the decided question into executable steps and assign each to AI / human / both.',
        ),
        example: L(
          '"시장 조사" → 4단계로 분해 + 1단계는 AI, 2단계는 인터뷰(사람)',
          '"Market research" → 4 steps with step 1 = AI, step 2 = interviews (human).',
        ),
      };
    case 'rehearse':
      return {
        emoji: '🔭',
        Icon: MessageSquare,
        title: L('리허설 — Rehearse', 'Rehearse — Stakeholder Validation'),
        purpose: L(
          '결과물을 실제 의사결정자에게 보여주기 전에, 가상 페르소나로 반응을 미리 받아봅니다.',
          'Before showing your draft to the real decision-maker, get a simulated read from stakeholder personas.',
        ),
        example: L(
          'CFO 페르소나가 먼저 "비용 가정이 약하다"고 짚어주면 → 진짜 회의 전에 보강.',
          'A CFO persona flags "your cost assumption is weak" → you reinforce it before the real meeting.',
        ),
      };
    case 'synthesize':
      return {
        emoji: '🪶',
        Icon: Sparkles,
        title: L('이타카 — Synthesize', 'Synthesize — Final Judgment'),
        purpose: L(
          '여러 페르소나의 의견 충돌을 정리하고, 최종 판단을 직접 내려서 문서로 만듭니다.',
          'Resolve conflicting persona feedback, render your own judgment, and assemble it into a final document.',
        ),
        example: L(
          'CEO는 "속도가 중요" / CFO는 "리스크가 크다" → 충돌 해소 + 내 결정 한 줄.',
          'CEO says "speed matters" / CFO says "risk is high" → reconcile, then commit your one-line decision.',
        ),
      };
  }
}

const STORAGE_KEY = 'argus:step-intro-dismissed';

function getDismissed(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function markDismissed(stepKey: StepKey) {
  if (typeof window === 'undefined') return;
  try {
    const current = getDismissed();
    current[stepKey] = true;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // sessionStorage may be unavailable; degrade silently
  }
}

export function StepIntro({ stepKey }: StepIntroProps) {
  const locale = useLocale();
  const ko = locale === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!getDismissed()[stepKey]);
  }, [stepKey]);

  if (!visible) return null;

  const { emoji, Icon, title, purpose, example } = getCopy(stepKey, ko);

  const dismiss = () => {
    markDismissed(stepKey);
    setVisible(false);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 mt-4">
      <div className="relative rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-4 md:p-5 animate-fade-in">
        <button
          onClick={dismiss}
          aria-label={L('닫기', 'Dismiss')}
          className="absolute top-2.5 right-2.5 p-2.5 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>
        <div className="flex items-start gap-3 pr-6">
          <div className="w-10 h-10 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[18px] shrink-0">
            <span aria-hidden="true">{emoji}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon size={12} className="text-[var(--accent)]" />
              <p className="text-[11px] font-bold text-[var(--accent)] uppercase tracking-wider">
                {L('이 단계는', 'This step')}
              </p>
            </div>
            <h2 className="text-[15px] font-bold text-[var(--text-primary)] mb-1.5">{title}</h2>
            <p className="text-[13px] text-[var(--text-primary)] leading-relaxed mb-2">{purpose}</p>
            <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed border-l-2 border-[var(--accent)]/30 pl-3">
              <span className="font-semibold text-[var(--text-tertiary)] mr-1">{L('예:', 'e.g.')}</span>
              {example}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
