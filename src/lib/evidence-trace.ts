import { extractKeyFinding } from '@/lib/extract-key-finding';
import type { ProgressiveSession } from '@/stores/types';
import { resolveAgentType } from '@/stores/types';

export type TraceSourceKind = 'message' | 'analysis' | 'document' | 'url';
export type TraceAuthorship = 'user' | 'human' | 'ai' | 'external';
export type TraceClaimRole = 'question' | 'decision' | 'claim' | 'assumption';
export type TraceClaimStatus = 'open' | 'synthesized' | 'needs_evidence';
export type TraceRelation = 'derived_from' | 'contributed_to' | 'supports';
export type TraceStrength = 'direct' | 'contextual' | 'unverified';

export interface TraceSource {
  id: string;
  kind: TraceSourceKind;
  locator: string;
  label: string;
  detail?: string;
  excerpt: string;
  authorship: TraceAuthorship;
  reviewed?: boolean;
}

export interface TraceClaim {
  id: string;
  role: TraceClaimRole;
  text: string;
  status: TraceClaimStatus;
}

export interface TraceEdge {
  claim_id: string;
  source_id: string;
  relation: TraceRelation;
  strength: TraceStrength;
}

export interface DecisionTrace {
  focus_claim_id: string;
  claims: TraceClaim[];
  sources: TraceSource[];
  edges: TraceEdge[];
}

export const TRACE_NAVIGATE_EVENT = 'argus:trace-navigate';

export type ParsedTraceLocator =
  | { scope: 'workspace'; sessionId: string; target: 'input' }
  | { scope: 'workspace'; sessionId: string; target: 'answer'; targetId: string }
  | { scope: 'workspace'; sessionId: string; target: 'worker'; targetId: string }
  | { scope: 'document'; documentId: string; page: number; bbox?: [number, number, number, number] }
  | { scope: 'project'; projectId: string; target: 'contract' }
  | { scope: 'project'; projectId: string; target: 'item'; targetId: string }
  | { scope: 'review'; receiptId: string; premiseId?: string }
  | { scope: 'rehearse'; recordId: string; target: 'document'; line: number }
  | { scope: 'rehearse'; recordId: string; target: 'feedback'; personaId: string; kind: string; index: number }
  | { scope: 'synthesize'; itemId: string; target: 'source'; sourceIndex: number; line: number }
  | { scope: 'synthesize'; itemId: string; target: 'conflict'; conflictId: string }
  | { scope: 'url'; url: string };

const enc = (value: string) => encodeURIComponent(value);

export const traceLocators = {
  workspaceInput: (sessionId: string) => `argus://workspace/${enc(sessionId)}/input`,
  answer: (sessionId: string, questionId: string) => `argus://workspace/${enc(sessionId)}/answer/${enc(questionId)}`,
  worker: (sessionId: string, workerId: string) => `argus://workspace/${enc(sessionId)}/worker/${enc(workerId)}`,
  documentRegion: (documentId: string, page: number, bbox?: [number, number, number, number]) => {
    const base = `argus://document/${enc(documentId)}/page/${Math.max(1, Math.trunc(page))}`;
    return bbox ? `${base}#xywh=${bbox.map((value) => Number(value.toFixed(4))).join(',')}` : base;
  },
  projectContract: (projectId: string) => `argus://project/${enc(projectId)}/contract`,
  projectItem: (projectId: string, itemId: string) => `argus://project/${enc(projectId)}/item/${enc(itemId)}`,
  reviewReceipt: (receiptId: string) => `argus://review/${enc(receiptId)}`,
  reviewPremise: (receiptId: string, premiseId: string) => `argus://review/${enc(receiptId)}/premise/${enc(premiseId)}`,
  rehearseDocument: (recordId: string, line: number) => `argus://rehearse/${enc(recordId)}/document/line/${Math.max(1, Math.trunc(line))}`,
  rehearseFeedback: (recordId: string, personaId: string, kind: string, index: number) => `argus://rehearse/${enc(recordId)}/persona/${enc(personaId)}/${enc(kind)}/${Math.max(0, Math.trunc(index))}`,
  synthesizeSource: (itemId: string, sourceIndex: number, line: number) => `argus://synthesize/${enc(itemId)}/source/${Math.max(0, Math.trunc(sourceIndex))}/line/${Math.max(1, Math.trunc(line))}`,
  synthesizeConflict: (itemId: string, conflictId: string) => `argus://synthesize/${enc(itemId)}/conflict/${enc(conflictId)}`,
  url: (url: string) => url,
};

