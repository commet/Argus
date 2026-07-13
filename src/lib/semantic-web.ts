import {
  fold,
  foldAsOf,
  guardAppendBatch,
  projectJudgment,
  type JudgmentProjection,
  type Resolution,
  type SemanticEvent,
} from '@/lib/decision-kernel';

/** The web account/project is one explicit semantic space, never a global blob. */
export function semanticSpaceId(projectId: string): string {
  return `account-project:${projectId}`;
}

export type SemanticWebCommand =
  | {
      kind: 'seal';
      command_id: string;
      judgment_id: string;
      statement: string;
      return_contract_id: string;
      review_at: string;
      review_question: string;
      resolution_criterion?: string;
    }
  | {
      kind: 'observe';
      command_id: string;
      observation_id: string;
      text: string;
      occurred_at?: string;
      source_ref?: string;
    }
  | {
      kind: 'defer';
      command_id: string;
      return_contract_id: string;
      review_at: string;
      reason?: string;
    }
  | {
      kind: 'resolve';
      command_id: string;
      resolution_id: string;
      judgment_id: string;
      return_contract_id: string;
      resolution: Resolution;
    }
  | {
      /** One direct user action can record what they observed and its answer,
       * but it still never closes the judgment. */
      kind: 'observe_and_resolve';
      command_id: string;
      observation_id: string;
      observation_text: string;
      observation_source_ref?: string;
      resolution_id: string;
      judgment_id: string;
      return_contract_id: string;
      resolution: Resolution;
    }
  | {
      kind: 'close';
      command_id: string;
      judgment_id: string;
      resolution_id: string;
    };

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
  const recordedAt = input.recorded_at ?? new Date().toISOString();
  const { project_id: projectId, command, origin } = input;

  switch (command.kind) {
    case 'seal':
      return {
        ok: true,
        events: [
          {
            ...commandEventBase(projectId, command, recordedAt, 'sealed', origin),
            event: 'judgment_sealed',
            judgment_id: command.judgment_id,
            statement: command.statement,
          },
          {
            ...commandEventBase(projectId, command, recordedAt, 'return', origin),
            event: 'return_promised',
            return_contract_id: command.return_contract_id,
            judgment_id: command.judgment_id,
            review_at: command.review_at,
            review_question: command.review_question,
            ...(command.resolution_criterion ? { resolution_criterion: command.resolution_criterion } : {}),
          },
        ],
      };
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
      return {
        ok: true,
        events: [
          {
            ...commandEventBase(projectId, command, recordedAt, 'observation', origin),
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
            ...commandEventBase(projectId, command, recordedAt, 'resolution', origin),
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
