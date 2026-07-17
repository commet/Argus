import { SemanticEventSchema, V4_SHADOW_ENV, type SemanticEvent } from './types.js';

export interface ShadowEnvironment {
  ARGUS_SEMANTIC_V4_SHADOW?: string;
}

export interface ShadowSink {
  append(events: readonly SemanticEvent[]): Promise<void>;
}

export type ShadowWriteResult =
  | { status: 'disabled'; written: 0 }
  | { status: 'written'; written: number }
  | { status: 'failed'; written: 0; error_code: 'SHADOW_WRITE_FAILED' | 'INVALID_V4_EVENT' };

export function isV4ShadowEnabled(env: ShadowEnvironment): boolean {
  return env[V4_SHADOW_ENV] === '1';
}

export async function shadowWrite(
  candidates: readonly unknown[],
  sink: ShadowSink,
  env: ShadowEnvironment,
): Promise<ShadowWriteResult> {
  if (!isV4ShadowEnabled(env)) return { status: 'disabled', written: 0 };
  const parsed: SemanticEvent[] = [];
  for (const candidate of candidates) {
    const result = SemanticEventSchema.safeParse(candidate);
    if (!result.success) return { status: 'failed', written: 0, error_code: 'INVALID_V4_EVENT' };
    parsed.push(result.data);
  }
  try {
    await sink.append(parsed);
    return { status: 'written', written: parsed.length };
  } catch {
    return { status: 'failed', written: 0, error_code: 'SHADOW_WRITE_FAILED' };
  }
}
