import type {
  ContractSettlement,
  DecisionKind,
} from '@/stores/types';

export interface FoundationSettlementOption {
  id: string;
  ko: string;
  en: string;
  axes: ContractSettlement['axes'];
}

export const FOUNDATION_SETTLEMENT_OPTIONS: Record<
  Exclude<DecisionKind, 'witness'>,
  FoundationSettlementOption[]
> = {
  prediction: [
    { id: 'condition_met', ko: '확인하려던 일이 일어났어요', en: 'The condition was met', axes: { reality: 'met', question: 'valid' } },
    { id: 'condition_not_met', ko: '일어나지 않았어요', en: 'It did not happen', axes: { reality: 'not_met', question: 'valid' } },
    { id: 'mixed', ko: '일부만 맞았어요', en: 'Only part of it happened', axes: { reality: 'partial', question: 'valid' } },
    { id: 'not_observable', ko: '지금 자료로는 확인할 수 없어요', en: 'I cannot tell from the evidence', axes: { reality: 'not_observable', question: 'indeterminate' } },
    { id: 'moot', ko: '이 질문 자체가 더는 중요하지 않아요', en: 'The question no longer matters', axes: { reality: 'unknown', question: 'moot' } },
  ],
  commitment: [
    { id: 'enacted', ko: '약속한 대로 실행했어요', en: 'I acted on the commitment', axes: { commitment: 'enacted', question: 'valid' } },
    { id: 'maintained', ko: '아직 실행 전이지만 약속은 유지해요', en: 'The commitment still stands', axes: { commitment: 'maintained', question: 'valid' } },
    { id: 'revised', ko: '상황을 보고 약속을 고쳤어요', en: 'I revised the commitment', axes: { commitment: 'revised', question: 'reframed' } },
    { id: 'withdrawn', ko: '이 약속은 철회했어요', en: 'I withdrew the commitment', axes: { commitment: 'withdrawn', question: 'valid' } },
    { id: 'moot', ko: '약속할 이유 자체가 사라졌어요', en: 'The commitment became moot', axes: { commitment: 'superseded', question: 'moot' } },
  ],
  declaration: [
    { id: 'maintained', ko: '지금도 이 기준을 유지해요', en: 'I still hold this standard', axes: { commitment: 'maintained', question: 'valid' } },
    { id: 'revised', ko: '기준을 조금 바꿨어요', en: 'I revised the standard', axes: { commitment: 'revised', question: 'reframed' } },
    { id: 'withdrawn', ko: '이 기준은 더는 따르지 않아요', en: 'I no longer hold it', axes: { commitment: 'withdrawn', question: 'valid' } },
    { id: 'superseded', ko: '더 나은 기준으로 바뀌었어요', en: 'A better standard replaced it', axes: { commitment: 'superseded', question: 'narrowed' } },
    { id: 'moot', ko: '이 기준이 필요한 상황이 끝났어요', en: 'The situation no longer calls for it', axes: { commitment: 'superseded', question: 'moot' } },
  ],
};

export type PresentStandardStatus = NonNullable<ContractSettlement['present_standard']>['status'];

export const PRESENT_STANDARD_STATUSES: PresentStandardStatus[] = [
  'same',
  'changed',
  'withdrawn',
  'skipped',
];

const PRESENT_STANDARD_LABELS: Record<
  Exclude<DecisionKind, 'witness'>,
  Record<PresentStandardStatus, { ko: string; en: string }>
> = {
  prediction: {
    same: { ko: '같은 조건이라면 지금도 같은 판단을 하겠어요', en: 'I would make the same call under the same conditions' },
    changed: { ko: '지금이라면 판단 기준을 바꾸겠어요', en: 'I would use a different standard now' },
    withdrawn: { ko: '이 판단 기준은 더는 쓰지 않겠어요', en: 'I would no longer use this standard' },
    skipped: { ko: '지금은 내 기준이 달라졌는지 모르겠어요', en: 'I am not sure how my standard has changed' },
  },
  commitment: {
    same: { ko: '지금도 같은 약속을 하겠어요', en: 'I would make the same commitment today' },
    changed: { ko: '지금이라면 약속의 조건을 바꾸겠어요', en: 'I would change the terms of the commitment' },
    withdrawn: { ko: '지금은 그 약속을 하지 않겠어요', en: 'I would not make that commitment now' },
    skipped: { ko: '지금은 같은 약속을 할지 모르겠어요', en: 'I am not sure whether I would make it again' },
  },
  declaration: {
    same: { ko: '지금도 같은 기준을 따르겠어요', en: 'I would still follow the same standard' },
    changed: { ko: '지금이라면 기준을 바꾸겠어요', en: 'I would use a different standard now' },
    withdrawn: { ko: '그 기준은 더는 따르지 않겠어요', en: 'I would no longer follow that standard' },
    skipped: { ko: '지금은 내 기준이 달라졌는지 모르겠어요', en: 'I am not sure how my standard has changed' },
  },
};

export function presentStandardLabel(
  kind: Exclude<DecisionKind, 'witness'>,
  status: PresentStandardStatus,
  locale: 'ko' | 'en',
): string {
  return PRESENT_STANDARD_LABELS[kind][status][locale];
}

export function presentStandardQuestion(
  kind: Exclude<DecisionKind, 'witness'>,
  locale: 'ko' | 'en',
): string {
  const questions = {
    prediction: {
      ko: '오늘의 당신도 같은 조건에서 같은 판단을 했을까요?',
      en: 'Would you make the same call under the same conditions today?',
    },
    commitment: {
      ko: '오늘의 당신도 같은 약속을 했을까요?',
      en: 'Would you make the same commitment today?',
    },
    declaration: {
      ko: '오늘의 당신도 같은 기준을 따를까요?',
      en: 'Would you follow the same standard today?',
    },
  };
  return questions[kind][locale];
}

export function axesWithPresentStandard(
  axes: ContractSettlement['axes'],
  status: PresentStandardStatus,
): ContractSettlement['axes'] {
  // The first answer remains canonical verbatim in response_text. When the
  // user also answers the present-standard question, §2c makes that answer the
  // authorial projection of axis ②. Only an explicit skip leaves the
  // first-choice mapping in place.
  if (status === 'skipped') return axes;
  return {
    ...axes,
    commitment: status === 'same'
      ? 'maintained'
      : status === 'changed'
        ? 'revised'
        : 'withdrawn',
  };
}
