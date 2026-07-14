/**
 * One dogfood world = one emulated account universe + evidence + invariants.
 * Scenarios speak to surfaces only through `step()`, which snapshots the
 * admitted stream before/after, checks the semantic invariants, compares the
 * observed outcome against the scripted expectation, and records everything.
 */
import path from 'node:path';
import { fold, projectJudgment } from '../../../src/lib/decision-kernel';
import type { DecisionContract } from '../../../src/stores/types';
import { EvidenceRecorder, sha256, type StepOutcome } from './evidence';
import { checkStreamInvariants, type InvariantFailure } from './invariants';
import { Rng } from './rng';
import { SupabaseEmulator } from './supabase-emulator';
import { PluginSurface, TelegramSurface, WebSurface, type ActionResult } from './surfaces';

export interface Expectation {
  ok: boolean;
  code?: string;
  status?: number;
  /** Every receipt row must carry this duplicate flag. */
  duplicate?: boolean;
  /** Exactly this many events must have been appended by the step. */
  appended?: number;
}

export interface Finding {
  scenario: string;
  step: string;
  kind: 'expectation' | 'invariant';
  detail: string;
  seed: number;
}

export class ScenarioAbort extends Error {}

export class World {
  readonly emu = new SupabaseEmulator();
  readonly userId: string;
  readonly otherUserId: string;
  readonly web: WebSurface;
  readonly webAsOther: WebSurface;
  readonly telegram: TelegramSurface;
  readonly findings: Finding[] = [];
  steps = 0;
  private snapshots = new Map<string, string[]>();

  constructor(
    readonly rng: Rng,
    readonly evidence: EvidenceRecorder,
    readonly scratchDir: string,
  ) {
    this.userId = rng.uuid();
    this.otherUserId = rng.uuid();
    this.web = new WebSurface(this.emu, this.userId);
    this.webAsOther = new WebSurface(this.emu, this.otherUserId);
    this.telegram = new TelegramSurface(this.emu, this.userId, rng);
  }

  newPluginSurface(name: string): PluginSurface {
    // Path must be unique per WORLD, not per scenario name — repeat rounds
    // reuse names and must never read a previous round's jsonl.
    return new PluginSurface(this.emu, this.userId, this.rng, path.join(this.scratchDir, 'plugin-ledgers', `${name}-${this.userId.slice(0, 8)}-${this.rng.int(1_000_000)}`));
  }

  newProject(name = 'dogfood project'): string {
    const id = this.rng.uuid();
    this.emu.projects.push({ id, user_id: this.userId, name, decision_contract: null });
    return id;
  }

  newForeignProject(): string {
    const id = this.rng.uuid();
    this.emu.projects.push({ id, user_id: this.otherUserId, name: 'someone else', decision_contract: null });
    return id;
  }

  contract(projectId: string, judgmentId: string): DecisionContract {
    return {
      id: this.rng.uuid(),
      project_id: projectId,
      predicates: [],
      created_at: this.emu.nowIso(),
      semantic_judgment_id: judgmentId,
    } as DecisionContract;
  }

  pointer(projectId: string): string | undefined {
    const project = this.emu.projects.find((p) => p.id === projectId);
    return (project?.decision_contract as { semantic_judgment_id?: string } | null | undefined)?.semantic_judgment_id;
  }

