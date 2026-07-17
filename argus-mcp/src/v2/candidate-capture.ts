import fs from 'node:fs';
import { createHash } from 'node:crypto';
import type { V2Context } from './bridge.js';
import { harvestCandidateV2 } from './bridge.js';
import { detect } from './gate.js';
import { makeEvidencePointerAt, type EvidencePointer } from './evidence.js';

export const CAPTURE_POLICY_MAJOR = 1;

export type CaptureTrigger = 'explicit_scan' | 'background_queue' | 'manual_import';

export interface TranscriptTurn {
  role: 'user';
  content: string;
  source_order: number;
}

export interface ExtractedCandidate {
  quote: string;
  typed_span: 'declarative' | 'deferred';
  sub_index: number;
}

export interface CandidateExtractorPort {
  readonly name: string;
  extract(turn: TranscriptTurn): Promise<readonly ExtractedCandidate[]> | readonly ExtractedCandidate[];
}

export interface CaptureResult {
  trigger: CaptureTrigger;
  transcript_path: string;
  session_id: string;
  utterances_scanned: number;
  candidates_created: string[];
  duplicate_candidates: number;
  no_candidate: boolean;
  quote_not_found: number;
  sensitive_blocked: number;
  sensitive_categories: string[];
  capped: number;
  extractor: string;
  policy_major: number;
}

const sha256 = (value: Buffer | string): string =>
  createHash('sha256').update(value).digest('hex');

export const deterministicCandidateExtractor: CandidateExtractorPort = {
  name: 'argus-deterministic-decision-floor-v1',
  extract(turn) {
    const verdict = detect(turn.content);
    if (!verdict.fire) return [];
    return [{ quote: turn.content.slice(0, 2000), typed_span: verdict.kind, sub_index: 0 }];
  },
};

export function sensitiveCategories(text: string): string[] {
  const categories: string[] = [];
  const rules: Array<[string, RegExp]> = [
    ['private_key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i],
    ['bearer_token', /\bBearer\s+[A-Za-z0-9._~+\/-]{16,}/i],
    ['provider_token', /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{16,}|AKIA[0-9A-Z]{16})\b/],
    ['assigned_secret', /\b(?:password|passwd|api[_-]?key|secret|token)\s*[:=]\s*[^\s,;]{8,}/i],
    ['assigned_secret', /(?:비밀번호|암호|API\s*키|토큰)\s*(?:은|는|:|=)\s*[^\s,;]{8,}/i],
  ];
  for (const [category, pattern] of rules) {
    if (pattern.test(text)) categories.push(category);
  }
  return categories;
}

export function stableCandidateIdentity(args: {
  source_origin_id: string;
  source_session_id: string;
  evidence: EvidencePointer;
  typed_span: ExtractedCandidate['typed_span'];
  sub_index: number;
  capture_policy_major?: number;
}): string {
  return `cap-${sha256(JSON.stringify({
    source_origin_id: args.source_origin_id,
    source_session_id: args.source_session_id,
    quote_byte_start: args.evidence.quote_byte_start,
    quote_byte_end: args.evidence.quote_byte_end,
    raw_quote_sha256: args.evidence.raw_quote_sha256,
    capture_policy_major: args.capture_policy_major ?? CAPTURE_POLICY_MAJOR,
    typed_span: args.typed_span,
    sub_index: args.sub_index,
  })).slice(0, 24)}`;
}

export function readTranscriptTurns(raw: Buffer): TranscriptTurn[] {
  const turns: TranscriptTurn[] = [];
  let sourceOrder = 0;
  for (const line of raw.toString('utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line) as {
        type?: string;
        isSidechain?: boolean;
        isMeta?: boolean;
        message?: { role?: string; content?: unknown };
      };
      if (record.isSidechain || record.isMeta || record.type === 'attachment') continue;
      if (record.type === 'user' && record.message?.role === 'user') {
        const content = record.message.content;
        const texts = typeof content === 'string'
          ? [content]
          : Array.isArray(content)
            ? content.flatMap((part) => {
              if (!part || typeof part !== 'object') return [];
              const block = part as { type?: unknown; text?: unknown };
              return block.type === 'text' && typeof block.text === 'string' ? [block.text] : [];
            })
            : [];
        for (const rawText of texts) {
          const text = rawText.trim();
          if (!text || /^<(?:local-command-caveat|command-name|system-reminder)/.test(text)
            || /^Caveat: The messages below/.test(text)) continue;
          turns.push({ role: 'user', content: text, source_order: sourceOrder });
        }
      }
    } catch {
      // Host transcript corruption is counted by host tooling; capture remains
      // bounded and never invents content from a torn line.
    }
    sourceOrder += 1;
  }
  return turns;
}

export async function captureTranscriptFile(args: {
  ctx: V2Context;
  transcript_path: string;
  session_id: string;
  source_origin_id: string;
  trigger: CaptureTrigger;
  extractor?: CandidateExtractorPort;
  max_candidates?: number;
}): Promise<CaptureResult> {
  const raw = fs.readFileSync(args.transcript_path);
  const turns = readTranscriptTurns(raw);
  const extractor = args.extractor ?? deterministicCandidateExtractor;
  let searchCursor = 0;
  let remaining = args.max_candidates ?? Number.POSITIVE_INFINITY;
  const result: CaptureResult = {
    trigger: args.trigger,
    transcript_path: args.transcript_path,
    session_id: args.session_id,
    utterances_scanned: turns.length,
    candidates_created: [],
    duplicate_candidates: 0,
    no_candidate: false,
    quote_not_found: 0,
    sensitive_blocked: 0,
    sensitive_categories: [],
    capped: 0,
    extractor: extractor.name,
    policy_major: CAPTURE_POLICY_MAJOR,
  };

  for (const turn of turns) {
    const blocked = sensitiveCategories(turn.content);
    if (blocked.length > 0) {
      result.sensitive_blocked += 1;
      result.sensitive_categories.push(...blocked);
      // Do not hash or search the secret-bearing quote.
      continue;
    }
    const proposals = await extractor.extract(turn);
    for (const proposal of proposals) {
      if (remaining <= 0) {
        result.capped += 1;
        continue;
      }
      const evidence = makeEvidencePointerAt(
        raw,
        args.transcript_path,
        proposal.quote,
        'user',
        searchCursor,
      );
      if (!evidence) {
        result.quote_not_found += 1;
        continue;
      }
      searchCursor = evidence.quote_byte_end;
      const candidateId = stableCandidateIdentity({
        source_origin_id: args.source_origin_id,
        source_session_id: args.session_id,
        evidence,
        typed_span: proposal.typed_span,
        sub_index: proposal.sub_index,
      });
      const appended = harvestCandidateV2(args.ctx, {
        candidateId,
        kind: 'decision',
        quote: proposal.quote,
        quoteSpeaker: 'user',
        evidence: evidence as unknown as Record<string, unknown>,
        idempotencyKey: candidateId,
      });
      if (appended.appended) result.candidates_created.push(candidateId);
      else result.duplicate_candidates += 1;
      remaining -= 1;
    }
  }
  result.sensitive_categories = [...new Set(result.sensitive_categories)].sort();
  result.no_candidate = result.candidates_created.length === 0
    && result.duplicate_candidates === 0;
  return result;
}
