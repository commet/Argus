import type { DecisionContract, PredicateVerdict } from '@/stores/types';

export function settlementWhatHappenedLine(verdict: PredicateVerdict, locale: 'ko' | 'en' = 'ko'): string {
  const ko = locale === 'ko';
  switch (verdict) {
    case 'happened': return ko ? '대체로 맞았다' : 'Mostly right';
    case 'avoided': return ko ? '피했다' : 'Avoided';
    case 'partial': return ko ? '부분적으로 맞았다' : 'Partly true';
    case 'missed': return ko ? '빗나갔다' : 'Missed';
    case 'unknown': return ko ? '아직 판단하기 어렵다' : 'Too early to tell';
    case 'pending':
    default: return '';
  }
}

export function applySettlementReceipt(
  contract: DecisionContract,
  verdict: PredicateVerdict,
  nowIso: string,
  locale: 'ko' | 'en' = 'ko',
  userNarrative?: string,
): DecisionContract {
  if (!contract.judgment_receipt || verdict === 'pending') return contract;
  const whatHappened = (userNarrative?.trim() || settlementWhatHappenedLine(verdict, locale)).trim();
  if (!whatHappened) return contract;

  return {
    ...contract,
    judgment_receipt: {
      ...contract.judgment_receipt,
      what_happened: whatHappened,
      settled_at: nowIso,
    },
  };
}
