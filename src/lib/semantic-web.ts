import { z } from 'zod';
import {
  fold,
  foldAsOf,
  guardAppendBatch,
  projectJudgment,
  ResolutionSchema,
  type JudgmentProjection,
  type SemanticEvent,
} from '@/lib/decision-kernel';

/** The web account/project is one explicit semantic space, never a global blob. */
export function semanticSpaceId(projectId: string): string {
  return `account-project:${projectId}`;
}

const zId = z.string().min(1).max(128);
const zCommandId = z.string().min(1).max(96);
const zIsoDateTime = z.string().datetime({ offset: true });

export const SemanticWebCommandSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('seal'), command_id: zCommandId, judgment_id: zId,
    statement: z.string().min(1).max(4000), return_contract_id: zId,
    review_at: zIsoDateTime, review_question: z.string().min(1).max(4000),
    resolution_criterion: z.string().min(1).max(2000).optional(),
    // Onramp provenance (e.g. document review): when the sealed judgment was
    // adopted from an AI proposal, the seal batch also records that proposal
    // (proposal_created, ai-authored) so the ledger shows "AI proposed → human
    // sealed" with the source document. Omitted for a direct human seal.
    proposal_id: zId.optional(),
    proposal_text: z.string().min(1).max(4000).optional(),
    source_ref: z.string().min(1).max(1024).optional(),
  }),
  z.strictObject({
    kind: z.literal('observe'), command_id: zCommandId, observation_id: zId,
    text: z.string().min(1).max(4000), occurred_at: zIsoDateTime.optional(),
    source_ref: z.string().min(1).max(1024).optional(),
  }),
  z.strictObject({
    kind: z.literal('defer'), command_id: zCommandId, return_contract_id: zId,
    review_at: zIsoDateTime, reason: z.string().min(1).max(2000).optional(),
  }),
  z.strictObject({
    kind: z.literal('resolve'), command_id: zCommandId, resolution_id: zId,
    judgment_id: zId, return_contract_id: zId, resolution: ResolutionSchema,
  }),
  z.strictObject({
    /** One direct user action can record what they observed and its answer,
     * but it still never closes the judgment. */
    kind: z.literal('observe_and_resolve'), command_id: zCommandId,
    observation_id: zId, observation_text: z.string().min(1).max(4000),
    observation_source_ref: z.string().min(1).max(1024).optional(),
    resolution_id: zId, judgment_id: zId, return_contract_id: zId,
    resolution: ResolutionSchema,
  }),
  z.strictObject({
    kind: z.literal('close'), command_id: zCommandId, judgment_id: zId,
    resolution_id: zId,
  }),
]);

export type SemanticWebCommand = z.infer<typeof SemanticWebCommandSchema>;

export interface SemanticWebCommandInput {
  project_id: string;
  command: SemanticWebCommand;
  recorded_at?: string;
  /** A trusted server-side adapter may name a capture surface without creating
   * a second reducer. Browser writes intentionally use the default web origin. */
  origin?: {
    recorder_id: string;
    authorization_mode: 'direct_command' | 'explicit_confirmation';
    authorization_kind: 'user_utterance' | 'command_digest';
    authorization_ref: string;
  };
}

const BrowserSemanticCommandRequestSchema = z.strictObject({
  command: SemanticWebCommandSchema,
});

/** Browser requests may name only a command. Recording and authorization time
 * are assigned by the server; trusted capture adapters call the builder
 * directly with their receipt-backed origin. */
export function semanticWebCommandFromRequest(projectId: string, body: unknown): SemanticWebCommandInput | null {
  const parsed = BrowserSemanticCommandRequestSchema.safeParse(body);
  return parsed.success ? { project_id: projectId, command: parsed.data.command } : null;
}

export type SemanticCommandResult =
  | { ok: true; events: SemanticEvent[] }
  | { ok: false; code: string };

const WEB_RECORDER = { kind: 'system' as const, id: 'web:argus' };

