// 도구 실행 — 하네스를 부르는 얇은 층.
//
// 여기에 방법 규칙을 다시 쓰지 않는다. fire-gate, 저자성 계보, 관찰 우선 순서,
// 채택 권한은 전부 하네스가 갖고 있고, 이 파일은 원장을 불러와 하네스에 넘기고
// 결과를 사람이 읽을 문장으로 돌려줄 뿐이다. 규칙이 두 곳에 있으면 갈라진다.

import { returnsFromPlan, planReturnSummary } from '../../../../../method-harness/plan';
import { fireGate } from '../../../../../method-harness/surfaces/mcp';
import { HarnessViolation, type ExecutionPlan, type PlanStep } from '../../../../../method-harness/types';
import { toolText } from './protocol';
import { armReturns, knownEventIds, loadEngine, listCases, persistNewEvents, upsertCase } from './store';

const now = () => new Date().toISOString();
const newCaseId = () => `case_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

type Args = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

// 하네스가 크게 실패하면(HarnessViolation) 그것은 버그가 아니라 **규칙이 지켜진
// 것**이다. 모델에게 이유를 그대로 돌려줘서 다음 턴에 바르게 행동하게 한다.
async function guard<T>(fn: () => Promise<T>): Promise<T | { violation: string }> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HarnessViolation) return { violation: e.message };
    throw e;
  }
}

export async function handleOpen(userId: string, args: Args) {
  const utterance = str(args.utterance);
  if (!utterance) return toolText('결정을 연 원문이 필요합니다.', true);

  // fire-gate가 먼저 돈다 (§4.6) — 평평하거나 이미 닫힌 결정이면 열지 않는다.
  const gate = fireGate(new (await import('../../../../../method-harness/ledger')).Ledger(), {
    hostUtterance: utterance,
    userInvokedArgus: true, // 모델이 이 도구를 부른 것은 명시 호출이다
  });
  if (!gate.fire) {
    return toolText(`지금은 결정을 열지 않습니다 (${gate.reason}). 사용자가 결정을 여는 순간에 다시 부르십시오.`, true);
  }

  const caseId = newCaseId();
  const engine = await loadEngine(userId, caseId);
  engine.recordUtterance(utterance, now());

  const lean = str(args.lean);
  const reasons = strArr(args.statedReasons);
  if (lean || reasons.length > 0) {
    engine.recordBaseline({ lean: lean || 'none_stated', statedReasons: reasons, consideredAlternatives: [] }, now());
  } else {
    // 말하지 않은 것을 지어내지 않는다 — 부재를 부재로 기록한다.
    engine.recordBaseline(undefined, now());
  }

  await upsertCase(userId, caseId, utterance.slice(0, 120), engine.state().state);
  await persistNewEvents(userId, caseId, engine, new Set());

  return toolText(
    `결정을 열었습니다 (id: ${caseId}).\n` +
      (lean ? `AI가 말하기 전의 기울기를 보존했습니다: "${lean}"\n` : '기울기 없이 시작했습니다 — 그것도 정직한 출발점입니다.\n') +
      '다음: argus_sharpen 으로 가장 무게가 실리는 가정 하나를 확인하십시오.',
  );
}

export async function handleSharpen(userId: string, args: Args) {
  const caseId = str(args.caseId);
  if (!caseId) return toolText('caseId가 필요합니다.', true);
  const engine = await loadEngine(userId, caseId);
  const state = engine.state();
  if (!state.baseline && state.observations.length === 0) {
    return toolText('이 결정에 대한 기록이 없습니다. 먼저 argus_open 으로 여십시오.', true);
  }

  // 실제 짚기는 모델이 한다 — 하네스는 그 출력을 검증하는 쪽이다. 여기서는
  // 모델이 무엇을 지켜야 하는지 알려주고, 사용자가 이미 말한 것만 재료로 준다.
  const said = state.baseline && state.baseline !== 'not_captured' ? state.baseline : null;
  return toolText(
    '이 결정에서 하중이 가장 큰 가정 하나만 짚으십시오. 규칙:\n' +
      '· 방향을 정해주지 말 것 (어느 쪽이 낫다고 말하지 않는다)\n' +
      '· 짚기가 틀렸음을 보여줄 관찰 가능한 사실을 함께 말할 것\n' +
      '· 한 턴에 한 가지만\n\n' +
      `사용자가 실제로 말한 것: ${said ? `기울기 "${said.lean}", 이유 ${JSON.stringify(said.statedReasons)}` : '(기록된 기울기 없음 — 사용자의 생각을 지어내지 마십시오)'}`,
  );
}

export async function handleAdopt(userId: string, args: Args) {
  const caseId = str(args.caseId);
  const choice = str(args.choiceOrPolicy);
  if (!caseId || !choice) return toolText('caseId와 choiceOrPolicy가 필요합니다.', true);

  const engine = await loadEngine(userId, caseId);
  const known = await knownEventIds(userId, caseId);
  const edited = args.edited === true;

  engine.adoptCard(
    {
      question: engine.state().card?.question ?? choice.slice(0, 120),
      stakes: { weight: 'significant', reversibility: 'costly' },
      adoptedState: 'decide',
      choiceOrPolicy: choice,
      rationale: { values: [], materialBeliefs: [] },
    },
    edited ? { mode: 'edit_then_accept', editedFields: ['choiceOrPolicy'], materialEdit: true } : { mode: 'accept' },
    now(),
  );

  await persistNewEvents(userId, caseId, engine, known);
  await upsertCase(userId, caseId, engine.state().card?.question ?? choice.slice(0, 120), engine.state().state);

  return toolText(
    `채택되었습니다 — 이 결정은 이제 사용자의 것으로 기록됩니다${edited ? ' (수정분 포함)' : ''}.\n` +
      '다음: argus_plan 으로 실행 계획을 만들면, 그 기한들이 그대로 돌아보기 약속이 됩니다.',
  );
}

export async function handlePlan(userId: string, args: Args) {
  const caseId = str(args.caseId);
  if (!caseId) return toolText('caseId가 필요합니다.', true);

  const steps = Array.isArray(args.steps) ? (args.steps as unknown[]) : [];
  if (steps.length === 0) {
    // 모델에게 형태를 알려주되, 내용을 지어내지 않는다.
    return toolText(
      '계획 단계를 함께 보내주십시오. 각 단계: { what, kind: prepare|investigate|execute, byOrWhen, dueDate?(ISO) }\n' +
        '· 사용자가 정한 결정을 옮기는 순서만 만드십시오 (무엇을 고를지 다시 정하지 마십시오)\n' +
        '· 모르는 것은 단계로 지어내지 말고 openQuestions 에 "확인 필요: …" 로 남기십시오\n' +
        '· dueDate 가 붙은 단계는 돌아보기 약속이 됩니다 — 정말 확인할 것에만 붙이십시오',
      true,
    );
  }

  const plan: ExecutionPlan = {
    horizonDays: typeof args.horizonDays === 'number' ? args.horizonDays : 21,
    openQuestions: strArr(args.openQuestions),
    steps: steps.map((s) => {
      const o = (s ?? {}) as Args;
      return {
        what: str(o.what),
        kind: (['prepare', 'investigate', 'execute'].includes(str(o.kind)) ? str(o.kind) : 'execute') as PlanStep['kind'],
        byOrWhen: str(o.byOrWhen),
        ...(str(o.dueDate) ? { dueDate: str(o.dueDate) } : {}),
      };
    }),
  };

  const engine = await loadEngine(userId, caseId);
  const known = await knownEventIds(userId, caseId);

  const result = await guard(async () => engine.adoptPlan(plan, now()));
  if ('violation' in result) return toolText(result.violation, true);

  await persistNewEvents(userId, caseId, engine, known);
  await armReturns(
    userId,
    caseId,
    returnsFromPlan(plan).map((r) => ({
      kind: r.contract.kind,
      dueAt: r.contract.trigger.type === 'date' ? r.contract.trigger.date : now(),
      fromStep: r.fromStep,
    })),
  );
  await upsertCase(userId, caseId, engine.state().card?.question ?? caseId, engine.state().state);

  const lines = plan.steps.map((s, i) => `${i + 1}. [${s.kind}] ${s.what} — ${s.byOrWhen}`);
  return toolText(
    `실행 계획이 기록되었습니다.\n${lines.join('\n')}\n\n${planReturnSummary(plan)}` +
      (plan.openQuestions.length > 0 ? `\n\n아직 확인이 필요한 것:\n· ${plan.openQuestions.join('\n· ')}` : ''),
  );
}

export async function handleReturn(userId: string, args: Args) {
  const caseId = str(args.caseId);
  if (!caseId) return toolText('caseId가 필요합니다.', true);

  const engine = await loadEngine(userId, caseId);
  const known = await knownEventIds(userId, caseId);
  const state = engine.state();
  if (!state.card) return toolText('이 결정에는 채택된 기록이 없습니다.', true);

  const observation = str(args.observation);
  // 관찰이 없으면 기록을 열지 않는다 — 이 순서가 §7.3의 전부다.
  if (!observation) {
    const opening = engine.openReturn();
    return toolText(
      `먼저 실제로 무슨 일이 있었는지 들어야 합니다.\n\n"${opening.question}"\n기다리던 것: ${opening.awaitedSignal}\n\n` +
        '사용자의 답을 observation 으로 다시 보내주십시오. 그때의 선택과 이유는 그 뒤에 열립니다.',
      true,
    );
  }

  engine.recordObservation(observation, 'direct', now(), now());
  const recall = str(args.recall);
  if (recall) engine.recordRecallProbeAnswer(recall, now());

  if (!recall) {
    await persistNewEvents(userId, caseId, engine, known);
    return toolText(
      '기록했습니다. 기록을 열기 전에 하나만 —\n\n' +
        '"당시 왜 그렇게 정했는지, 기억나는 대로 말씀해 주시겠어요?"\n\n' +
        '답을 recall 로 보내주시면 그때의 기록과 나란히 보여드립니다.',
      true,
    );
  }

  const revealed = engine.revealRecord(now());
  await persistNewEvents(userId, caseId, engine, known);
  await upsertCase(userId, caseId, revealed.card?.question ?? caseId, revealed.state);

  return toolText(
    '이제 그때의 기록입니다.\n' +
      `결정: ${revealed.card?.choiceOrPolicy}\n` +
      `그때의 기울기: ${revealed.baseline && revealed.baseline !== 'not_captured' ? revealed.baseline.lean : '기록하지 않고 시작'}\n\n` +
      `방금의 기억: "${recall}"\n실제로 일어난 일: "${observation}"\n\n` +
      '둘이 다르다면 그 차이가 이 기록이 존재하는 이유입니다 — 결과를 알고 나면 누구나 이유를 다시 씁니다.',
  );
}

export async function handleRecall(userId: string, args: Args) {
  const limit = typeof args.limit === 'number' ? Math.min(args.limit, 20) : 10;
  const cases = await listCases(userId, limit);
  if (cases.length === 0) return toolText('아직 기록된 결정이 없습니다.');
  return toolText(
    '지난 결정들:\n' +
      cases.map((c) => `· ${c.title ?? c.id} — ${c.state} (${c.updated_at.slice(0, 10)}, id: ${c.id})`).join('\n'),
  );
}