export function parseTraceLocator(locator: string): ParsedTraceLocator | null {
  if (/^https?:\/\//i.test(locator)) return { scope: 'url', url: locator };
  if (!locator.startsWith('argus://')) return null;

  try {
    const url = new URL(locator);
    const parts = url.pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part));
    if (url.hostname === 'workspace' && parts.length >= 2) {
      const [sessionId, target, targetId] = parts;
      if (target === 'input') return { scope: 'workspace', sessionId, target };
      if ((target === 'answer' || target === 'worker') && targetId) {
        return { scope: 'workspace', sessionId, target, targetId };
      }
    }
    if (url.hostname === 'document' && parts.length >= 3 && parts[1] === 'page') {
      const page = Number.parseInt(parts[2], 10);
      if (!parts[0] || !Number.isFinite(page) || page < 1) return null;
      const xywh = url.hash.match(/^#xywh=([\d.,-]+)$/)?.[1]
        .split(',')
        .map(Number);
      const bbox = xywh?.length === 4 && xywh.every(Number.isFinite)
        ? xywh as [number, number, number, number]
        : undefined;
      return { scope: 'document', documentId: parts[0], page, bbox };
    }
    if (url.hostname === 'project' && parts.length >= 2) {
      const [projectId, target, targetId] = parts;
      if (target === 'contract') return { scope: 'project', projectId, target };
      if (target === 'item' && targetId) return { scope: 'project', projectId, target, targetId };
    }
    if (url.hostname === 'review' && parts[0]) {
      return { scope: 'review', receiptId: parts[0], premiseId: parts[1] === 'premise' ? parts[2] : undefined };
    }
    if (url.hostname === 'rehearse' && parts[0]) {
      if (parts[1] === 'document' && parts[2] === 'line') {
        const line = Number.parseInt(parts[3], 10);
        if (Number.isFinite(line) && line >= 1) return { scope: 'rehearse', recordId: parts[0], target: 'document', line };
      }
      if (parts[1] === 'persona' && parts[2] && parts[3]) {
        const index = Number.parseInt(parts[4], 10);
        if (Number.isFinite(index) && index >= 0) return { scope: 'rehearse', recordId: parts[0], target: 'feedback', personaId: parts[2], kind: parts[3], index };
      }
    }
    if (url.hostname === 'synthesize' && parts[0]) {
      if (parts[1] === 'source' && parts[2] && parts[3] === 'line') {
        const sourceIndex = Number.parseInt(parts[2], 10);
        const line = Number.parseInt(parts[4], 10);
        if (Number.isFinite(sourceIndex) && sourceIndex >= 0 && Number.isFinite(line) && line >= 1) {
          return { scope: 'synthesize', itemId: parts[0], target: 'source', sourceIndex, line };
        }
      }
      if (parts[1] === 'conflict' && parts[2]) {
        return { scope: 'synthesize', itemId: parts[0], target: 'conflict', conflictId: parts[2] };
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function openTraceLocator(locator: string): void {
  if (typeof window === 'undefined') return;
  const parsed = parseTraceLocator(locator);
  if (!parsed) return;
  if (parsed?.scope === 'url') {
    window.open(parsed.url, '_blank', 'noopener,noreferrer');
    return;
  }
  window.dispatchEvent(new CustomEvent(TRACE_NAVIGATE_EVENT, { detail: { locator } }));
}

interface WorkspaceTraceOptions {
  locale: 'ko' | 'en';
  workerName: (workerId: string) => string;
}

/**
 * Read projection for the web UI. It does not invent evidence: user material is
 * derived-from context, worker output is contribution, and assumptions remain
 * source-less until a real artifact or observation is attached.
 */
export function buildWorkspaceDecisionTrace(
  session: ProgressiveSession,
  options: WorkspaceTraceOptions,
): DecisionTrace {
  const latest = session.snapshots.at(-1) ?? null;
  const finalMix = session.final_mix ?? session.mix;
  const focus: TraceClaim = {
    id: `claim:${session.id}:focus`,
    role: finalMix ? 'decision' : 'question',
    text: finalMix?.executive_summary || latest?.real_question || session.problem_text,
    status: finalMix ? 'synthesized' : 'open',
  };

  const sources: TraceSource[] = [{
    id: `source:${session.id}:input`,
    kind: 'message',
    locator: traceLocators.workspaceInput(session.id),
    label: options.locale === 'ko' ? '처음 적은 상황' : 'Original situation',
    excerpt: session.problem_text,
    authorship: 'user',
  }];
  const edges: TraceEdge[] = [{
    claim_id: focus.id,
    source_id: sources[0].id,
    relation: 'derived_from',
    strength: 'contextual',
  }];

  for (const answer of session.answers) {
    const question = session.questions.find((item) => item.id === answer.question_id);
    const source: TraceSource = {
      id: `source:${session.id}:answer:${answer.question_id}`,
      kind: 'message',
      locator: traceLocators.answer(session.id, answer.question_id),
      label: question?.text || (options.locale === 'ko' ? 'Argus의 질문' : 'Argus question'),
      excerpt: answer.value,
      authorship: 'user',
    };
    sources.push(source);
    edges.push({ claim_id: focus.id, source_id: source.id, relation: 'derived_from', strength: 'contextual' });
  }

  const contributorIds = new Set(
    (finalMix?.sections || []).flatMap((section) => [
      ...(section.contributor_worker_ids || []),
      ...(section.sentences || []).flatMap((sentence) => sentence.contributor_worker_ids || []),
    ]),
  );
  for (const worker of session.workers) {
    const raw = worker.human_input || worker.result || worker.ai_preliminary || '';
    if (!raw || worker.approved === false) continue;
    if (contributorIds.size > 0 && !contributorIds.has(worker.id) && worker.approved !== true) continue;
    const agentType = resolveAgentType(worker);
    const source: TraceSource = {
      id: `source:${session.id}:worker:${worker.id}`,
      kind: 'analysis',
      locator: traceLocators.worker(session.id, worker.id),
      label: options.workerName(worker.id),
      detail: worker.task,
      excerpt: extractKeyFinding(raw) || raw.slice(0, 160),
      authorship: agentType === 'ai' ? 'ai' : agentType === 'human' ? 'human' : 'user',
      reviewed: worker.approved === true,
    };
    sources.push(source);
    edges.push({ claim_id: focus.id, source_id: source.id, relation: 'contributed_to', strength: 'contextual' });
  }

  const assumptionTexts = Array.from(new Set([
    ...(finalMix?.key_assumptions || []),
    ...(latest?.hidden_assumptions || []),
  ])).slice(0, 8);
  const claims: TraceClaim[] = [focus, ...assumptionTexts.map((text, index) => ({
    id: `claim:${session.id}:assumption:${index}`,
    role: 'assumption' as const,
    text,
    status: 'needs_evidence' as const,
  }))];

  return { focus_claim_id: focus.id, claims, sources, edges };
}
