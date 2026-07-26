import { z } from 'zod';
import {
  fold,
  foldAsOf,
  guardAppendBatch,
  projectJudgment,
  ResolutionSchema,
  type JudgmentProjection,
  type Resolution,
  type SemanticEvent,
} from '@/lib/decision-kernel';
import { deriveDecisionKind } from '@/lib/decision-kernel';

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
    statement: z.string().min(1).max(4000),
    decision_kind: z.enum(['prediction', 'commitment', 'declaration', 'witness']).optional(),
    kind_evidence: z.strictObject({
      source: z.enum(['wording_rule', 'elicitation_answer', 'user_override', 'legacy_default']),
      rule: z.string().min(1).max(128),
      question: z.string().max(2000).optional(),
      answer: z.string().max(4000).optional(),
      recorded_at: zIsoDateTime,
    }).optional(),
    origin_utterance: z.string().min(1).max(8000).optional(),
    review_condition_status: z.enum(['answered', 'skipped', 'not_asked']).optional(),
    review_condition: z.string().max(4000).optional(),
    return_contract_id: zId.optional(),
    review_at: zIsoDateTime.optional(), review_question: z.string().min(1).max(4000).optional(),
    review_event: z.string().max(2000).optional(),
    fallback_review_at: zIsoDateTime.optional(),
    resolution_criterion: z.string().min(1).max(2000).optional(),
    // Onramp provenance (e.g. document review): when the sealed judgment was
    // adopted from an AI proposal, the seal batch also records that proposal
    // (proposal_created, ai-authored) so the ledger shows "AI proposed → human
    // sealed" with the source document. Omitted for a direct human seal.
    proposal_id: zId.optional(),
    proposal_text: z.string().min(1).max(4000).optional(),
    source_ref: z.string().min(1).max(1024).optional(),
    adoption_mode: z.enum(['basis', 'check', 'wording']).optional(),
  }),
  z.strictObject({
    kind: z.literal('correct_kind'), command_id: zCommandId, judgment_id: zId,
    from_kind: z.enum(['prediction', 'commitment', 'declaration', 'witness']),
    to_kind: z.enum(['prediction', 'commitment', 'declaration', 'witness']),
    return_contract_id: zId.optional(),
    review_at: zIsoDateTime.optional(),
    review_question: z.string().min(1).max(4000).optional(),
    kind_evidence: z.strictObject({
      source: z.literal('user_override'),
      rule: z.string().min(1).max(128),
      question: z.string().max(2000).optional(),
      answer: z.string().max(4000).optional(),
      recorded_at: zIsoDateTime,
    }),
  }),
  z.strictObject({
    kind: z.literal('revise_statement'), command_id: zCommandId, judgment_id: zId,
    from_statement: z.string().min(1).max(4000),
    to_statement: z.string().min(1).max(4000),
    reason: z.string().max(2000).optional(),
  }),
  z.strictObject({
    kind: z.literal('observe'), command_id: zCommandId, observation_id: zId,
    text: z.string().min(1).max(4000), occurred_at: zIsoDateTime.optional(),
    source_ref: z.string().min(1).max(1024).optional(),
    source_kind: z.enum(['user_report', 'system_receipt', 'ai_analysis']).optional(),
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
    observation_source_kind: z.enum(['user_report', 'system_receipt', 'ai_analysis']).optional(),
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

function withPresentStandardAxis(resolution: Resolution): Resolution {
  const status = resolution.present_standard?.status;
  if (!status || status === 'skipped') return resolution;
  return {
    ...resolution,
    commitment_result: status === 'same'
      ? 'maintained'
      : status === 'changed'
        ? 'revised'
        : 'withdrawn',
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
  if (
    command.kind === 'seal'
    && Boolean(command.proposal_id) !== Boolean(command.proposal_text)
  ) {
    return { ok: false, code: 'PROPOSAL_LINEAGE_INCOMPLETE' };
  }
  if (
    (command.kind === 'resolve' || command.kind === 'observe_and_resolve')
    && (
      !command.resolution.present_standard
      || !command.resolution.present_standard.response_text?.trim()
    )
  ) {
    return { ok: false, code: 'PRESENT_STANDARD_REQUIRED' };
  }

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
      const derived = deriveDecisionKind({
        statement: command.statement,
        explicit_kind: command.decision_kind,
        record_only: command.decision_kind === 'witness',
        has_return_handle: Boolean(command.review_at || command.review_event),
      });
      const kindEvidence = command.kind_evidence ?? {
        source: command.decision_kind ? 'elicitation_answer' as const : 'legacy_default' as const,
        rule: derived.rule,
        answer: command.statement,
        recorded_at: recordedAt,
      };
      const reviewConditionStatus = command.review_condition_status
        ?? (command.review_condition?.trim() ? 'answered' as const : 'not_asked' as const);
      events.push({
          ...commandEventBase(projectId, command, recordedAt, '1-sealed', origin),
          event: 'judgment_sealed',
          judgment_id: command.judgment_id,
          statement: command.statement,
          kind: derived.kind,
          kind_evidence: kindEvidence,
          origin_utterance: command.origin_utterance ?? command.statement,
          review_condition_status: reviewConditionStatus,
          ...(command.review_condition ? { review_condition: command.review_condition } : {}),
          ...(command.proposal_id ? { source_proposal_id: command.proposal_id } : {}),
          ...(command.proposal_id ? { adoption_mode: command.adoption_mode ?? 'wording' as const } : {}),
        });
      if (derived.kind !== 'witness') {
        if (!command.return_contract_id || !command.review_at || !command.review_question) {
          return { ok: false, code: 'RETURN_CONTRACT_REQUIRED' };
        }
        events.push({
          ...commandEventBase(projectId, command, recordedAt, '2-return', origin),
          event: 'return_promised',
          return_contract_id: command.return_contract_id,
          judgment_id: command.judgment_id,
          review_at: command.review_at,
          review_question: command.review_question,
          ...(command.resolution_criterion ? { resolution_criterion: command.resolution_criterion } : {}),
          ...(command.review_event ? { review_event: command.review_event } : {}),
          ...(command.fallback_review_at ? { fallback_review_at: command.fallback_review_at } : {}),
        });
      }
      return { ok: true, events };
    }
    case 'correct_kind': {
      if (command.from_kind === 'witness' && command.to_kind !== 'witness'
        && (!command.return_contract_id || !command.review_at || !command.review_question)) {
        return { ok: false, code: 'RETURN_CONTRACT_REQUIRED' };
      }
      const events: SemanticEvent[] = [{
          ...commandEventBase(projectId, command, recordedAt, 'kind-corrected', origin),
          event: 'judgment_kind_corrected',
          judgment_id: command.judgment_id,
          from_kind: command.from_kind,
          to_kind: command.to_kind,
          kind_evidence: command.kind_evidence,
      }];
      if (command.from_kind === 'witness' && command.to_kind !== 'witness') {
        events.push({
          ...commandEventBase(projectId, command, recordedAt, 'return-promised', origin),
          event: 'return_promised',
          return_contract_id: command.return_contract_id!,
          judgment_id: command.judgment_id,
          review_at: command.review_at!,
          review_question: command.review_question!,
        });
      }
      return { ok: true, events };
    }
    case 'revise_statement':
      return {
        ok: true,
        events: [{
          ...commandEventBase(projectId, command, recordedAt, 'statement-revised', origin),
          event: 'judgment_statement_revised',
          judgment_id: command.judgment_id,
          from_statement: command.from_statement,
          to_statement: command.to_statement,
          ...(command.reason ? { reason: command.reason } : {}),
        }],
      };
    case 'observe':
      return {
        ok: true,
        events: [{
          ...commandEventBase(projectId, command, recordedAt, 'observation', origin),
          event: 'observation_recorded',
          observation_id: command.observation_id,
          text: command.text,
          source_kind: command.source_kind ?? 'user_report',
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
          resolution: withPresentStandardAxis(command.resolution),
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
            source_kind: command.observation_source_kind ?? 'user_report',
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
            resolution: withPresentStandardAxis(command.resolution),
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
