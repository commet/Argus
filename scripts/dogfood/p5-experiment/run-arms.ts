/**
 * P5 experiment — arm runner.
 *
 * For each scenario in scenarios.ts this produces the two artifacts a blind
 * reconstructor will read months "later":
 *
 *  - baseline arm  : decision_journal_template — a diligent journal entry
 *                    filled at seal time + the raw transcript (this is the
 *                    preregistered baseline #3; the transcript is also what
 *                    baseline #1 searches). Built here deterministically the
 *                    way a template user would: title/decision/reasons/review
 *                    date, ONE free-text blob, no authority/temporal split.
 *  - dkk arm       : the REAL v3 ledger produced by driving the production
 *                    command builders + gateway + RPC port (WebSurface) with
 *                    the scenario's explicit user commands, then the rendered
 *                    projection + event log (what the product would show).
 *
 * Confirmation-action counting (deterministic, from the command flow itself):
 *  - dkk: one per authorial command the user explicitly confirms
 *    (seal=1, defer=1 each, observe_and_resolve=1, close=1; plain observe
 *    recorded by AI/host = 0).
 *  - baseline: one per journal write (initial entry = 1, each outcome
 *    update = 1).
 *
 * Task seconds are measured wall-clock of the recording agent performing each
 * arm — labeled agent-time in the evidence (never presented as human time).
 *
 * Usage: npx tsx scripts/dogfood/p5-experiment/run-arms.ts <out-dir>
 */
import fs from 'node:fs';
import path from 'node:path';
import { SupabaseEmulator } from '../harness/supabase-emulator';
import { WebSurface } from '../harness/surfaces';
import { P5_SCENARIOS, type P5Scenario } from './scenarios';
import { semanticProjection } from '../../../src/lib/semantic-web';

interface ArmArtifact {
  scenario_id: string;
  arm: 'baseline' | 'dkk_v6';
  confirmation_actions: number;
  task_seconds_agent: number;
  completed_lifecycle: boolean;
  /** What the reconstructor gets to read. */
  record: unknown;
  /** Transcript is available to BOTH arms (baseline #1 raw search parity). */
  transcript: P5Scenario['transcript'];
}

function isoDate(at: string): string {
  return at.slice(0, 10);
}

/** A diligent decision-journal entry: what template users actually write. */
function baselineJournal(s: P5Scenario): { entries: Array<{ at: string; text: string }>; confirmations: number } {
  const sealTurn = s.transcript[s.seal_after_turn]!;
  const t = s.truth;
  const entries: Array<{ at: string; text: string }> = [];
  // Initial entry at seal time — template fields flattened into prose, the way
  // journal apps store them (no authority split, no temporal split).
  // NOTE: the scenario `title` is experimenter metadata and MUST NOT appear in
  // the record — the first pilot run leaked outcome hints through it and was
  // discarded (see the evidence doc's contamination log).
  entries.push({
    at: sealTurn.at,
    text: [
      `날짜: ${isoDate(sealTurn.at)}`,
      `결정: ${t.sealed_statement}`,
      `이유/전제: ${[...t.adopted_premises].join('; ')}`,
      `검토 예정일: ${t.review_at} — ${t.review_question}`,
      t.resolution_criterion ? `기준: ${t.resolution_criterion}` : '',
    ].filter(Boolean).join('\n'),
  });
  let confirmations = 1;
  // Outcome update(s) — the journal user appends results as they come, in the
  // same free-text field. Deferrals and outcomes get appended notes.
  if (t.deferred && t.deferred_to) {
    entries.push({ at: `${t.review_at}T09:00:00+09:00`, text: `업데이트(${t.review_at}): 아직 판단 불가, ${t.deferred_to}로 연기.` });
    confirmations += 1;
  }
  const closeTurn = s.transcript[s.transcript.length - 1]!;
  entries.push({
    at: closeTurn.at,
    text: `결과(${isoDate(closeTurn.at)}): ${t.answer_summary ?? t.resolution_kind}. ${t.evidence_observations.join('; ')}`,
  });
  confirmations += 1;
  return { entries, confirmations };
}