  stream(projectId: string, userId = this.userId): unknown[] {
    return this.emu.semanticEvents
      .filter((r) => r.user_id === userId && r.project_id === projectId)
      .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1
        : a.event_id < b.event_id ? -1 : a.event_id > b.event_id ? 1 : 0))
      .map((r) => r.event);
  }

  projection(projectId: string, judgmentId: string) {
    return projectJudgment(fold(this.stream(projectId)), judgmentId, this.emu.nowIso());
  }

  /**
   * Run one step: execute, verify expectation, verify invariants, record.
   * Expectation mismatch aborts the scenario (later steps would cascade);
   * invariant failure records a critical finding and continues.
   */
  async step(
    meta: { scenario: string; step: string; surface: 'web' | 'telegram' | 'plugin' | 'kernel' | 'cross'; action: string; projectId?: string; note?: string },
    expect: Expectation | null,
    run: () => Promise<ActionResult>,
  ): Promise<ActionResult> {
    const started = Date.now();
    this.steps += 1;
    const previous = meta.projectId ? (this.snapshots.get(meta.projectId) ?? []) : [];
    let result: ActionResult;
    try {
      result = await run();
    } catch (error) {
      result = { ok: false, code: `THROWN:${(error as Error).message}` };
    }

    const invariantFailures: InvariantFailure[] = [];
    if (meta.projectId) {
      const current = this.emu.snapshotStream(this.userId, meta.projectId);
      invariantFailures.push(...checkStreamInvariants({
        events: this.stream(meta.projectId),
        previousSnapshot: previous,
        currentSnapshot: current,
        now: this.emu.nowIso(),
      }));
      this.snapshots.set(meta.projectId, current);
    }

    const mismatches: string[] = [];
    if (expect) {
      if (result.ok !== expect.ok) mismatches.push(`ok: expected ${expect.ok}, got ${result.ok} (code=${result.code ?? '-'})`);
      if (expect.code !== undefined && result.code !== expect.code) mismatches.push(`code: expected ${expect.code}, got ${result.code ?? '-'}`);
      if (expect.status !== undefined && result.status !== expect.status) mismatches.push(`status: expected ${expect.status}, got ${result.status ?? '-'}`);
      if (expect.duplicate !== undefined) {
        const flags = result.duplicate ?? [];
        if (flags.length === 0 || !flags.every((f) => f === expect.duplicate)) {
          mismatches.push(`duplicate: expected all=${expect.duplicate}, got [${flags.join(',')}]`);
        }
      }
      if (expect.appended !== undefined && meta.projectId) {
        const appended = (this.snapshots.get(meta.projectId)?.length ?? 0) - previous.length;
        if (appended !== expect.appended) mismatches.push(`appended: expected ${expect.appended}, got ${appended}`);
      }
    }

    const eventIds = (result.built ?? result.events ?? [])
      .map((e) => String((e as { event_id?: unknown }).event_id ?? ''))
      .filter(Boolean);
    const keys = (result.built ?? result.events ?? [])
      .map((e) => String((e as { idempotency_key?: unknown }).idempotency_key ?? ''))
      .filter(Boolean);

    const outcome: StepOutcome = { ok: result.ok, code: result.code, status: result.status, duplicate: result.duplicate };
    this.evidence.record({
      scenario: meta.scenario,
      step: meta.step,
      surface: meta.surface,
      action: meta.action,
      outcome,
      expected: expect ? JSON.stringify(expect) : undefined,
      matched: mismatches.length === 0,
      event_ids: eventIds.slice(0, 24),
      idempotency_keys: keys.slice(0, 24),
      content_sha256: (result.built ?? []).slice(0, 8).map((e) => sha256(e)),
      invariant_failures: invariantFailures.map((f) => `${f.id}: ${f.detail}`),
      note: [meta.note, result.note].filter(Boolean).join(' | ') || undefined,
      elapsed_ms: Date.now() - started,
    });

    for (const failure of invariantFailures) {
      this.findings.push({ scenario: meta.scenario, step: meta.step, kind: 'invariant', detail: `${failure.id}: ${failure.detail}`, seed: this.rng.seed });
    }
    if (mismatches.length > 0) {
      this.findings.push({ scenario: meta.scenario, step: meta.step, kind: 'expectation', detail: mismatches.join('; '), seed: this.rng.seed });
      throw new ScenarioAbort(`${meta.scenario}/${meta.step}: ${mismatches.join('; ')}`);
    }
    return result;
  }
}

export interface Scenario {
  id: string;
  title: string;
  /** What this scenario proves when green / what a red means. */
  proves: string;
  run(world: World): Promise<void>;
}
