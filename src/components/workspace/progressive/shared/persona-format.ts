import { localizePersona } from '@/lib/worker-personas';
import type { WorkerPersona } from '@/stores/types';

/** Localized display name/role for a worker persona (empty when none). Shared by
 *  the progressive-flow sub-components so the formatting lives in one place. */
export const personaName = (p: WorkerPersona | null | undefined, locale: 'ko' | 'en'): string =>
  p ? localizePersona(p, locale).name : '';
export const personaRole = (p: WorkerPersona | null | undefined, locale: 'ko' | 'en'): string =>
  p ? localizePersona(p, locale).role : '';
