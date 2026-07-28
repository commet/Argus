import { envelope, type McpToolResult } from './envelope.js';
import type { NextAction } from './spine.js';

/**
 * A picker that closed WITHOUT an answer is a broken wire, not a decline.
 *
 * 2026-07-27, the founder's second blocked screen: `elicit()` collapsed decline,
 * cancel, and host-side failure into one `null`, so every ask site treated a
 * form that never advanced as "the user said no" and answered "기록하지
 * 않았습니다" while the work the user had just typed evaporated. `elicitDetailed`
 * separates the two facts; this is the surface the separation buys.
 *
 * The rule for all six ask sites (audit 2026-07-27 found only seal had it):
 *
 *   declined   → an answer. Stay quiet, record nothing, do NOT re-ask.
 *   no_answer  → say plainly that the window gave no answer, hand the user's
 *                own material back in the surface so nothing is lost, and name
 *                the one plain-text sentence that finishes the job.
 *
 * `ok:true` on purpose: nothing failed that the user did, and an `isError`
 * result renders as a red failure on hosts while telling the user nothing. The
 * honesty lives in `data` (`recorded:false`, `choice:'no_answer'`), which the
 * host matrix asserts on.
 */
export function noAnswerResult(args: {
  tool: string;
  ko: boolean;
  /** The one sentence that tells the user how to finish in plain text. */
  handBack: { ko: string; en: string };
  next_actions: NextAction[];
  /** Whatever the user already supplied, echoed so the model can re-offer it. */
  data?: Record<string, unknown>;
}): McpToolResult {
  const { tool, ko, handBack, next_actions, data } = args;
  return envelope({
    ok: true,
    tool,
    // Two lines, not one. As a single sentence the English ran to 170
    // characters of chrome before the user's own material even started
    // (2026-07-28 surface sweep), and this is a line someone meets at the exact
    // moment something already went wrong.
    //
    // The first clause must be true in BOTH readings of how we got here.
    //
    // This surface is reached by a cancelled window, a thrown request, AND a
    // decline that came back faster than a form can be read. That last one is
    // genuinely ambiguous: a policy may have answered without showing anything
    // (a real `codex app-server` under `approval_policy = "never"`, measured
    // 2026-07-29), or a keyboard user, assistive automation, or someone who
    // already knew their answer may have declined instantly and meant it.
    //
    // So lead with the fact that holds either way — nothing was recorded — and
    // make the host explanation CONDITIONAL rather than asserted. Telling
    // someone who deliberately declined that "no answer came back" contradicts
    // what they just did; telling a blocked user "you declined" invents an act
    // they never performed. One sentence has to avoid both.
    surface: ko
      ? `기록하지 않았습니다. 확인 창을 보지 못하셨다면 호스트가 대신 답했을 수 있습니다.\n${handBack.ko}`
      : `Nothing recorded. If no dialog appeared, your host may have answered for you.\n${handBack.en}`,
    next_actions,
    data: { recorded: false, choice: 'no_answer', ...data },
  });
}
