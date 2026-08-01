/**
 * Public labels for blind divergence samples.
 *
 * These are repeated reads under the same conditions, not coworkers and not
 * distinct expert personas. Keeping the labels neutral prevents the UI from
 * implying that agreement between samples is independent expert consensus.
 */
export interface ProbeExecutorLabel {
  name: string;
  sample_index: number;
}

export function probeExecutorLabels(
  n: number,
  locale: 'ko' | 'en' = 'ko',
): ProbeExecutorLabel[] {
  const count = Math.max(1, Math.min(5, n));
  return Array.from({ length: count }, (_, index) => ({
    name: locale === 'ko' ? `독립 검토 ${index + 1}` : `Independent read ${index + 1}`,
    sample_index: index,
  }));
}
