import { resolveToolArgusDir } from '../lib/argus-dir.js';
import { resolveToday, logicalNow, isHorizon, resolveHorizon, isRealDate, isFutureDate } from '../lib/resolve-today.js';
import { resolveContract } from '../lib/resolve-contract.js';
import { refuseIfLedgerUnreadable } from '../lib/ledger-readable.js';
import { guardTransition, GuardError } from '../lib/state-machine.js';
import { appendLedger, withLedgerLock } from '../lib/ledger-append.js';
import { PLAN_MAX_SCHEDULED } from '../lib/ledger-replay.js';
import { resolveResponseLocale } from '../lib/surfaces.js';
import { z } from 'zod';
import { envelope, toolError } from '../lib/envelope.js';
import { ENVELOPE_OUTPUT_SCHEMA, zArgusDir, zId, zDate, zWhen, type ToolModule } from './tool-types.js';
import { handleToolException } from './errors.js';
import { asV2WriteField } from '../v2/mirror.js';

/**
 * 실행 계획 — 결정과 현실 사이의 다리 (PRODUCT-PLAN §3: 계획은 미끼, 정산은 해자).
 *
 * 이 도구가 존재하는 이유 하나: **날짜 붙은 단계를 귀환으로 바꾸는 것.** 그
 * 전까지 돌아보기는 사용자가 따로 받아들여야 하는 부담이었다. 계획에 날짜가
 * 있으면 귀환이 공짜로 따라온다 — check_in 이 그 날짜에 해당 단계를 꺼낸다.
 *
 * 경계 셋 — 전부 방법 정본(method-harness/plan.ts와 같은 의미론)에서 온다:
 *  1. 계획은 열린 결정에만 붙는다 (절대 자기생성하지 않는다).
 *  2. 계획을 만드는 것은 모델이어도, 채택은 사용자의 동사다 — 이 도구는
 *     사용자가 대화에서 "그렇게 하자"고 한 뒤에만 불린다 (도구 설명이 게이트,
 *     원격 argus_adopt와 같은 규율). 단어의 출처는 plan_owner로 남는다.
 *  3. 모르는 것은 open_questions로 남긴다 — 지어낸 단계로 채우지 않는다.
 *
 * 계획은 내기가 아니다: 정산 버킷·track_record·달성률 어디에도 산입되지 않는다
 * (§9.2-3의 앵커와 같은 지위). plan_check는 "무슨 일이 있었나"를 사용자의
 * 말로 남길 뿐 채점하지 않는다.
 */

const stepInput = z.strictObject({
  what: z.string().min(1).max(200).describe('이 단계에서 할 일 한 줄입니다.\n\nOne line: what this step does.'),
  due: zWhen.optional().describe('이 단계를 확인할 날짜(YYYY-MM-DD 또는 +7d/+2w/+3m)입니다. 날짜가 있는 단계만 나중에 check_in이 물어봅니다.\n\nOptional check date (YYYY-MM-DD or +7d/+2w/+3m). Only dated steps come back in check_in.'),
});