async function dkkArm(s: P5Scenario): Promise<{ record: unknown; confirmations: number; completed: boolean }> {
  const emu = new SupabaseEmulator();
  const projectId = `p5-${s.id}`;
  const userId = 'p5-user';
  emu.projects.push({ id: projectId, user_id: userId, name: s.title, decision_contract: null });
  const web = new WebSurface(emu, userId);
  const t = s.truth;
  const sealAt = s.transcript[s.seal_after_turn]!.at;
  let confirmations = 0;

  const jid = `${s.id}-j1`;
  const rid = `${s.id}-r1`;

  // 1) seal (explicit confirmation = 1 action)
  const seal = await web.command(projectId, {
    kind: 'seal', command_id: `${s.id}-seal`, judgment_id: jid,
    statement: t.sealed_statement, return_contract_id: rid,
    review_at: `${t.review_at}T09:00:00+09:00`, review_question: t.review_question,
    ...(t.resolution_criterion ? { resolution_criterion: t.resolution_criterion } : {}),
    // Provenance honesty: a statement adopted verbatim from an AI draft carries
    // ai origin in the ledger (statement_originated_by, 제2조 fix this session).
    ...(t.statement_origin === 'ai_draft_adopted' ? { statement_originated_by: 'ai' as const } : {}),
    // Premises adopted in the SAME confirmation (§6.2 atomic batch — the web
    // surface gained this write path after the first blind run measured dkk
    // premise recovery at 0 because no premise_adopted event existed).
    premises: t.adopted_premises.map((text, i) => ({
      premise_id: `${s.id}-p${i + 1}`,
      text,
      ...(t.ai_premises?.includes(text) ? { originated_by: 'ai' as const } : {}),
    })),
  }, sealAt);
  if (!seal.ok) throw new Error(`${s.id}: seal refused ${seal.code}`);
  confirmations += 1;

  // 2) post-seal observations recorded as they arrive (AI/host reported → not
  //    user confirmation actions; recorded with their real occurred_at).
  let obsIndex = 0;
  const observationIds: string[] = [];
  for (const turn of s.transcript.slice(s.seal_after_turn + 1)) {
    if (turn.role !== 'ai') continue;
    obsIndex += 1;
    const oid = `${s.id}-o${obsIndex}`;
    const obs = await web.command(projectId, {
      kind: 'observe', command_id: `${s.id}-obs${obsIndex}`, observation_id: oid,
      text: turn.text, occurred_at: turn.at, source_ref: `transcript:${s.id}`,
    }, turn.at);
    if (!obs.ok) throw new Error(`${s.id}: observe refused ${obs.code}`);
    observationIds.push(oid);
  }

  // 3) defer(s) — each an explicit user command.
  if (t.deferred && t.deferred_to) {
    // Walk the user defer turns between review_at and close.
    const deferTurns = s.transcript.filter((turn, i) => i > s.seal_after_turn && turn.role === 'user' && (turn.text.includes('미루') || turn.text.includes('다시 보자') || turn.text.includes('연기') || turn.text.includes('한 번만 더')));
    let deferIndex = 0;
    for (const turn of deferTurns.slice(0, -0 || undefined)) {
      // The last user turn is the close; skip it if it matched.
      if (turn === s.transcript[s.transcript.length - 1]) continue;
      deferIndex += 1;
      const m = turn.text.match(/(\d{1,2})월 (\d{1,2})일/);
      const year = turn.at.slice(0, 4);
      const reviewAt = m ? `${year}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}T09:00:00+09:00` : `${t.deferred_to}T09:00:00+09:00`;
      const defer = await web.command(projectId, {
        kind: 'defer', command_id: `${s.id}-defer${deferIndex}`, return_contract_id: rid,
        review_at: reviewAt, reason: turn.text.slice(0, 200),
      }, turn.at);
      if (!defer.ok) throw new Error(`${s.id}: defer refused ${defer.code}`);
      confirmations += 1;
    }
  }

  // 4) observe_and_resolve at close time (the user's own report + their
  //    interpretation — ONE explicit confirmation), then separate close (one
  //    more explicit confirmation).
  const closeTurn = s.transcript[s.transcript.length - 1]!;
  const resolutionId = `${s.id}-res1`;
  const finalObsId = `${s.id}-ofinal`;
  const resolution =
    t.resolution_kind === 'answered'
      ? {
          kind: 'answered' as const,
          answer_summary: t.answer_summary!,
          ...(t.criterion_result ? { criterion_result: t.criterion_result } : {}),
          evidence_refs: [finalObsId],
        }
      : t.resolution_kind === 'indeterminate'
        ? { kind: 'indeterminate' as const, reason: t.answer_summary ?? 'no evidence', evidence_refs: [finalObsId] }
        : { kind: 'moot' as const, reason: t.answer_summary ?? 'question dissolved', evidence_refs: [finalObsId] };
  const oar = await web.command(projectId, {
    kind: 'observe_and_resolve', command_id: `${s.id}-oar`,
    observation_id: finalObsId, observation_text: `${t.evidence_observations.join('; ')} (사용자 보고)`,
    resolution_id: resolutionId, judgment_id: jid, return_contract_id: rid,
    resolution,
  }, closeTurn.at);
  if (!oar.ok) throw new Error(`${s.id}: observe_and_resolve refused ${oar.code}`);
  confirmations += 1;

  const close = await web.command(projectId, {
    kind: 'close', command_id: `${s.id}-close`, judgment_id: jid, resolution_id: resolutionId,
  }, closeTurn.at);
  if (!close.ok) throw new Error(`${s.id}: close refused ${close.code}`);
  confirmations += 1;

  const events = await web.read(projectId);
  if (!events) throw new Error(`${s.id}: read failed`);
  const projection = semanticProjection(events, jid, closeTurn.at);
  // Completed = the ledger really carries the terminal pair: a resolved_*
  // projection AND the separate human close event (never inferred).
  const hasClose = events.some((e) => (e as { event?: string }).event === 'judgment_closed');
  const completed = Boolean(projection?.lifecycle?.startsWith('resolved_')) && hasClose;
  return {
    record: { ledger_events: events, projection },
    confirmations,
    completed,
  };
}