function commandAuthority(projectId: string, command: SemanticWebCommand, recordedAt: string, origin?: SemanticWebCommandInput['origin']) {
  const authorityOrigin = origin ?? {
    recorder_id: 'web:argus',
    authorization_mode: 'explicit_confirmation' as const,
    authorization_kind: 'command_digest' as const,
    authorization_ref: `web-command:${command.kind}:${command.command_id}`,
  };
  return {
    originated_by: { kind: 'human' as const, id: `account-project:${projectId}` },
    recorded_by: { kind: 'system' as const, id: authorityOrigin.recorder_id },
    authorized_by: { kind: 'human' as const, id: `account-project:${projectId}` },
    authorization_mode: authorityOrigin.authorization_mode,
    authorization_ref: {
      kind: authorityOrigin.authorization_kind,
      // This names the exact rendered action receipt, rather than pretending a
      // UI click is an independently verified fact about the world.
      ref: authorityOrigin.authorization_ref,
    },
  };
}

function commandEventBase(projectId: string, command: SemanticWebCommand, recordedAt: string, suffix: string, origin?: SemanticWebCommandInput['origin']) {
  const authority = commandAuthority(projectId, command, recordedAt, origin);
  return {
    event_id: `web:${command.command_id}:${suffix}`,
    v: 3 as const,
    space_id: semanticSpaceId(projectId),
    idempotency_key: `web:${command.command_id}:${suffix}`,
    ...((command.kind === 'seal' || command.kind === 'observe_and_resolve')
      ? { atomic_batch_id: `web:${command.command_id}` }
      : {}),
    time: {
      occurred_at: recordedAt,
      recorded_at: recordedAt,
      authorized_at: recordedAt,
      temporal_mode: 'contemporaneous' as const,
    },
    authority,
  };
}

/**
 * Translates one explicit web command into the canonical v3 event(s).
 * It is intentionally pure: server routes can replay it after loading the
 * canonical ledger, and clients can render an exact pending receipt.
 */