export const plan: ToolModule = {
  name: 'argus_plan',
  description:
    'Attach the execution plan the user adopted to an open decision: ordered steps with optional check dates. Dated steps come back through argus_check_in on their date. Call ONLY after the user agreed to the plan in conversation; leave unknowns as open_questions instead of inventing steps.',
  inputSchema: z.strictObject({
    argus_dir: zArgusDir,
    op: z.enum(['adopt', 'check']).default('adopt'),
    id: zId,
    steps: z.array(stepInput).min(1).max(8).optional(),
    open_questions: z.array(z.string().min(1).max(200)).max(5).optional(),
    plan_owner: z.enum(['user', 'ai_surfaced']).default('ai_surfaced'),
    adopted_quote: z.string().min(3).max(400).optional(),
    step: z.number().int().min(1).max(8).optional(),
    note: z.string().min(1).max(400).optional(),
    today_override: zDate.optional(),
  }),
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  annotations: { title: 'Execution plan', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (a) => {
    try {
      const dir = resolveToolArgusDir(a['argus_dir']);
      const id = String(a['id'] ?? '');
      const today = resolveToday({ override: a['today_override'] as string | undefined });
      const current = resolveContract(dir, id, today);
      const blind = refuseIfLedgerUnreadable('argus_plan', current);
      if (blind) return blind;
      const locale = resolveResponseLocale(dir, (a['steps'] as Array<{ what?: string }> | undefined)?.[0]?.what ?? (a['note'] as string | undefined) ?? null);
      const ko = locale === 'ko';

      if (current.state === 'absent') {
        // 계획은 결정의 서사에 속한다 — 전제와 같은 비-자기생성 규칙.
        return toolError({
          ok: false, tool: 'argus_plan', error_code: 'NO_DECISION',
          message: ko
            ? `"${id}" 결정이 아직 없습니다. 계획은 열린 결정에만 붙습니다.`
            : `No decision "${id}" yet. A plan attaches to an open decision.`,
          recovery: ko
            ? 'argus_capture action=open으로 결정을 먼저 연 뒤 같은 id로 다시 호출하세요.'
            : 'Open the decision first with argus_capture action=open, then call again with the same id.',
        });
      }

      if (a['op'] === 'check') return await recordCheck(dir, id, today, a, ko);

      guardTransition(current.state, 'plan_adopt');

      if (current.entry?.plan) {
        // 두 번째 계획을 조용히 받으면 예약된 돌아보기가 3+3으로 불어난다 —
        // 과발화 제조기. 수정 지원 전까지는 정직하게 거절한다 (하네스와 동일).
        return toolError({
          ok: false, tool: 'argus_plan', error_code: 'PLAN_ALREADY_ADOPTED',
          message: ko
            ? '이 결정에는 이미 실행 계획이 있습니다. 계획을 갈아끼우면 걸어 둔 돌아보기 약속이 조용히 불어납니다.'
            : 'This decision already has an execution plan. Swapping plans would silently multiply the scheduled check-backs.',
          recovery: ko
            ? '남은 단계는 그대로 두고, 새로 확인할 것은 새 결정으로 여세요. 단계의 결과는 action="plan_check"로 기록합니다.'
            : 'Leave the remaining steps as they are and open anything new as a new decision. Record step results with action="plan_check".',
        });
      }

      const rawSteps = (a['steps'] as Array<{ what: string; due?: string }> | undefined) ?? [];
      if (!rawSteps.length) {
        return toolError({
          ok: false, tool: 'argus_plan', error_code: 'EMPTY_PLAN',
          message: ko
            ? '계획에 단계가 하나도 없습니다.'
            : 'The plan has no steps.',
          recovery: ko
            ? '할 일을 steps로 보내세요. 계획을 낼 수 없으면 그 이유를 open_questions("확인 필요: …")로 남기고 단계를 지어내지 마세요.'
            : 'Send the work as steps. If a plan cannot be made yet, leave the reason as open_questions ("need to confirm: …") instead of inventing steps.',
        });
      }

      // 날짜 해석: +7d 지평은 오늘 기준으로 풀고, 과거 날짜는 조용히 통과시키지
      // 않는다 — 방금 세운 계획이 곧바로 "돌아볼 때가 됐다"고 알리는 과발화가
      // 되고, 사용자는 아직 아무것도 하지 않았으므로 확인할 것도 없다.
      const steps: Array<{ what: string; due?: string }> = [];
      for (const [i, s] of rawSteps.entries()) {
        let due: string | undefined;
        if (s.due != null) {
          due = isHorizon(s.due) ? (resolveHorizon(s.due, today) ?? undefined) : s.due;
          if (!due || !isRealDate(due)) {
            return toolError({
              ok: false, tool: 'argus_plan', error_code: 'BAD_STEP_DATE',
              message: ko ? `단계 ${i + 1}의 날짜(${s.due})를 읽을 수 없습니다.` : `Step ${i + 1} has an unreadable date (${s.due}).`,
              recovery: ko ? `YYYY-MM-DD 또는 +7d/+2w/+3m 형태로 보내세요. 오늘은 ${today}입니다.` : `Send YYYY-MM-DD or a horizon like +7d/+2w/+3m. Today is ${today}.`,
            });
          }
          if (!isFutureDate(due, today)) {
            return toolError({
              ok: false, tool: 'argus_plan', error_code: 'BAD_STEP_DATE',
              message: ko ? `단계 ${i + 1}의 확인 날짜(${due})가 이미 지났습니다. 앞으로 확인할 날짜여야 합니다.` : `Step ${i + 1}'s check date (${due}) has already passed; it must be a future date.`,
              recovery: ko ? `오늘은 ${today}입니다. 이 날짜를 기준으로 계산하거나 +7d/+2w/+3m로 보내세요.` : `Today is ${today}. Compute from that date, or send a horizon (+7d/+2w/+3m).`,
            });
          }
        }
        steps.push({ what: s.what, ...(due ? { due } : {}) });
      }

      const openQuestions = (a['open_questions'] as string[] | undefined) ?? [];
      // 저자성은 주장이 아니라 증거다 (전제의 anchor_quote와 같은 규율). 연기
      // 실행 1호 실측: 모델이 사용자의 동의 발화가 없는 시점에 plan_owner:'user'
      // 를 찍었다 — 인용 없는 사용자 저작 주장은 기록을 거절하는 대신 정직하게
      // ai_surfaced로 강등한다. 실패 방향이 중요하다: 추론이 "사용자의 말"로
      // 둔갑하는 것이 이 설계 전체가 막으려는 단 하나의 오류다.
      const adoptedQuote = typeof a['adopted_quote'] === 'string' ? a['adopted_quote'].trim() : '';
      const planOwner = a['plan_owner'] === 'user' && adoptedQuote ? 'user' : 'ai_surfaced';
      const now = logicalNow(today, !!a['today_override']);
      const mirror = await withLedgerLock(dir, async () => {
        const fresh = resolveContract(dir, id, today);
        guardTransition(fresh.state, 'plan_adopt');
        // 자물쇠 안 재확인이 걸리면 밖의 정직한 거절과 같은 코드로 말한다 —
        // 맨 Error는 INTERNAL_ERROR로 위장되어 사용자가 원인을 잃는다.
        if (fresh.entry?.plan) {
          throw new GuardError('PLAN_ALREADY_ADOPTED', 'This decision already has an execution plan.', 'Leave the remaining steps as they are; record step results with action="plan_check".');
        }
        return (await appendLedger(dir, [{
          id, event: 'plan_adopt', steps, open_questions: openQuestions, plan_owner: planOwner,
          ...(adoptedQuote ? { anchor_quote: adoptedQuote } : {}),
        }], now)).v2_mirror;
      });

      // 예약 요약은 fold와 같은 규칙으로 계산해 그대로 말한다 (no-silent-caps):
      // 잘렸으면 잘렸다고 말할 수 있어야 한다.
      const dated = steps.filter((s) => s.due).sort((x, y) => (x.due! < y.due! ? -1 : 1));
      const scheduled = dated.slice(0, PLAN_MAX_SCHEDULED);
      const summary = ko
        ? (dated.length === 0
          ? '날짜가 붙은 단계가 없어 돌아보기는 예약되지 않았습니다.'
          : dated.length > PLAN_MAX_SCHEDULED
            ? `돌아보기 ${scheduled.length}번이 예약되었습니다. (날짜 있는 단계는 ${dated.length}개지만, 알림이 과해지지 않도록 가장 이른 ${PLAN_MAX_SCHEDULED}개만 잡았습니다.)`
            : `돌아보기 ${scheduled.length}번이 예약되었습니다.`)
        : (dated.length === 0
          ? 'No steps carry a date, so no check-backs were scheduled.'
          : dated.length > PLAN_MAX_SCHEDULED
            ? `${scheduled.length} check-backs scheduled. (${dated.length} steps carry dates; only the earliest ${PLAN_MAX_SCHEDULED} are scheduled so reminders stay rare.)`
            : `${scheduled.length} check-back${scheduled.length === 1 ? '' : 's'} scheduled.`);
      const gapLine = openQuestions.length
        ? (ko ? ` 확인 필요로 남긴 것 ${openQuestions.length}건은 단계로 지어내지 않고 그대로 두었습니다.` : ` ${openQuestions.length} open question(s) stay named, not invented into steps.`)
        : '';

      return envelope({
        ok: true, tool: 'argus_plan',
        surface: (ko
          ? `계획 ${steps.length}단계를 이 결정에 붙였습니다. ${summary}`
          : `Attached a ${steps.length}-step plan to this decision. ${summary}`) + gapLine,
        next_actions: ['argus_check_in', 'stop'],
        data: {
          id, steps: steps.map((s, i) => ({ ordinal: i + 1, ...s })),
          scheduled: scheduled.map((s) => ({ what: s.what, due: s.due })),
          ...(dated.length > PLAN_MAX_SCHEDULED ? { unscheduled_dated: dated.length - PLAN_MAX_SCHEDULED } : {}),
          open_questions: openQuestions, plan_owner: planOwner,
          v2_write: asV2WriteField(mirror),
        },
      });
    } catch (e) {
      return handleToolException('argus_plan', e);
    }
  },
};

async function recordCheck(
  dir: string, id: string, today: string, a: Record<string, unknown>, ko: boolean,
): ReturnType<ToolModule['handler']> {
  const current = resolveContract(dir, id, today);
  const planState = current.entry?.plan;
  if (!planState) {
    return toolError({
      ok: false, tool: 'argus_plan', error_code: 'NO_PLAN',
      message: ko ? '이 결정에는 아직 실행 계획이 없습니다.' : 'This decision has no execution plan yet.',
      recovery: ko ? '사용자가 계획에 동의했다면 action="plan"과 steps로 먼저 붙이세요.' : 'If the user adopted a plan, attach it first with action="plan" and steps.',
    });
  }
  const ordinal = Number(a['step'] ?? 0);
  const step = planState.steps.find((s) => s.ordinal === ordinal);
  if (!step) {
    return toolError({
      ok: false, tool: 'argus_plan', error_code: 'NO_SUCH_STEP',
      message: ko ? `단계 ${ordinal || '?'}이(가) 계획에 없습니다. 단계는 1~${planState.steps.length}입니다.` : `No step ${ordinal || '?'} in this plan; steps run 1 to ${planState.steps.length}.`,
      recovery: ko ? 'step에 확인한 단계 번호를, note에 실제로 있었던 일을 사용자의 말로 보내세요.' : 'Send the step number in `step` and what actually happened, in the user\'s words, in `note`.',
    });
  }
  if (step.checked_on) {
    return envelope({
      ok: true, tool: 'argus_plan',
      surface: ko
        ? `단계 ${ordinal}("${step.what}")은 ${step.checked_on}에 이미 기록되어 있습니다: "${step.note ?? ''}". 기록은 덮어쓰지 않습니다.`
        : `Step ${ordinal} ("${step.what}") was already recorded on ${step.checked_on}: "${step.note ?? ''}". Records are never overwritten.`,
      next_actions: ['argus_check_in', 'stop'],
      data: { id, step: ordinal, already_recorded: true, checked_on: step.checked_on, ...(step.note ? { note: step.note } : {}) },
    });
  }
  const note = typeof a['note'] === 'string' ? a['note'] : '';
  if (!note.trim()) {
    return toolError({
      ok: false, tool: 'argus_plan', error_code: 'EMPTY_NOTE',
      message: ko ? '무슨 일이 있었는지가 비어 있습니다.' : 'What happened is empty.',
      recovery: ko ? '사용자가 말한 그대로를 note로 보내세요. 짐작으로 채우지 마세요.' : 'Send the user\'s own words as `note`. Never fill it by guessing.',
    });
  }
  const now = logicalNow(today, !!a['today_override']);
  const mirror = await withLedgerLock(dir, async () => {
    const fresh = resolveContract(dir, id, today);
    guardTransition(fresh.state, 'plan_check');
    return (await appendLedger(dir, [{ id, event: 'plan_check', ordinal, note }], now)).v2_mirror;
  });
  const remaining = planState.steps.filter((s) => s.scheduled && !s.checked_on && s.ordinal !== ordinal);
  const nextLine = remaining.length
    ? (ko ? ` 예약된 다음 확인: "${remaining[0]!.what}" (${remaining[0]!.due}).` : ` Next scheduled check: "${remaining[0]!.what}" (${remaining[0]!.due}).`)
    : '';
  return envelope({
    ok: true, tool: 'argus_plan',
    surface: (ko
      ? `단계 ${ordinal}("${step.what}")의 결과를 그대로 기록했습니다.`
      : `Recorded what happened at step ${ordinal} ("${step.what}"), verbatim.`) + nextLine,
    next_actions: ['argus_check_in', 'stop'],
    data: { id, step: ordinal, note, v2_write: asV2WriteField(mirror) },
  });
}