async function main(): Promise<void> {
  const outDir = process.argv[2] ?? path.join('scripts', 'dogfood', 'p5-experiment', 'evidence');
  fs.mkdirSync(outDir, { recursive: true });
  const artifacts: ArmArtifact[] = [];
  for (const s of P5_SCENARIOS) {
    // baseline
    let started = Date.now();
    const journal = baselineJournal(s);
    const baselineSeconds = (Date.now() - started) / 1000;
    artifacts.push({
      scenario_id: s.id, arm: 'baseline',
      confirmation_actions: journal.confirmations,
      task_seconds_agent: baselineSeconds,
      completed_lifecycle: true,
      record: { journal_entries: journal.entries },
      transcript: s.transcript,
    });
    // dkk
    started = Date.now();
    const dkk = await dkkArm(s);
    const dkkSeconds = (Date.now() - started) / 1000;
    artifacts.push({
      scenario_id: s.id, arm: 'dkk_v6',
      confirmation_actions: dkk.confirmations,
      task_seconds_agent: dkkSeconds,
      completed_lifecycle: dkk.completed,
      record: dkk.record,
      transcript: s.transcript,
    });
    console.log(`${s.id}: baseline ${journal.confirmations} confirms · dkk ${dkk.confirmations} confirms · dkk events ${(dkk.record as { ledger_events: unknown[] }).ledger_events.length}`);
  }
  for (const artifact of artifacts) {
    fs.writeFileSync(path.join(outDir, `${artifact.scenario_id}.${artifact.arm}.json`), JSON.stringify(artifact, null, 2));
  }
  fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify({
    label: 'AGENT-DRIVEN dogfood arms — not a human cohort; see ADR',
    scenarios: P5_SCENARIOS.map((s) => s.id),
    generated_by: 'scripts/dogfood/p5-experiment/run-arms.ts',
  }, null, 2));
  console.log(`\n${artifacts.length} artifacts → ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
