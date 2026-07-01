'use client';

import { Anchor, CheckCircle2, Compass, GitFork, MessageSquareText, RotateCcw, Target, Waves } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import type {
  AnalysisSnapshot,
  DecisionContract,
  FlowAnswer,
  FlowQuestion,
  Project,
} from '@/stores/types';
import type { CurrentBearing } from '@/lib/current-bearing';

type ReplayStepTone = 'neutral' | 'accent' | 'warning' | 'success';

interface ReplayStep {
  key: string;
  Icon: LucideIcon;
  tone: ReplayStepTone;
  label: string;
  title: string;
  body?: string;
  meta?: string;
}

export function DecisionReplayTimeline({
  problemText,
  snapshots,
  questions,
  answers,
  bearing,
  contract,
  outcome,
}: {
  problemText: string | null | undefined;
  snapshots: AnalysisSnapshot[];
  questions: FlowQuestion[];
  answers: FlowAnswer[];
  bearing: CurrentBearing | null;
  contract?: DecisionContract | null;
  outcome?: Project['outcome'];
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);

  const first = snapshots[0] ?? null;
  const latest = snapshots[snapshots.length - 1] ?? null;
  const original = clean(problemText);
  const realQuestion = clean(latest?.real_question || first?.real_question);
  const answered = answers.filter((a) => clean(a.value)).length;
  const assumptions = compact([
    latest?.weakest_assumption?.assumption,
    ...(latest?.hidden_assumptions ?? []),
  ]).slice(0, 2);
  const road = bearing?.road_not_taken?.find((r) => clean(r.option));
  const allPredicates = contract?.predicates ?? [];
  const replayPredicate = allPredicates.find((p) => !p.verdict || p.verdict === 'pending') ?? allPredicates[0];
  const replayPredicateText = clean(replayPredicate?.text) || clean(bearing?.contract_seed?.predicate);
  const graded = allPredicates.filter((p) => p.verdict && p.verdict !== 'pending').length;
  const settled = allPredicates.length > 0 && graded === allPredicates.length;

  const steps: ReplayStep[] = [];

  if (original) {
    steps.push({
      key: 'start',
      Icon: MessageSquareText,
      tone: 'neutral',
      label: L('처음 질문', 'Original ask'),
      title: original,
      meta: answered > 0
        ? L(`${answered}개 답변으로 보정됨`, `Refined by ${answered} answer${answered === 1 ? '' : 's'}`)
        : undefined,
    });
  }

  if (realQuestion && realQuestion !== original) {
    steps.push({
      key: 'reframe',
      Icon: RotateCcw,
      tone: 'accent',
      label: L('바뀐 질문', 'Reframed question'),
      title: realQuestion,
      meta: latest?.frame_status
        ? L(`프레임: ${latest.frame_status}`, `Frame: ${latest.frame_status}`)
        : undefined,
    });
  }

  if (assumptions.length > 0) {
    steps.push({
      key: 'assumptions',
      Icon: Target,
      tone: 'warning',
      label: L('드러난 가정', 'Assumptions surfaced'),
      title: assumptions[0],
      body: assumptions.slice(1).join(' · '),
    });
  }

  if (road) {
    steps.push({
      key: 'road',
      Icon: GitFork,
      tone: 'neutral',
      label: L('버린 선택지', 'Road not taken'),
      title: road.option,
      body: road.why_not_now,
    });
  }

  if (bearing) {
    steps.push({
      key: 'bearing',
      Icon: Compass,
      tone: bearing.current_course.status === 'collect_evidence' || bearing.current_course.status === 'hold'
        ? 'warning'
        : 'success',
      label: L('현재 항로', 'Current bearing'),
      title: bearing.current_course.summary,
      meta: bearing.next_helm
        ? L(`다음: ${bearing.next_helm}`, `Next: ${bearing.next_helm}`)
        : undefined,
    });
  }

  // FIRST settlement (생각↔생각): did the user's own read move after hearing the answer?
  // Mirror the two points the user wrote — NEVER a verdict on the move (zero-judgment).
  if (contract?.lean_after) {
    const la = contract.lean_after;
    const anchorText = clean(allPredicates.find((p) => p.source === 'user_lean')?.text);
    steps.push({
      key: 'wake',
      Icon: Waves,
      tone: la.changed ? 'accent' : 'neutral',
      label: L('내 생각의 항적', "My read's wake"),
      title: la.changed ? L('마음이 움직였어요', 'My read moved') : L('단단함 — 흔들리지 않았어요', 'It held — unmoved'),
      body: la.changed && clean(la.text) ? clean(la.text) : undefined,
      meta: anchorText ? L(`출발: ${anchorText}`, `Set out: ${anchorText}`) : undefined,
    });
  }

  if (contract?.check_in_at || replayPredicateText) {
    steps.push({
      key: 'contract',
      Icon: Anchor,
      tone: settled ? 'success' : 'accent',
      label: settled ? L('정산 완료', 'Settled') : L('나중에 확인', 'Check later'),
      title: replayPredicateText || L('확인 일정이 잡혀 있어요', 'Follow-up is scheduled'),
      meta: contract?.check_in_at
        ? L(`확인일: ${formatDate(contract.check_in_at, locale)}`, `Check-in: ${formatDate(contract.check_in_at, locale)}`)
        : undefined,
    });
  }

  if (outcome && outcome.verdict !== 'pending') {
    steps.push({
      key: 'outcome',
      Icon: CheckCircle2,
      tone: outcome.verdict === 'right' ? 'success' : outcome.verdict === 'wrong' ? 'warning' : 'accent',
      label: L('실제 결과', 'Reality answered'),
      title: outcome.note || outcome.verdict,
      meta: outcome.recorded_at ? formatDate(outcome.recorded_at, locale) : undefined,
    });
  }

  if (steps.length === 0) return null;

  return (
    <section
      className="rounded-2xl bg-[var(--surface)] px-4 py-4 md:px-5 md:py-5 shadow-[var(--shadow-md)]"
      aria-label={L('결정 리플레이', 'Decision replay')}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
            {L('결정 리플레이', 'Decision replay')}
          </p>
          <h3 className="mt-1 text-[15px] font-semibold text-[var(--text-primary)] leading-snug text-balance">
            {L('이 결정이 어디서 와서 어디로 갔는지', 'How this decision moved')}
          </h3>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--bg)] px-2 py-1 text-[10.5px] font-medium text-[var(--text-tertiary)] tabular-nums">
          {steps.length}
        </span>
      </div>

      <ol className="mt-4 space-y-0">
        {steps.map((step, index) => (
          <ReplayRow
            key={step.key}
            step={step}
            isLast={index === steps.length - 1}
          />
        ))}
      </ol>
    </section>
  );
}

