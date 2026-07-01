export const ANALYSIS_REQUEST_TYPES = [
  'open',
  'flat',
  'vent',
  'validation',
  'info',
  'resistance',
  'self_profiling',
  'crisis',
] as const;
export type AnalysisRequestType = typeof ANALYSIS_REQUEST_TYPES[number];

export const LEGACY_PLUGIN_REQUEST_TYPES = ['open_decision'] as const;
export type LegacyPluginRequestType = typeof LEGACY_PLUGIN_REQUEST_TYPES[number];

export const FRAME_STATUSES = ['flat', 'load_bearing'] as const;
export const DECISION_DENSITIES = ['low', 'medium', 'high'] as const;
export const ANALYSIS_STAKES = ['routine', 'important', 'critical'] as const;
export const ANALYSIS_REVERSIBILITIES = ['reversible', 'partial', 'irreversible'] as const;

export function normalizeRequestType(value: unknown): AnalysisRequestType | undefined {
  if (value === 'open_decision') return 'open';
  return ANALYSIS_REQUEST_TYPES.includes(value as AnalysisRequestType)
    ? value as AnalysisRequestType
    : undefined;
}

export function normalizeDecisionDensity(value: unknown): typeof DECISION_DENSITIES[number] | undefined {
  return DECISION_DENSITIES.includes(value as typeof DECISION_DENSITIES[number])
    ? value as typeof DECISION_DENSITIES[number]
    : undefined;
}