export function buildSemanticWebCommand(input: SemanticWebCommandInput): SemanticCommandResult {
  const parsedCommand = SemanticWebCommandSchema.safeParse(input.command);
  if (!parsedCommand.success || !zId.safeParse(input.project_id).success) {
    return { ok: false, code: 'INVALID_COMMAND' };
  }
  const recordedAt = input.recorded_at ?? new Date().toISOString();
  if (!zIsoDateTime.safeParse(recordedAt).success) return { ok: false, code: 'INVALID_RECORDED_AT' };
  const { project_id: projectId, origin } = input;
  const command = parsedCommand.data;

  switch (command.kind) {
    case 'seal': {
      // Multi-event batches carry an ordinal in the event id. The ledger table
      // stores one created_at per transaction, and every reader breaks the tie
      // with ORDER BY event_id — without the ordinal, ':return' sorts before
      // ':sealed' and the fold drops the return contract as an unknown
      // reference (found by scripts/dogfood, scenario W1 root cause).
      // The onramp proposal (when present) MUST sort first ('0-proposal') so the
      // fold folds it before the seal and marks it adopted via source_proposal_id.
      const events: SemanticEvent[] = [];
      if (command.proposal_id && command.proposal_text) {
        events.push({
          ...commandEventBase(projectId, command, recordedAt, '0-proposal', origin),
          event: 'proposal_created',
          proposal_id: command.proposal_id,
          proposal_kind: 'judgment',
          text: command.proposal_text,
          // AI-authored proposal: originated by ai, recorded by the web system,
          // and NOT human-authorized — only the seal below carries human authority.
          authority: {
            originated_by: { kind: 'ai', id: 'web:argus' },
            recorded_by: { kind: 'system', id: origin?.recorder_id ?? WEB_RECORDER.id },
          },
          provenance: {
            source_kind: 'ai_generation',
            ...(command.source_ref ? { source_ref: command.source_ref } : {}),
            verification: 'unknown',
          },
        });
      }
      events.push(
        {
          ...commandEventBase(projectId, command, recordedAt, '1-sealed', origin),
          event: 'judgment_sealed',
          judgment_id: command.judgment_id,
          statement: command.statement,
          ...(command.proposal_id ? { source_proposal_id: command.proposal_id } : {}),
        },
        {
          ...commandEventBase(projectId, command, recordedAt, '2-return', origin),
          event: 'return_promised',
          return_contract_id: command.return_contract_id,
          judgment_id: command.judgment_id,
          review_at: command.review_at,
          review_question: command.review_question,
          ...(command.resolution_criterion ? { resolution_criterion: command.resolution_criterion } : {}),
        },
      );
      return { ok: true, events };
    }
    case 'observe':
      return {
        ok: true,
        events: [{
          ...commandEventBase(projectId, command, recordedAt, 'observation', origin),
          event: 'observation_recorded',
          observation_id: command.observation_id,
          text: command.text,
          time: {
            occurred_at: command.occurred_at ?? recordedAt,
            recorded_at: recordedAt,
            temporal_mode: command.occurred_at && command.occurred_at !== recordedAt ? 'retrospective' as const : 'contemporaneous' as const,
          },
          authority: {
            originated_by: { kind: 'human' as const, id: `account-project:${projectId}` },
            recorded_by: WEB_RECORDER,
            observed_by: { kind: 'human' as const, id: `account-project:${projectId}` },
          },
          provenance: {
            source_kind: 'user_utterance' as const,
            ...(command.source_ref ? { source_ref: command.source_ref } : {}),
            verification: 'pasted' as const,
          },
        }],
      };
    case 'defer':
      return {
        ok: true,
        events: [{
          ...commandEventBase(projectId, command, recordedAt, 'deferred', origin),
          event: 'return_deferred',
          return_contract_id: command.return_contract_id,
          review_at: command.review_at,
          ...(command.reason ? { reason: command.reason } : {}),
        }],
      };
    case 'resolve':
      return {
        ok: true,
        events: [{
          ...commandEventBase(projectId, command, recordedAt, 'resolution', origin),
          event: 'resolution_asserted',
          resolution_id: command.resolution_id,
          judgment_id: command.judgment_id,
          return_contract_id: command.return_contract_id,
          resolution: command.resolution,
        }],
      };
    case 'observe_and_resolve':
      // Same ordinal rule as 'seal': the observation must fold before the
      // resolution that cites it, in every read order the table can produce.
      return {
        ok: true,
        events: [
          {
            ...commandEventBase(projectId, command, recordedAt, '1-observation', origin),
            event: 'observation_recorded',
            observation_id: command.observation_id,
            text: command.observation_text,
            authority: {
              originated_by: { kind: 'human' as const, id: `account-project:${projectId}` },
              recorded_by: { kind: 'system' as const, id: origin?.recorder_id ?? WEB_RECORDER.id },
              observed_by: { kind: 'human' as const, id: `account-project:${projectId}` },
            },
            provenance: {
              source_kind: 'user_utterance' as const,
              ...(command.observation_source_ref ? { source_ref: command.observation_source_ref } : {}),
              verification: 'pasted' as const,
            },
          },
          {
            ...commandEventBase(projectId, command, recordedAt, '2-resolution', origin),
            event: 'resolution_asserted',
            resolution_id: command.resolution_id,
            judgment_id: command.judgment_id,
            return_contract_id: command.return_contract_id,
            resolution: command.resolution,
          },
        ],
      };
    case 'close':
      return {
        ok: true,
        events: [{
          ...commandEventBase(projectId, command, recordedAt, 'closed', origin),
          event: 'judgment_closed',
          judgment_id: command.judgment_id,
          resolution_id: command.resolution_id,
        }],
      };
  }
}

export function preflightSemanticWebCommand(existing: readonly unknown[], input: SemanticWebCommandInput): SemanticCommandResult {
  const built = buildSemanticWebCommand(input);
  if (!built.ok) return built;
  return guardAppendBatch(existing, built.events) as SemanticCommandResult;
}

export function semanticProjection(events: readonly unknown[], judgmentId: string, now = new Date().toISOString()): JudgmentProjection | undefined {
  return projectJudgment(fold(events), judgmentId, now) as JudgmentProjection | undefined;
}

export function semanticProjectionAsOf(events: readonly unknown[], judgmentId: string, asOf: string): JudgmentProjection | undefined {
  return projectJudgment(foldAsOf(events, asOf), judgmentId, asOf) as JudgmentProjection | undefined;
}