function ReplayRow({ step, isLast }: { step: ReplayStep; isLast: boolean }) {
  const color = toneColor(step.tone);
  const Icon = step.Icon;
  return (
    <li className="relative grid grid-cols-[28px_1fr] gap-3 pb-4 last:pb-0">
      {!isLast && (
        <span
          aria-hidden
          className="absolute left-[13px] top-8 bottom-0 border-l border-dashed border-[var(--border-subtle)]"
        />
      )}
      <span
        className="relative z-10 mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--bg)]"
        style={{ color, boxShadow: `0 0 0 1px color-mix(in srgb, ${color} 24%, transparent)` }}
      >
        <Icon size={14} />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
            {step.label}
          </p>
          {step.meta && (
            <span className="text-[10.5px] font-medium text-[var(--text-tertiary)]">
              {step.meta}
            </span>
          )}
        </div>
        <p className="mt-1 text-[13px] font-medium leading-[1.5] text-[var(--text-primary)] text-pretty">
          {step.title}
        </p>
        {step.body && (
          <p className="mt-0.5 text-[12px] leading-[1.5] text-[var(--text-secondary)] text-pretty">
            {step.body}
          </p>
        )}
      </div>
    </li>
  );
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function compact(values: unknown[]): string[] {
  return values.map(clean).filter(Boolean);
}

function toneColor(tone: ReplayStepTone): string {
  if (tone === 'success') return 'var(--success)';
  if (tone === 'warning') return 'var(--gold)';
  if (tone === 'accent') return 'var(--accent)';
  return 'var(--text-tertiary)';
}

function formatDate(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}
