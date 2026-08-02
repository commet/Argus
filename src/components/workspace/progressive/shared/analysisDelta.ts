import type { AnalysisSnapshot } from '@/stores/types';
import { diffPremiseRows } from './diffItems';

export interface AnalysisDelta {
  questionChanged: boolean;
  decisionChanged: boolean;
  planChanged: boolean;
  premisesAdded: number;
  premisesRemoved: number;
  premisesRevised: number;
  premisesKept: number;
  materialChange: boolean;
}

function normalize(text: string | undefined): string {
  return (text ?? '').trim().replace(/\s+/g, ' ').replace(/[.!?。！？]+$/u, '');
}

function premisesOf(snapshot: AnalysisSnapshot) {
  return (snapshot.premise_records?.length
    ? snapshot.premise_records.map((record) => ({ text: record.text, revised_from: record.revised_from }))
    : (snapshot.hidden_assumptions ?? []).map((text) => ({ text }))).filter((row) => row.text);
}

function premiseCounts(previous: ReturnType<typeof premisesOf>, current: ReturnType<typeof premisesOf>) {
  const rows = diffPremiseRows(previous, current);
  return {
    premisesAdded: rows.filter((row) => row.status === 'new').length,
    premisesRemoved: rows.filter((row) => row.status === 'removed').length,
    premisesRevised: rows.filter((row) => row.status === 'revised').length,
    premisesKept: rows.filter((row) => row.status === 'same').length,
  };
}

/** One definition of "the answer changed the judgment" for UI and telemetry. */
export function analysisDelta(
  previous: AnalysisSnapshot | null | undefined,
  current: AnalysisSnapshot,
): AnalysisDelta {
  if (!previous) {
    return {
      questionChanged: false,
      decisionChanged: false,
      planChanged: false,
      premisesAdded: 0,
      premisesRemoved: 0,
      premisesRevised: 0,
      premisesKept: premisesOf(current).length,
      materialChange: false,
    };
  }

  const premises = premiseCounts(premisesOf(previous), premisesOf(current));
  const questionChanged = normalize(previous.real_question) !== normalize(current.real_question);
  const decisionChanged = normalize(previous.decision_line) !== normalize(current.decision_line);
  const planChanged = (previous.skeleton ?? []).map(normalize).join('\n')
    !== (current.skeleton ?? []).map(normalize).join('\n');
  return {
    questionChanged,
    decisionChanged,
    planChanged,
    ...premises,
    materialChange: questionChanged || decisionChanged || planChanged
      || premises.premisesAdded > 0 || premises.premisesRemoved > 0 || premises.premisesRevised > 0,
  };
}
