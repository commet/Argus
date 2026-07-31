import { localizePersona } from '@/lib/worker-personas';
import type { WorkerPersona } from '@/stores/types';

/** The engine may use personas internally, but the product surface names the
 * review being performed — not a fictional coworker. */
export const personaReviewLabel = (
  p: WorkerPersona | null | undefined,
  locale: 'ko' | 'en',
): string => {
  if (!p) return locale === 'ko' ? 'AI 검토' : 'AI review';
  const evidence = new Set(['researcher', 'research_director', 'intern']);
  const risk = new Set(['critic']);
  const synthesis = new Set(['navigator', 'chief_strategist']);
  const label: [string, string] = evidence.has(p.id)
    ? ['근거 확인', 'Evidence check']
    : risk.has(p.id)
      ? ['위험 검토', 'Risk review']
      : synthesis.has(p.id)
        ? ['종합 정리', 'Synthesis']
        : ['전문 검토', 'Specialist review'];
  return locale === 'ko' ? label[0] : label[1];
};

/** Back-compatible helper used across the heavy flow. It deliberately returns
 * a functional label instead of the persona's human name. */
export const personaName = (p: WorkerPersona | null | undefined, locale: 'ko' | 'en'): string =>
  p ? personaReviewLabel(p, locale) : '';
export const personaRole = (p: WorkerPersona | null | undefined, locale: 'ko' | 'en'): string =>
  p ? localizePersona(p, locale).role : '';

/** Router traces can mention the next fictional persona candidate. Keep the
 * useful matching rationale while removing that internal identity. */
export const publicAssignmentReason = (reason: string): string =>
  reason
    .replace(/\s*[·|]\s*다음 후보[^·|]*/giu, '')
    .replace(/\s*[·|]\s*next candidate[^·|]*/giu, '')
    .trim();
