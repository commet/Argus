// 도구 실행 — 하네스를 부르는 얇은 층.
//
// 여기에 방법 규칙을 다시 쓰지 않는다. fire-gate, 저자성 계보, 관찰 우선 순서,
// 채택 권한은 전부 하네스가 갖고 있고, 이 파일은 원장을 불러와 하네스에 넘기고
// 결과를 사람이 읽을 문장으로 돌려줄 뿐이다. 규칙이 두 곳에 있으면 갈라진다.
//
// 이 파일이 지켜야 하는 두 번째 규칙: **모르는 것을 채우지 않는다.**
// 모델이 안 보낸 값을 그럴듯한 기본값으로 메우면 그 순간 원장은 사실이 아니게
// 되고, 원장이 사실이 아니면 이 제품이 재는 것(기억 vs 기록)이 사라진다.
// 채울 수밖에 없는 자리는 **가장 엄격한 쪽으로 채우고 그 사실을 말한다.**

import { Ledger } from '../../../../../method-harness/ledger';
import { returnsFromPlan, planReturnSummary } from '../../../../../method-harness/plan';
import { fireGate } from '../../../../../method-harness/surfaces/mcp';
import {
  HarnessViolation,
  type ArgusTurn,
  type BeliefConfidence,
  type ExecutionPlan,
  type LedgerEvent,
  type MaterialBelief,
  type MoveType,
  type PlanStep,
  type Reversibility,
  type StakesWeight,
} from '../../../../../method-harness/types';
import { beliefCalibration, calibrationLines, gradeStatedBeliefs, type StatedBelief } from '@/lib/twin/beliefs';
import { divergenceCrux } from '@/lib/twin/divergence';
import {
  applyDelegation,
  caseDelegationId,
  createDelegation,
  describeDelegationGrade,
  gradeDelegation,
  markCaseDelegation,
  markCaseDelegationOffered,
  offeredDelegationId,
  DELEGATION_DEFAULT_DAYS,
  DELEGATION_MAX_DAYS,
} from '@/lib/twin/delegation';
import { extractProfileFromSettlement, profileLines, recentlyRetiredLines } from '@/lib/twin/profile';
import { generateAndSealShadow, gradeRevealedShadows, revealShadowsText, runAfterResponse } from '@/lib/twin/shadow';
import { twinScore, TWIN_SCORE_MIN_SAMPLE } from '@/lib/twin/store';
import { persistServerEvent } from '@/lib/server-events';
import { toolText } from './protocol';
import { MATERIAL_EXCERPT_MAX, MATERIAL_MAX_COUNT, TEXT_INPUT_MAX } from './tools';
import {
  armReturns,
  completeOneReturn,
  completeReturns,
  dueReturns,
  getCase,
  knownEventIds,
  loadEngine,
  listCases,
  persistNewEvents,
  projectOutcome,
  updateLastObservation,
  upsertCase,
  type CaseRow,
} from './store';

const now = () => new Date().toISOString();

// ── 채팅 안 귀환 알림 ──────────────────────────────────────────────────────
//
// 기한이 된 결정을 **채팅 안에서** 알린다 — 사용자가 어디로도 이동하지 않게.
// 성공 응답 끝에 붙는다: MCP 서버는 먼저 말을 걸 수 없으므로, 사용자가 다음에
// 무엇을 하든 그 순간이 유일한 기회다. 이메일은 채팅으로 돌아오지 않는 사람을
// 위한 backstop으로만 남는다.
//
// 자제 규칙이 여기에도 적용된다 (CLAUDE.md 거울 조항): 최대 2건만, 그리고 지금
// 하려던 일을 밀어내지 않도록 맨 뒤에 붙인다. 알림이 본문을 가리면 그것이 과발화다.
export const MAX_INLINE_NOTICES = 2;

export interface DueRow {
  case_id: string;
  from_step?: string | null;
  due_at?: string | null;
}

// 순수 포매터 — DB 없이 테스트된다. 조회와 문안을 나눠 두면 "무엇을 말하는가"를
// Supabase 없이 고정할 수 있다.
//
// 호출자는 상한+1 건을 조회해 넘긴다 — 상한을 넘는지 알아야 "2건 있습니다"가
// 조용한 절삭이 되지 않는다 (세 번째가 있는데 2건이라고 말하면 그 문장이 거짓이다).
export function formatDueNotice(rows: readonly DueRow[], excludeCaseId?: string): string {
  const eligible = rows.filter((r) => r.case_id !== excludeCaseId);
  const due = eligible.slice(0, MAX_INLINE_NOTICES);
  if (due.length === 0) return '';
  const overflow = eligible.length > due.length;
  const items = due.map((r) => `· ${r.from_step || '지난 결정'} (id: ${r.case_id})`).join('\n');
  return (
    `\n\n---\n${
      overflow
        ? `돌아볼 때가 된 결정이 여럿 있습니다 — 기한이 이른 ${due.length}건만 먼저 (이 밖에도 더 있습니다):`
        : `돌아볼 때가 된 결정이 ${due.length}건 있습니다:`
    }\n${items}\n` +
    'argus_return 으로 여시면 됩니다 — 먼저 무슨 일이 있었는지만 물어봅니다.'
  );
}

async function dueNotice(userId: string, excludeCaseId?: string): Promise<string> {
  try {
    return formatDueNotice(await dueReturns(userId, now(), MAX_INLINE_NOTICES + 1), excludeCaseId);
  } catch {
    return ''; // 알림 실패가 본 작업을 막지 않는다
  }
}

// 성공 응답 = 본문 + (있으면) 알림. 실패 응답에는 붙이지 않는다 — 모델이
// 고쳐야 할 것을 알리는 자리에 다른 결정을 끼우면 두 가지를 다 놓친다.
async function ok(userId: string, text: string, excludeCaseId?: string) {
  return toolText(text + (await dueNotice(userId, excludeCaseId)));
}

const newCaseId = () => `case_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

// ── 인자 읽기 ─────────────────────────────────────────────────────────────

type Args = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

// 자유 텍스트 상한 검사. 넘으면 **기록 전에** 거절한다 — 자료 인테이크와 같은
// 규율이다: 잘라서 받으면 그 사람의 말이 아니게 되므로 자르지 않고 말한다.
// (원장은 append-only 라 비대한 입력 하나가 영구히 남는다 — 들어가기 전이 유일한 관문.)
function refuseOversize(fields: Record<string, string>): ReturnType<typeof toolText> | null {
  for (const [label, value] of Object.entries(fields)) {
    if (value.length > TEXT_INPUT_MAX) {
      return toolText(
        `${label}이(가) ${value.length}자로 상한(${TEXT_INPUT_MAX}자)을 넘습니다. ` +
          '자르면 기록이 왜곡되므로 자르지 않고 거절합니다 — 하중이 실린 대목만 남겨 다시 보내주십시오.',
        true,
      );
    }
  }
  return null;
}

// 목록 입력의 상한 — 같은 규율. 항목 수와 항목 길이 둘 다 본다: 25개짜리 가치
// 목록이나 5천 자짜리 이유 하나가 append-only 원장에 박히면 지울 수 없다.
function refuseOversizeList(
  label: string,
  items: readonly string[],
  maxItems = 20,
  maxItemLen = 1000,
): ReturnType<typeof toolText> | null {
  if (items.length > maxItems) {
    return toolText(
      `${label}이(가) ${items.length}건으로 상한(${maxItems}건)을 넘습니다. 하중이 실린 것만 남겨 다시 보내주십시오.`,
      true,
    );
  }
  const over = items.find((s) => s.length > maxItemLen);
  if (over) {
    return toolText(
      `${label}의 항목 하나가 ${over.length}자로 상한(${maxItemLen}자)을 넘습니다. ` +
        '자르면 기록이 왜곡되므로 자르지 않고 거절합니다 — 요지만 남겨 다시 보내주십시오.',
      true,
    );
  }
  return null;
}

const STAKES_WEIGHTS: StakesWeight[] = ['minor', 'significant', 'major'];
const REVERSIBILITIES: Reversibility[] = ['reversible', 'costly', 'one_way'];
const CONFIDENCES: BeliefConfidence[] = ['confident', 'uncertain', 'contested'];

// 하중이 안 왔을 때 **가장 엄격한 쪽**으로 닫는다 (validator의 initiative
// 위계도 같은 규칙이다: stakes를 모르면 가장 빡빡한 줄을 적용한다). 그리고
// 그렇게 했다는 사실을 응답에 적는다 — 조용히 메우면 그게 조작이다.
function readStakes(v: unknown): { stakes: { weight: StakesWeight; reversibility: Reversibility }; assumed: boolean } {
  const o = (v ?? {}) as Args;
  const weight = STAKES_WEIGHTS.includes(str(o.weight) as StakesWeight) ? (str(o.weight) as StakesWeight) : null;
  const rev = REVERSIBILITIES.includes(str(o.reversibility) as Reversibility)
    ? (str(o.reversibility) as Reversibility)
    : null;
  if (weight && rev) return { stakes: { weight, reversibility: rev }, assumed: false };
  return { stakes: { weight: weight ?? 'major', reversibility: rev ?? 'one_way' }, assumed: true };
}

/**
 * 믿음 읽기. **확신도가 없으면 그 믿음은 기록하지 않는다.**
 *
 * 예전에는 없는 확신도를 'uncertain' 으로 메웠다. 그 시절에는 아무도 그 값을
 * 읽지 않아 무해해 보였지만, 이제 정산이 이 등급을 채점하고 그 결과가 보정
 * 거울의 숫자가 된다 — 우리가 채운 등급이 사용자의 성적으로 표시되는 것이다.
 * 그것은 "사용자가 하지 않은 판단을 원장에 쓴 것"이고 이 파일 상단이 금지한
 * 바로 그 형태다. 몇 건을 뺐는지는 응답에 적는다 (dropped).
 */
function readBeliefs(v: unknown): { beliefs: MaterialBelief[]; dropped: number } {
  if (!Array.isArray(v)) return { beliefs: [], dropped: 0 };
  let dropped = 0;
  const beliefs = v
    .map((x) => {
      // 문자열만 온 것은 확신도가 없는 것이다.
      if (typeof x === 'string') {
        if (x.trim()) dropped += 1;
        return null;
      }
      const o = (x ?? {}) as Args;
      const belief = str(o.belief);
      if (!belief) return null;
      const c = str(o.confidence) as BeliefConfidence;
      if (!CONFIDENCES.includes(c)) {
        dropped += 1;
        return null;
      }
      return { belief, confidence: c };
    })
    .filter((x): x is MaterialBelief => x !== null);
  return { beliefs, dropped };
}

// ── 기존 자료 읽기 (콜드스타트 인테이크, handoff §6-A) ────────────────────
//
// 웹의 /tools/review 가 가진 답("이미 쓴 것에서 시작한다")을 채팅 입구에도 연다.
// 자료는 원장에 **증거(external_source)로만** 남는다 — baseline 은 이 경로로
// 절대 채워지지 않는다. 과거 문서의 문장은 그때의 기록이지 지금의 입장이
// 아니고, 그 둘을 섞는 순간 /import 가 "다시 기록" 버튼으로 막은 저자성 세탁이
// 뒷문으로 돌아온다.

const MATERIAL_KINDS = ['document', 'conversation', 'log', 'plan', 'data'] as const;
type MaterialKind = (typeof MATERIAL_KINDS)[number];

export interface IntakeMaterial {
  title: string;
  kind: MaterialKind;
  excerpt: string;
  whyRelevant?: string;
}

export interface MaterialRead {
  accepted: IntakeMaterial[];
  droppedLong: number; // 인용이 상한을 넘어 거절 — 잘라서 받으면 인용이 아니게 된다
  droppedMalformed: number; // title/excerpt 없음
  droppedOverCap: number; // 건수 상한 초과
}

export function readMaterials(v: unknown): MaterialRead {
  if (!Array.isArray(v)) return { accepted: [], droppedLong: 0, droppedMalformed: 0, droppedOverCap: 0 };
  let droppedLong = 0;
  let droppedMalformed = 0;
  const parsed: IntakeMaterial[] = [];
  for (const x of v) {
    const o = (x ?? {}) as Args;
    const title = str(o.title);
    const excerpt = typeof o.excerpt === 'string' ? o.excerpt.trim() : '';
    if (!title || !excerpt) {
      droppedMalformed += 1;
      continue;
    }
    if (excerpt.length > MATERIAL_EXCERPT_MAX) {
      droppedLong += 1;
      continue;
    }
    const kind = (MATERIAL_KINDS as readonly string[]).includes(str(o.kind))
      ? (str(o.kind) as MaterialKind)
      : 'document';
    // whyRelevant 는 모델이 쓴 한 문장 gloss 다 — 인용(절단 금지)이 아니므로
    // 300자에서 자른다. 인용의 규율(excerpt: 거절)과 다른 이유가 여기 있다.
    parsed.push({ title: title.slice(0, 120), kind, excerpt, ...(str(o.whyRelevant) ? { whyRelevant: str(o.whyRelevant).slice(0, 300) } : {}) });
  }
  const accepted = parsed.slice(0, MATERIAL_MAX_COUNT);
  return { accepted, droppedLong, droppedMalformed, droppedOverCap: parsed.length - accepted.length };
}

// 순수 포매터 (formatDueNotice 와 같은 이유로 분리 — 문안을 DB 없이 고정한다).
// 받은 것과 안 받은 것을 **둘 다** 말한다: 조용히 버리면 모델은 기록됐다고 믿는다.
export function formatMaterialNote(r: MaterialRead): string {
  const parts: string[] = [];
  if (r.accepted.length > 0) {
    parts.push(
      `기존 자료 ${r.accepted.length}건을 증거로 원장에 남겼습니다. ` +
        '자료는 근거일 뿐입니다 — 자료에서 가정 후보를 찾았으면 사용자에게 한 번에 하나만 확인한 뒤 ' +
        'argus_sharpen 으로 기록하고, 자료 속 문장을 사용자의 지금 입장으로 승격하지 마십시오.',
    );
  }
  const dropped: string[] = [];
  if (r.droppedLong > 0) {
    dropped.push(
      `${r.droppedLong}건은 인용이 ${MATERIAL_EXCERPT_MAX}자를 넘어 기록하지 않았습니다 ` +
        '(잘라서 받으면 인용이 아니게 되므로 자르지 않습니다 — 하중이 실린 대목만 골라 다시 보내십시오)',
    );
  }
  if (r.droppedMalformed > 0) dropped.push(`${r.droppedMalformed}건은 title/excerpt 가 없어 기록하지 않았습니다`);
  if (r.droppedOverCap > 0) dropped.push(`${r.droppedOverCap}건은 한도(${MATERIAL_MAX_COUNT}건)를 넘어 기록하지 않았습니다`);
  if (dropped.length > 0) parts.push(`기록하지 않은 자료: ${dropped.join(' · ')}.`);
  return parts.length > 0 ? `${parts.join('\n')}\n` : '';
}

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

// ── UNDERSTAND ────────────────────────────────────────────────────────────

export async function handleOpen(userId: string, args: Args) {
  const utterance = str(args.utterance);
  if (!utterance) return toolText('결정을 연 원문이 필요합니다.', true);
  const oversize = refuseOversize({ utterance });
  if (oversize) return oversize;

  // fire-gate가 먼저 돈다 (§4.6).
  //
  // userInvoked를 **모델이 이 도구를 불렀다는 사실에서 유도하지 않는다.**
  // 그렇게 하면 게이트가 항상 통과해 장식이 되고, "개입할지 여부를 사용자 대신
  // 판정하지 말라"(거울 조항)를 정확히 어긴다 — 부른 것은 모델이지 사용자가
  // 아니기 때문이다. 사용자가 명시적으로 불렀을 때만 모델이 그렇다고 말한다.
  const gate = fireGate(new Ledger(), {
    hostUtterance: utterance,
    userInvokedArgus: args.userInvoked === true,
  });
  if (!gate.fire) {
    return toolText(
      `지금은 결정을 열지 않습니다 (${gate.reason}). ` +
        '사용자가 실제로 결정을 여는 순간에, 또는 사용자가 명시적으로 Argus를 부르면 ' +
        'userInvoked: true 와 함께 다시 부르십시오.',
      true,
    );
  }

  const lean = str(args.lean);
  const reasons = strArr(args.statedReasons);
  const alternatives = strArr(args.consideredAlternatives);
  const oversizeMore =
    refuseOversize({ lean }) ||
    refuseOversizeList('statedReasons', reasons) ||
    refuseOversizeList('consideredAlternatives', alternatives);
  if (oversizeMore) return oversizeMore;

  const caseId = newCaseId();
  const engine = await loadEngine(userId, caseId);
  engine.recordUtterance(utterance, now());
  if (lean || reasons.length > 0 || alternatives.length > 0) {
    engine.recordBaseline({ lean: lean || 'none_stated', statedReasons: reasons, consideredAlternatives: alternatives }, now());
  } else {
    // 말하지 않은 것을 지어내지 않는다 — 부재를 부재로 기록한다.
    engine.recordBaseline(undefined, now());
  }

  // 기존 자료 (콜드스타트 인테이크). baseline 뒤에 붙지만 baseline 과 다른
  // 채널이다 — 자료가 몇 건이든 위의 기울기 기록은 사용자가 말한 것만 담는다.
  const materials = readMaterials(args.materials);
  for (const m of materials.accepted) {
    engine.recordSource(
      `${m.kind}: ${m.title}${m.whyRelevant ? ` — ${m.whyRelevant}` : ''}\n${m.excerpt}`,
      `chat-material:${m.kind}:${m.title}`,
      now(),
    );
  }

  await upsertCase(userId, caseId, utterance.slice(0, 120), engine.state().state);
  await persistNewEvents(userId, caseId, engine, new Set());

  // 범위 위임 (TWIN §4.5). 사용자가 **자기 말로** 미리 승인해 둔 정책이 이
  // 조건에 해당하면 그것을 꺼내 놓는다. 꺼내는 것까지가 위임의 전부다 —
  // 채택은 여전히 argus_adopt(사용자의 명시)로만 일어난다. 침묵이 기본값이다.
  //
  // **그림자보다 먼저 부르는 이유**가 아래 오염 방지선이다.
  const delegation = await applyDelegation(userId, utterance);

  // 꺼내진 위임을 서버가 직접 케이스에 남긴다 (결정론 백스톱). 채택 때 모델이
  // appliedDelegationId 를 빼먹어도, 정산이 "꺼내졌는데 확인이 안 됐다"를
  // 정직한 공백으로 말할 수 있는 근거가 여기서 생긴다.
  if (delegation) {
    runAfterResponse(() => markCaseDelegationOffered(userId, caseId, delegation.delegation.id));
  }

  // 그림자 시험 (TWIN §4.2) — 분신이 같은 시험을 몰래 친다. 응답을 막지 않고
  // (after()), 실패해도 열기는 무사하다. **이 예측은 정산 전에는 어떤 표면에도
  // 나오지 않는다** — 여기서 생성만 하고 응답에는 아무것도 싣지 않는 것이 규칙.
  runAfterResponse(async () => {
    // 프로필이 있으면 분신이 그 위에서 예측한다 — 없으면 없다고 프롬프트가 밝힌다.
    const lines = await profileLines(userId);
    // 위임이 꺼내진 결정에서 "무엇을 고를까"는 **자명한 예측**이다 — 사용자가
    // 방금 자기 정책을 눈앞에서 봤기 때문이다. 이것은 lean 오염과 정확히 같은
    // 형태이므로 같은 방식으로 처리한다: 정책을 기울기로 넘겨 분신이 choice
    // 대신 **이탈**을 예측하게 하고, 그 행은 오염 플래그와 함께 봉인된다.
    // (원장의 baseline 은 손대지 않는다 — 사용자가 이번에 말한 기울기가 아니다.)
    const effectiveLean = lean || (delegation ? delegation.delegation.policy : undefined);
    await generateAndSealShadow(
      userId,
      caseId,
      {
        utterance,
        lean: effectiveLean,
        statedReasons: reasons,
        consideredAlternatives: alternatives,
      },
      { profileLines: lines },
    );
  });

  // 자기 이탈 감지 (TWIN §4.4). 침묵이 기본값 — 같은 도메인 정산 증거 5건
  // 이상의 패턴이 있고, 새 기울기가 그것과 명확히 어긋날 때만 한 문장을
  // 붙인다. 기준점은 기계의 의견이 아니라 사용자 자신의 기록이고, 질문 문장은
  // 결정론 템플릿이 만든다. 동기 호출인 이유: MCP 는 push 가 없어 응답에
  // 실리지 못한 발화는 존재하지 않는 발화다 — 대신 관문이 빈도를 누른다.
  // **둘 중 하나만 발화한다.** 위임과 이탈 crux 가 같은 응답에 함께 붙으면
  // 한 번 열었는데 기계가 두 번 말하는 것이고, 그것은 거울 조항이 금지한
  // 과발화다 (divergence 자신도 "여러 패턴이 걸려도 하나만" 규칙을 갖는다).
  // 위임이 이긴다: 그것은 사용자가 **미리 시켜 둔** 발화이고, 이탈 crux 는
  // 기계가 먼저 꺼내는 발화다. 요청받은 말이 요청받지 않은 말보다 앞선다.
  const crux = delegation ? '' : await divergenceCrux(userId, utterance, lean || undefined);

  return ok(
    userId,
    `결정을 열었습니다 (id: ${caseId}, 발동 사유: ${gate.reason}).\n` +
      (lean
        ? `AI가 말하기 전의 기울기를 보존했습니다: "${lean}"\n`
        : '기울기 없이 시작했습니다 — 그것도 정직한 출발점입니다.\n') +
      formatMaterialNote(materials) +
      '다음: argus_sharpen 으로 가장 무게가 실리는 가정 하나를 확인하십시오.' +
      crux +
      (delegation
        ? `${delegation.text}\n(채택할 때 appliedDelegationId: "${delegation.delegation.id}" 를 함께 보내면 이 정책이 정산으로 채점됩니다.)`
        : ''),
    caseId,
  );
}

// ── IMPROVE ───────────────────────────────────────────────────────────────

const SHARPEN_BRIEF =
  '이 결정에서 하중이 가장 큰 가정 하나만 짚으십시오. 규칙:\n' +
  '· 방향을 정해주지 말 것 (어느 쪽이 낫다고 말하지 않는다)\n' +
  '· 짚기가 틀렸음을 보여줄 관찰 가능한 사실(falsifier)을 함께 말할 것\n' +
  '· 한 턴에 한 가지만\n\n' +
  '짚기를 정했으면 **같은 도구를 assumption·falsifier·whyNow 와 함께 다시 부르십시오.** ' +
  '그래야 그 짚기가 검증기를 통과하고 원장에 남습니다. 부르지 않으면 그 문장은 기록되지 않습니다.';

export async function handleSharpen(userId: string, args: Args) {
  const caseId = str(args.caseId);
  if (!caseId) return toolText('caseId가 필요합니다.', true);
  const engine = await loadEngine(userId, caseId);
  const state = engine.state();
  if (!state.baseline && state.observations.length === 0) {
    return toolText('이 결정에 대한 기록이 없습니다. 먼저 argus_open 으로 여십시오.', true);
  }

  const assumption = str(args.assumption);
  const oversize = refuseOversize({ assumption, falsifier: str(args.falsifier), whyNow: str(args.whyNow) });
  if (oversize) return oversize;
  const said = state.baseline && state.baseline !== 'not_captured' ? state.baseline : null;

  // 1단계 — 아직 짚기가 없다: 무엇을 지켜야 하는지 알려주고, 사용자가 이미 말한
  // 것만 재료로 준다. 여기서 방향을 만들지 않는다.
  if (!assumption) {
    return ok(
      userId,
      `${SHARPEN_BRIEF}\n\n` +
        `사용자가 실제로 말한 것: ${
          said
            ? `기울기 "${said.lean}", 이유 ${JSON.stringify(said.statedReasons)}`
            : '(기록된 기울기 없음 — 사용자의 생각을 지어내지 마십시오)'
        }`,
      caseId,
    );
  }

  // 2단계 — 모델의 짚기를 **검증기에 통과시킨다.** 이 호출이 없으면 저자성
  // 계보·다운그레이드 검사가 원격 표면에서 한 번도 돌지 않는다 (생산했으나
  // 소비하지 않는 필드 = dead on arrival).
  const moveType = (['reframe', 'value_clarification', 'competing_hypotheses', 'premortem', 'outside_view'] as MoveType[]).includes(
    str(args.moveType) as MoveType,
  )
    ? (str(args.moveType) as MoveType)
    : ('reframe' as MoveType);

  const turn: ArgusTurn = {
    phase: 'improve',
    route: 'decision',
    caseFit: 'in_scope',
    primaryMove: {
      type: moveType,
      content: assumption,
      whyNow: str(args.whyNow) || '이 가정이 틀리면 선택이 뒤집히기 때문',
      ...(str(args.falsifier) ? { falsifier: str(args.falsifier) } : {}),
    },
    // 주장은 **AI가 추론한 것 하나뿐**이다. 사용자가 말했다고 여기서 덧붙이면
    // 계보가 없는 user 주장이 되고, 검증기(check 6b)가 그것을 ai/inferred 로
    // 되돌린다 — 즉 저자성 세탁 시도로 취급된다. 사용자의 이유는 이미 원장의
    // baseline 에 그의 것으로 있으므로 여기서 다시 주장할 이유가 없다.
    claims: [{ text: assumption, source: 'ai', authority: 'inferred' }],
    ...(strArr(args.abstentions).length > 0 ? { abstentions: strArr(args.abstentions) } : {}),
  };

  const known = await knownEventIds(userId, caseId);
  const result = await guard(async () => engine.receiveTurn(turn, now()));
  if ('violation' in result) return toolText(result.violation, true);

  await persistNewEvents(userId, caseId, engine, known);

  if (!result.ok) {
    // 거부는 조용히 넘기지 않는다 — 모델이 무엇을 어겼는지 알아야 고친다.
    return toolText(
      '이 짚기는 기록되지 않았습니다. 검증기가 거부한 이유:\n' +
        result.rejections.map((r) => `· ${r.code}: ${r.detail}`).join('\n'),
      true,
    );
  }

  const adjusted = result.turn;
  const downgraded = result.downgrades.length > 0;
  return ok(
    userId,
    `짚기를 기록했습니다.\n${adjusted.primaryMove.content}\n` +
      (adjusted.primaryMove.falsifier
        ? `이것이 틀렸음을 보여줄 사실: ${adjusted.primaryMove.falsifier}\n`
        : '(관찰 가능한 반증 사실이 없습니다)\n') +
      (downgraded
        ? `\n검증기가 형태를 낮췄습니다 — 사용자에게 이 사실을 숨기지 마십시오:\n` +
          result.downgrades.map((d) => `· ${d.code}: ${d.detail}`).join('\n') +
          (adjusted.question ? `\n\n대신 물을 것: "${adjusted.question.text}"` : '')
        : ''),
    caseId,
  );
}

// ── MOVE ──────────────────────────────────────────────────────────────────

export async function handleAdopt(userId: string, args: Args) {
  const caseId = str(args.caseId);
  const choice = str(args.choiceOrPolicy);
  if (!caseId || !choice) return toolText('caseId와 choiceOrPolicy가 필요합니다.', true);
  const oversize = refuseOversize({ choiceOrPolicy: choice, question: str(args.question) });
  if (oversize) return oversize;

  const engine = await loadEngine(userId, caseId);
  const known = await knownEventIds(userId, caseId);
  const state = engine.state();
  const edited = args.edited === true;

  // 열린 적 없는 결정은 채택할 수 없다. 허용하면 질문 자리에 선택이 들어가고
  // (원문이 없으니까), 그 문장이 제목이 되어 귀환 메일 제목으로 새어 나간다.
  if (engine.ledger.forCase(caseId).length === 0) {
    return toolText('이 caseId 로 열린 결정이 없습니다. 먼저 argus_open 으로 여십시오.', true);
  }

  // 이미 채택된 결정을 다시 채택할 수 없다 — 과거는 편집 대상이 아니다.
  // 엔진도 append 전에 같은 검사로 막지만(오염 이벤트가 원장에 들어가는 것을
  // 차단), 여기서 먼저 잡아 다음 행동까지 일러 준다. 모델의 재시도, 사용자의
  // "다시 말하지만 이대로" — 채택이 두 번 오는 경로는 현실에 흔하다.
  if (state.card) {
    return toolText(
      `이 결정에는 이미 채택된 기록이 있습니다: "${state.card.choiceOrPolicy}". ` +
        '과거의 채택은 고칠 수 없습니다 — 선택이 실제로 바뀌었다면 새 결정으로 여시고(argus_open), ' +
        '결과가 나왔다면 argus_return 으로 돌아보십시오.',
      true,
    );
  }

  // 하중·이유를 지어내지 않는다. 안 온 것은 (a) 가장 엄격한 쪽으로 닫고
  // (b) 그랬다는 사실을 응답에 적는다. 예전 버전은 significant/costly 를
  // 조용히 박아 넣었는데, 그것은 사용자가 하지 않은 판단을 원장에 쓴 것이다.
  const { stakes, assumed } = readStakes(args.stakes);
  const values = strArr(args.values);
  const { beliefs: materialBeliefs, dropped: droppedBeliefs } = readBeliefs(args.materialBeliefs);
  const rejected = (args.rejectedAlternative ?? null) as Args | null;
  const rejectedAlternative =
    rejected && str(rejected.alternative)
      ? { alternative: str(rejected.alternative), reason: str(rejected.reason) || '이유가 기록되지 않음' }
      : undefined;
  const oversizeLists =
    refuseOversizeList('values', values) ||
    refuseOversizeList('materialBeliefs', materialBeliefs.map((b) => b.belief)) ||
    (rejectedAlternative
      ? refuseOversize({ rejectedAlternative: rejectedAlternative.alternative, rejectedReason: rejectedAlternative.reason })
      : null);
  if (oversizeLists) return oversizeLists;

  const adoptedState = (['decide', 'test', 'research', 'defer', 'reframe', 'stop'] as const).includes(
    str(args.adoptedState) as 'decide',
  )
    ? (str(args.adoptedState) as 'decide')
    : ('decide' as const);

  // 결정 **질문**은 선택이 아니다. 예전 버전은 카드가 없을 때 choiceOrPolicy 를
  // question 으로 썼는데, 그러면 돌아보기 첫 화면이 "무슨 일이 있었나요?"와 함께
  // 사용자의 선택을 그대로 보여준다 — §7.3의 관찰 우선 순서가 깨진다.
  // 질문은 결정을 연 그 말에서 온다.
  const openingUtterance = engine.ledger
    .forCase(caseId)
    .find((e) => e.type === 'user_utterance') as { text: string } | undefined;
  // 위의 이중 채택 거절로 여기서는 카드가 없다 — 질문의 출처는 모델이 보낸
  // question 아니면 결정을 연 원문뿐이다.
  const question = str(args.question) || openingUtterance?.text.slice(0, 120) || choice.slice(0, 120);

  const violation = await guard(async () =>
    engine.adoptCard(
      {
        question,
        stakes,
        adoptedState,
        choiceOrPolicy: choice,
        rationale: { values, materialBeliefs, ...(rejectedAlternative ? { rejectedAlternative } : {}) },
      },
      edited ? { mode: 'edit_then_accept', editedFields: ['choiceOrPolicy'], materialEdit: true } : { mode: 'accept' },
      now(),
    ),
  );
  if (typeof violation === 'object' && violation !== null && 'violation' in violation) {
    return toolText(violation.violation, true);
  }

  await persistNewEvents(userId, caseId, engine, known);
  await upsertCase(userId, caseId, question, engine.state().state);

  const gaps: string[] = [];
  if (assumed) gaps.push('하중(stakes)이 오지 않아 가장 엄격한 쪽(major / one_way)으로 기록했습니다 — 실제와 다르면 stakes와 함께 다시 부르십시오.');
  if (values.length === 0 && materialBeliefs.length === 0) {
    gaps.push('이 선택을 떠받치는 가치·사실 믿음이 비어 있습니다 — 사용자가 말한 것이 있으면 values / materialBeliefs 로 보내십시오.');
  }
  if (droppedBeliefs > 0) {
    gaps.push(
      `믿음 ${droppedBeliefs}건은 확신도(confident / uncertain / contested)가 없어 기록하지 않았습니다 — ` +
        '확신도는 정산 때 현실과 대조되므로 우리가 대신 정할 수 없습니다. 사용자가 말한 등급과 함께 다시 보내십시오.',
    );
  }

  // 이 채택이 기존 위임을 따랐다면 케이스에 도장을 찍는다 — 정산 때 위임을
  // 채점할 대상이 여기서 생긴다. 실패해도 채택은 무사하다 (부가 기록).
  const appliedDelegationId = str(args.appliedDelegationId);
  if (appliedDelegationId) {
    runAfterResponse(() => markCaseDelegation(userId, caseId, appliedDelegationId));
  }

  // 새 위임. **거부가 기본값**이고, 거부하면 왜 거부했는지 응답에 그대로 적는다 —
  // 조용히 안 만들면 사용자는 위임이 생긴 줄 알고 다음 결정을 기다린다.
  let delegationNote = '';
  const delegationArg = (args.delegation ?? null) as Args | null;
  if (delegationArg) {
    const created = await createDelegation(userId, {
      policy: str(delegationArg.policy),
      scopeDomain: str(delegationArg.scopeDomain),
      scopeCondition: str(delegationArg.scopeCondition),
      userWords: str(delegationArg.userWords),
      days: typeof delegationArg.days === 'number' ? delegationArg.days : undefined,
      fromCaseId: caseId,
    });
    if (created.ok) {
      const requested = typeof delegationArg.days === 'number' ? Math.trunc(delegationArg.days) : DELEGATION_DEFAULT_DAYS;
      const truncated = requested > DELEGATION_MAX_DAYS;
      delegationNote =
        `\n\n위임이 만들어졌습니다 (${created.expiresAt.slice(0, 10)}까지` +
        (truncated ? `, 요청하신 ${requested}일은 최대 ${DELEGATION_MAX_DAYS}일로 줄였습니다` : '') +
        ').\n' +
        '다음에 같은 조건의 결정을 열면 이 정책을 꺼내 놓습니다. 결정을 대신하지는 않습니다 — ' +
        '채택은 여전히 사용자가 하고, 정산 때마다 이 정책 자체가 채점됩니다. ' +
        '어긋남이 쌓이면 위임은 스스로 멈춥니다.';
    } else {
      delegationNote = `\n\n위임은 만들지 않았습니다: ${created.reason}`;
    }
  }

  return ok(
    userId,
    `채택되었습니다 — 이 결정은 이제 사용자의 것으로 기록됩니다${edited ? ' (수정분 포함)' : ''}.\n` +
      `하중: ${stakes.weight} / ${stakes.reversibility}\n` +
      (gaps.length > 0 ? `\n비어 있는 자리 (채우지 않고 그대로 둡니다):\n· ${gaps.join('\n· ')}\n` : '') +
      '\n다음: argus_plan 으로 실행 계획을 만들면, 그 기한들이 그대로 돌아보기 약속이 됩니다.' +
      delegationNote,
    caseId,
  );
}

// ── PLAN (MOVE와 RETURN을 잇는 다리) ──────────────────────────────────────

const PLAN_BRIEF =
  '계획 단계를 함께 보내주십시오. 각 단계: { what, kind: prepare|investigate|execute, byOrWhen, dueDate?(ISO 8601) }\n' +
  '· 사용자가 정한 결정을 옮기는 순서만 만드십시오 (무엇을 고를지 다시 정하지 마십시오)\n' +
  '· 모르는 것은 단계로 지어내지 말고 openQuestions 에 "확인 필요: …" 로 남기십시오\n' +
  '· dueDate 가 붙은 단계는 돌아보기 약속이 됩니다 — 정말 확인할 것에만 붙이십시오';

export async function handlePlan(userId: string, args: Args) {
  const caseId = str(args.caseId);
  if (!caseId) return toolText('caseId가 필요합니다.', true);

  const steps = Array.isArray(args.steps) ? (args.steps as unknown[]) : [];
  if (steps.length === 0) {
    // 모델에게 형태를 알려주되, 내용을 지어내지 않는다.
    return toolText(PLAN_BRIEF, true);
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

  // 단계 문장은 귀환 큐(from_step)와 이메일 문안까지 흐른다 — 상한을 여기서 잡는다.
  const oversizePlan =
    refuseOversizeList('계획 단계(what)', plan.steps.map((s) => s.what), 20, 500) ||
    refuseOversizeList('계획 단계(byOrWhen)', plan.steps.map((s) => s.byOrWhen), 20, 500) ||
    refuseOversizeList('openQuestions', plan.openQuestions, 20, 500);
  if (oversizePlan) return oversizePlan;

  const engine = await loadEngine(userId, caseId);
  const known = await knownEventIds(userId, caseId);

  // 케이스당 계획 하나 (하네스 assertPlanAllowed 도 같은 규칙으로 잠근다).
  // 여기서 먼저 잡는 이유는 문안이다 — 지금 걸려 있는 계획을 보여주며 거절해야
  // 모델이 다음 턴에 무엇을 할지 안다. 두 번째 계획을 조용히 받으면 돌아보기
  // 약속이 3+3 으로 쌓인다 (2026-08-09 라운드 2 시뮬레이션에서 실증된 과발화).
  const existing = engine.state().plan;
  if (existing) {
    const currentSteps = existing.steps.map((s, i) => `${i + 1}. ${s.what} — ${s.byOrWhen}`).join('\n');
    return toolText(
      `이 결정에는 이미 실행 계획이 있습니다:\n${currentSteps}\n\n` +
        '계획을 갈아끼우면 걸어 둔 돌아보기 약속이 조용히 불어나므로 받지 않습니다. ' +
        '남은 마일스톤은 그대로 진행하시고, 새로 확인할 것이 생겼으면 새 결정으로 여십시오.',
      true,
    );
  }

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
  return ok(
    userId,
    `실행 계획이 기록되었습니다.\n${lines.join('\n')}\n\n${planReturnSummary(plan)}` +
      (plan.openQuestions.length > 0 ? `\n\n아직 확인이 필요한 것:\n· ${plan.openQuestions.join('\n· ')}` : ''),
    caseId,
  );
}

// ── RETURN ────────────────────────────────────────────────────────────────

export async function handleReturn(userId: string, args: Args) {
  const caseId = str(args.caseId);
  if (!caseId) return toolText('caseId가 필요합니다.', true);

  const engine = await loadEngine(userId, caseId);
  const known = await knownEventIds(userId, caseId);
  const state = engine.state();
  if (!state.card) return toolText('이 결정에는 채택된 기록이 없습니다.', true);

  const observation = str(args.observation);
  const recall = str(args.recall);
  const oversize = refuseOversize({ observation, recall });
  if (oversize) return oversize;
  // 스키마가 ISO 8601 이라고 적어도 호스트가 그것을 검증한다는 보장이 없다.
  // 원장은 append-only 라 잘못 들어간 시각은 **영영 고칠 수 없다** — "지난주"
  // 같은 문자열이 IsoTime 자리에 박히면 그 케이스의 시간축이 죽는다.
  // (같은 이유로 validatePlan 이 dueDate 를 다시 검사한다.)
  const parsedObservedAt = str(args.observedAt);
  const observedAt =
    parsedObservedAt && !Number.isNaN(new Date(parsedObservedAt).getTime()) ? parsedObservedAt : now();
  const recordObservation = () =>
    engine.recordObservation(observation, args.relayed === true ? 'relayed' : 'direct', observedAt, now());

  const caseEvents = engine.ledger.forCase(caseId);

  // 이미 정산이 끝난 결정(기록이 공개된 적 있고, 기다리는 귀환도 없음). 나중
  // 사실은 덧붙지만(§AUTHORITY), 회상 탐침과 기록 열기는 **다시 하지 않는다** —
  // 정산된 결정을 다시 여는 것은 과발화이고, 결과를 본 뒤의 기억은 더 이상
  // 오염되지 않은 기억이 아니다.
  //
  // 판정 기준 둘 다 필요하다:
  // · activeReturn 부재만 보면 안 된다 — 계획도 귀환 계약도 없이 채택만 한
  //   케이스는 activeReturn 이 처음부터 없는데, 그것을 "이미 정산 끝"으로 읽으면
  //   거짓말이고(정산은 시작도 안 했다) 그 케이스는 영영 정산 불가가 된다
  //   (2026-08-09 프로덕션 도그푸드 2회차에서 실제로 걸림).
  // · fold 의 recordRevealed 만 봐도 안 된다 — return_closed 가 다음 연쇄
  //   사이클을 위해 그 플래그를 **리셋한다** (reducer §7.2). 정산된 적 있는지는
  //   원장의 record_revealed 이벤트 실존으로 본다.
  // activeReturn 이 살아 있으면(연쇄 귀환의 다음 사이클 포함) 정상 흐름이다.
  const everRevealed = caseEvents.some((e) => e.type === 'record_revealed');
  if (!state.activeReturn && everRevealed) {
    // 투영 자기 치유. projectOutcome 은 캐시라 실패해도 던지지 않는다 — 정산
    // 직후 투영만 유실되면 return 은 "정산 끝", recall 은 "미정산"이라는 모순이
    // 영구히 남는다. 원장이 정본이므로 접촉할 때 원장에서 재생한다.
    const row = await getCase(userId, caseId);
    const projectionLost = !row?.settled_at;
    const rebuildProjection = async () => {
      const lastRecall = [...caseEvents].reverse().find((e) => e.type === 'recall_probe_answer');
      const lastReveal = [...caseEvents].reverse().find((e) => e.type === 'record_revealed');
      await projectOutcome(userId, caseId, {
        choice: state.card?.choiceOrPolicy,
        rejectedAlternative: state.card?.rationale?.rejectedAlternative?.alternative,
        observation: engine.state().observations.at(-1)?.text ?? '',
        recall: lastRecall && 'text' in lastRecall ? lastRecall.text : '',
        settledAt: lastReveal?.at ?? now(),
      });
    };

    if (!observation) {
      if (projectionLost) await rebuildProjection();
      return toolText(
        '이 결정은 이미 정산이 끝났습니다 (기다리는 귀환이 없습니다). ' +
          '새로 알게 된 사실이 있으면 observation 으로 보내주시면 덧붙입니다.',
        true,
      );
    }
    if (state.observations.at(-1)?.text !== observation) recordObservation();
    await persistNewEvents(userId, caseId, engine, known);
    await upsertCase(userId, caseId, state.card.question, engine.state().state);
    // 나중 사실은 투영에도 도달해야 한다 — "덧붙였습니다"라고 말해 놓고 recall
    // 의 "실제로 일어난 일"이 낡은 채면 그 말이 화면에서 거짓이 된다.
    if (projectionLost) await rebuildProjection();
    else await updateLastObservation(userId, caseId, observation);
    return ok(
      userId,
      '나중 사실로 덧붙였습니다. 이 결정은 이미 정산이 끝났으므로 회상 탐침은 다시 하지 않습니다 — ' +
        '결과를 본 뒤의 기억은 더 이상 오염되지 않은 기억이 아니기 때문입니다.',
      caseId,
    );
  }

  // 이번 사이클의 관찰만 센다. 연쇄 귀환에서 마지막 record_revealed 뒤의 관찰이
  // 다음 사이클의 것이다 — 지난 사이클의 관찰로 다음 기록을 열면 관찰 우선(§7.3)이
  // 두 번째 사이클부터 장식이 된다 (2026-08-09 라운드 2 시뮬레이션에서 실증:
  // 회상만 들고 온 2사이클 호출이 1사이클의 관찰을 재사용해 기록을 열었다).
  const lastRevealIdx = caseEvents.reduce((acc, e, i) => (e.type === 'record_revealed' ? i : acc), -1);
  const cycleObservations = caseEvents
    .slice(lastRevealIdx + 1)
    .filter((e): e is Extract<LedgerEvent, { type: 'observation' }> => e.type === 'observation');

  // 관찰이 없으면 기록을 열지 않는다 — 이 순서가 §7.3의 전부다.
  //
  // "없다"는 **이번 호출 + 원장(이번 사이클)**을 합쳐 본다. 1차 호출(관찰만)의
  // 응답이 "답을 recall 로 보내주시면"이라고 안내하므로, 그 말대로 recall 만
  // 들고 온 2차 호출을 원장의 관찰을 무시하고 거절하면 안내문이 거짓말이 된다 —
  // 그리고 모델은 우회하느라 같은 관찰을 다시 보내 append-only 원장에 중복
  // 이벤트를 영구히 남긴다 (2026-08-09 프로덕션 도그푸드에서 실제로 걸림).
  if (!observation && cycleObservations.length === 0) {
    const opening = engine.openReturn();
    return toolText(
      `먼저 실제로 무슨 일이 있었는지 들어야 합니다.\n\n"${opening.question}"\n기다리던 것: ${opening.awaitedSignal}\n\n` +
        '사용자의 답을 observation 으로 다시 보내주십시오. 그때의 선택과 이유는 그 뒤에 열립니다.',
      true,
    );
  }

  // 새 사실만 덧붙인다. 같은 문장을 다시 보낸 것은 새 관찰이 아니라 재전송이다
  // — append-only 원장에 같은 이벤트가 두 번 남으면 지울 수 없다.
  if (observation && cycleObservations.at(-1)?.text !== observation) recordObservation();
  // 이번 정산이 대조할 관찰: 이번 호출에 왔으면 그것, 아니면 이번 사이클의 마지막 관찰.
  const effectiveObservation = observation || cycleObservations.at(-1)?.text || '';

  if (!recall) {
    await persistNewEvents(userId, caseId, engine, known);
    // isError 가 아니다 — 관찰은 방금 원장에 들어갔고, 이 응답은 다음 단계 안내다.
    // 성공한 append 를 실패로 신고하면 호스트 모델이 재시도·사과부터 한다.
    return toolText(
      '기록했습니다. 기록을 열기 전에 하나만 —\n\n' +
        '"당시 왜 그렇게 정했는지, 기억나는 대로 말씀해 주시겠어요?"\n\n' +
        '답을 recall 로 보내주시면 그때의 기록과 나란히 보여드립니다.',
    );
  }

  const revealResult = await guard(async () => {
    engine.recordRecallProbeAnswer(recall, now());
    const revealed = engine.revealRecord(now());
    // 정산이 끝났으면 귀환을 닫는다. 닫지 않으면 원장의 activeReturn이 영원히
    // 남아 같은 결정을 계속 다시 부른다 — 닫힌 결정을 다시 여는 과발화.
    if (engine.state().activeReturn) engine.closeReturn(now());
    return revealed;
  });
  // 위반이면 원장에는 아무것도 들어가지 않았다 (엔진이 append 전에 막는다).
  if ('violation' in revealResult) {
    await persistNewEvents(userId, caseId, engine, known);
    return toolText(revealResult.violation, true);
  }

  const revealed = revealResult;
  await persistNewEvents(userId, caseId, engine, known);
  await upsertCase(userId, caseId, revealed.card?.question ?? caseId, engine.state().state);
  // 스케줄러 큐도 닫는다 — 안 닫으면 크론 메일과 채팅 알림이 계속 온다.
  // 단, 연쇄가 계속되면(닫힌 귀환이 다음 마일스톤을 승격) **이번 사이클의 행
  // 하나만** 닫는다. 전건을 닫으면 엔진은 다음 귀환을 기다리는데 스케줄러 큐는
  // 비어 있는 단선이 되고, 남은 마일스톤의 이메일·채팅 알림이 소리 없이 영영
  // 오지 않는다 (2026-08-09 라운드 2 시뮬레이션에서 실증).
  if (engine.state().activeReturn) await completeOneReturn(userId, caseId);
  else await completeReturns(userId, caseId);
  // 정산 결과를 케이스 행에 투영한다. **이 한 줄이 해자다**: 다음에 비슷한
  // 결정을 만났을 때 argus_recall 이 "지난번엔 이렇게 가정했고 실제로는
  // 이랬다"를 돌려줄 수 있는 것은 여기서 남긴 것 때문이다. 없으면 이 제품은
  // 계획만 내주는 범용 AI와 구분되지 않는다.
  await projectOutcome(userId, caseId, {
    choice: revealed.card?.choiceOrPolicy,
    rejectedAlternative: revealed.card?.rationale?.rejectedAlternative?.alternative,
    observation: effectiveObservation,
    recall,
    settledAt: now(),
  });

  // 그림자 공개 (TWIN §4.2) — 봉인은 정산 순간에만 열린다. 여기가 그 순간이다:
  // 관찰과 회상이 이미 원장에 들어간 뒤라 §7.3 순서와 충돌하지 않는다.
  // 채점(3치 판정)은 LLM 호출이므로 응답을 막지 않고 뒤에서 돈다.
  const shadow = await revealShadowsText(userId, caseId);
  if (shadow.revealed.length > 0) {
    // 채택 기록을 함께 넘긴다 — outcome 예측은 관찰과, choice/deviation 예측은
    // **실제 채택**과 대조된다. 후자를 넘기지 않으면 match rate 의 모수가
    // 영영 0 이 되고, 봉인해 둔 예측이 죽은 데이터가 된다.
    const adoptedLean =
      revealed.baseline && revealed.baseline !== 'not_captured' && revealed.baseline.lean !== 'none_stated'
        ? revealed.baseline.lean
        : undefined;
    const adoptedChoice = revealed.card?.choiceOrPolicy;
    runAfterResponse(() =>
      gradeRevealedShadows(
        shadow.revealed,
        effectiveObservation,
        adoptedChoice ? { choice: adoptedChoice, lean: adoptedLean } : undefined,
      ),
    );
  }

  // 위임 채점 (TWIN §4.5). 위임을 따른 결정에서만 돈다 — 대부분의 정산에는
  // 위임이 없고 그러면 LLM 호출도 없다. **동기 호출인 이유**: 위임이 자동으로
  // 멈췄다는 사실은 사용자가 지금 알아야 하는 것이다. 다음에 그 정책을 다시
  // 꺼내지 않을 것이므로, 말하지 않으면 사용자는 위임이 여전히 도는 줄 안다.
  const delegationId = await caseDelegationId(userId, caseId);
  const delegationGrade = delegationId ? await gradeDelegation(userId, delegationId, effectiveObservation) : null;
  // 채점 누락을 조용히 넘기지 않는다: 열 때 위임이 꺼내졌는데(서버 기록) 채택에
  // appliedDelegationId 가 없으면, 따랐는지 안 따랐는지 알 수 없어 채점하지
  // 않는다 — 그리고 그 사실을 말한다. 모르는 것을 아는 것처럼 채점하는 것도,
  // 누락을 침묵으로 덮는 것도 둘 다 조작이다.
  const offeredButUnconfirmed = !delegationId && (await offeredDelegationId(userId, caseId));
  const delegationGap = offeredButUnconfirmed
    ? '\n\n이 결정을 열 때 위임 정책이 꺼내져 있었지만, 채택에 appliedDelegationId 가 기록되지 않아 정책을 채점하지 않았습니다 — 따랐는지 여부를 지어내지 않습니다.'
    : '';

  // 사전등록 믿음 채점 (TWIN M5). 채택 때 사용자가 **자기 손으로** confident/
  // uncertain/contested 를 붙인 믿음들을 관찰과 대조한다. 채점 대상은 사용자가
  // 아니라 그 문장들이고, 결과는 argus_recall 을 직접 불렀을 때만 보인다 —
  // 정산 직후에 성적을 들이미는 것은 요청받지 않은 성적표다 (§9 위험표).
  runAfterResponse(async () => {
    const beliefs = (revealed.card?.rationale?.materialBeliefs ?? []) as StatedBelief[];
    await gradeStatedBeliefs(userId, caseId, beliefs, effectiveObservation);
  });

  // 프로필 추출 (TWIN §4.1) — 방금 정산된 케이스 하나에서만. 검증(증거 실존·
  // 판정 언어 린트)을 통과한 항목만 저장되고, 실패는 정산을 막지 않는다.
  runAfterResponse(async () => {
    const update = await extractProfileFromSettlement(userId, {
      caseId,
      question: revealed.card?.question ?? '',
      choice: revealed.card?.choiceOrPolicy ?? '',
      statedReasons:
        revealed.baseline && revealed.baseline !== 'not_captured' ? revealed.baseline.statedReasons : [],
      observation: effectiveObservation,
      recall,
    });
    // 산출을 소비한다 — after() 안이라 이번 응답에는 실을 수 없고, 그렇다고
    // 버리면 "프로필이 정말 갱신되고 있는가"를 확인할 방법이 사라진다. 다음
    // recall 이 사용자에게 결과를 보이고(물러난 관찰 절), 이 이벤트가 운영에
    // 보인다. 아무 변화도 없었으면 기록하지 않는다 — 없는 일은 이벤트가 아니다.
    if (update.inserted + update.reinforced + update.contradicted > 0) {
      await persistServerEvent('argus_profile_updated', { ...update, caseId }, { userId, path: '/api/mcp/v2' });
    }
  });

  return ok(
    userId,
    '이제 그때의 기록입니다.\n' +
      `결정: ${revealed.card?.choiceOrPolicy}\n` +
      `그때의 기울기: ${
        revealed.baseline && revealed.baseline !== 'not_captured' ? revealed.baseline.lean : '기록하지 않고 시작'
      }\n\n` +
      `방금의 기억: "${recall}"\n실제로 일어난 일: "${effectiveObservation}"\n\n` +
      '둘이 다르다면 그 차이가 이 기록이 존재하는 이유입니다 — 결과를 알고 나면 누구나 이유를 다시 씁니다.' +
      shadow.text +
      describeDelegationGrade(delegationGrade) +
      delegationGap,
    caseId,
  );
}

// 정산이 끝난 결정 한 건을 **그때의 가정과 실제로 일어난 일**로 되돌려준다.
// 이것이 이 도구의 존재 이유다 — 제목 목록은 범용 AI도 낼 수 있지만, 사용자가
// 그때 무엇을 믿었고 현실이 무엇이라 답했는지는 기록해 둔 쪽만 말할 수 있다.
function settledSummary(c: CaseRow): string {
  const lines = [`결정: ${c.title ?? c.id}`];
  if (c.choice) lines.push(`그때의 선택: ${c.choice}`);
  if (c.recall_gap) lines.push(`정산 직전에 기억한 이유: "${c.recall_gap}"`);
  if (c.last_observation) lines.push(`실제로 일어난 일: "${c.last_observation}"`);
  if (c.settled_at) lines.push(`정산: ${c.settled_at.slice(0, 10)}`);
  return lines.join('\n');
}

export async function handleRecall(userId: string, args: Args) {
  const caseId = str(args.caseId);

  // 한 건을 콕 집어 물으면 그 건의 정산을 통째로 돌려준다.
  if (caseId) {
    const c = await getCase(userId, caseId);
    if (!c) return toolText('그 id 의 결정이 없습니다.', true);
    if (!c.settled_at) {
      // 아직 정산 안 된 것을 정산된 것처럼 말하지 않는다.
      return ok(
        userId,
        `${c.title ?? c.id} — 아직 정산되지 않았습니다 (현재 ${c.state}).\n` +
          '기한이 오면 무슨 일이 있었는지부터 묻습니다. 지금 결과를 아신다면 argus_return 으로 여십시오.',
        caseId,
      );
    }
    return ok(
      userId,
      `${settledSummary(c)}\n\n` +
        '기억과 실제가 다르다면 그 차이가 이 기록이 존재하는 이유입니다 — ' +
        '결과를 알고 나면 누구나 이유를 다시 씁니다.',
      caseId,
    );
  }

  const limit = typeof args.limit === 'number' ? Math.min(Math.max(Math.trunc(args.limit), 1), 20) : 10;
  const query = str(args.query);
  // query는 선언만 하고 버리면 모델이 걸러졌다고 믿는다 — 유령 파라미터는
  // "그럴듯함이 맞음으로 위장"하는 전형이다. 실제로 거르고, 걸렀다고 말한다.
  //
  // 목록도 항상 풀에서 뽑는다. 최근 갱신순 상위 limit 건을 먼저 뽑고 나서
  // 정산/미정산을 나누면, 열린 결정이 limit 개를 넘는 순간 정산된 결정 —
  // 이 목록의 존재 이유 — 이 통째로 사라진다 (2026-08-09 라운드 3 시뮬레이션
  // 에서 실증). "정산된 것 먼저"는 표시 순서가 아니라 **자리 배정**의 약속이다.
  const SEARCH_POOL = 100;
  const all = await listCases(userId, SEARCH_POOL);
  // 검색 모수도 정직하게 — 풀이 상한에 닿았으면 "전체"가 아니라 "최근 N건"이다.
  const poolLabel = all.length >= SEARCH_POOL ? `최근 ${SEARCH_POOL}건` : `전체 ${all.length}건`;
  const needle = query.toLowerCase();
  const matches = query
    ? all.filter((c) =>
        [c.title ?? c.id, c.choice ?? '', c.last_observation ?? ''].some((f) => f.toLowerCase().includes(needle)),
      )
    : all;

  if (matches.length === 0) {
    return ok(
      userId,
      query
        ? `"${query}"와(과) 겹치는 지난 결정이 없습니다 (${poolLabel} 중). 검색어 없이 다시 부르면 전체를 봅니다.`
        : '아직 기록된 결정이 없습니다.',
    );
  }

  // 정산된 것에 자리를 먼저 준다. 이 목록에서 가치가 있는 것은 "무엇을 정했나"가
  // 아니라 "무엇이 실제로 일어났나"이기 때문이다.
  const settledAll = matches.filter((c) => c.settled_at);
  const openAll = matches.filter((c) => !c.settled_at);
  const settled = settledAll.slice(0, limit);
  const open = openAll.slice(0, Math.max(0, limit - settled.length));
  const parts: string[] = [];
  if (query) {
    // 조용한 절삭 금지: 몇 건이 걸렸고 그중 몇 건을 보여주는지 밝힌다.
    parts.push(
      `"${query}"로 거른 지난 결정 ${matches.length}건 (기록 ${poolLabel})` +
        (settled.length + open.length < matches.length ? ` — ${settled.length + open.length}건만 표시합니다.` : ''),
    );
  }

  if (settled.length > 0) {
    parts.push(
      `현실이 답을 준 결정 ${settledAll.length}건${settled.length < settledAll.length ? ` (최근 ${settled.length}건 표시)` : ''}:\n` +
        settled
          .map((c) => `· ${c.title ?? c.id} → 실제로: "${c.last_observation}" (${c.settled_at!.slice(0, 10)}, id: ${c.id})`)
          .join('\n'),
    );
  }
  if (open.length > 0) {
    parts.push(
      `아직 정산되지 않은 결정 ${openAll.length}건${open.length < openAll.length ? ` (최근 ${open.length}건 표시)` : ''}:\n` +
        open.map((c) => `· ${c.title ?? c.id} — ${c.state} (${c.updated_at.slice(0, 10)}, id: ${c.id})`).join('\n'),
    );
  } else if (openAll.length > 0) {
    // 반대 방향의 조용한 절삭도 금지 — 정산이 창을 다 채워 열린 결정이 밀렸으면
    // 밀렸다고 말한다.
    parts.push(`아직 정산되지 않은 결정 ${openAll.length}건은 표시 공간이 차서 생략했습니다 — limit 을 늘리면 보입니다.`);
  }
  if (settled.length > 0) {
    parts.push('한 건을 자세히 보려면 caseId 와 함께 다시 부르십시오 — 그때의 가정과 실제가 나란히 나옵니다.');
  }

  // 판단 프로필 절 (TWIN §4.1). 검색 없는 목록 조회에서만 — 검색 결과에 끼면
  // 소음이다. 항목마다 근거 케이스 id 가 붙어 있어 "왜 이렇게 아는지"가 보인다.
  // 비어 있으면 절 자체를 만들지 않는다 (없는 것을 있는 척하지 않음).
  if (!query) {
    const lines = await profileLines(userId, 5);
    if (lines.length > 0) {
      parts.push('정산에서 관찰된 판단 패턴 (편집·삭제 가능, 근거 케이스 첨부):\n' + lines.map((l) => `· ${l}`).join('\n'));
    }
    // 물러난 관찰 (TWIN §4.1). 반례가 쌓여 은퇴한 항목은 **말해야 한다** —
    // 조용히 빼면 기계가 자기 기록을 몰래 고치는 형태가 되고, 사용자는 이의를
    // 제기할 기회를 잃는다. 거울이 스스로 취소한 것도 거울에 비쳐야 한다.
    const retired = await recentlyRetiredLines(userId);
    if (retired.length > 0) {
      parts.push(
        '최근 물러난 관찰 (현실이 반대로 답해서 분신이 더 이상 쓰지 않습니다):\n' +
          retired.map((l) => `· ${l}`).join('\n'),
      );
    }
    // 보정 거울 (TWIN M5). **당김 표면에서만** 나온다 — 사용자가 argus_recall
    // 을 직접 불렀을 때. 등급별 표본이 차지 않으면 아무것도 나오지 않는다.
    const calibration = calibrationLines(await beliefCalibration(userId));
    if (calibration) parts.push(calibration);

    // 분신 성적 (TWIN §4.2). **사람이 아니라 예측을 채점한 것**이고, 표본
    // 미달이면 숫자를 감춘다 — 게이트는 twinScore 안에서 돈다(rate 가 null 로
    // 옴). TWIN 수정조항의 세 조건: 표본 임계 + 근거 케이스 id 동반 + 채점
    // 대상이 분신임을 문장에서 밝히기. 근거 id 는 여기서 싣는다 — 숫자만 있고
    // 출처가 없으면 "어떻게 아는지"를 물을 수 없다.
    const score = await twinScore(userId);
    const evidence = (ids: string[]) => (ids.length > 0 ? ` — 근거: ${ids.slice(0, 5).join(', ')}` : '');
    // 게이트는 twinScore 안에서 돌지만, 표면도 스스로 지킨다 (표본 미달 rate 는
    // 어디서 왔든 싣지 않는다 — 계약 밖 입력에 대한 이중 방어).
    const matchReady = score.matchRate !== null && score.matchSample >= TWIN_SCORE_MIN_SAMPLE;
    const outcomeReady = score.outcomeRate !== null && score.outcomeSample >= TWIN_SCORE_MIN_SAMPLE;
    if (matchReady || outcomeReady) {
      const bits: string[] = [];
      if (matchReady) {
        bits.push(`당신의 선택을 맞힌 비율 ${Math.round(score.matchRate! * 100)}% (${score.matchSample}건${evidence(score.matchCases)})`);
      }
      if (outcomeReady) {
        bits.push(`현실을 맞힌 비율 ${Math.round(score.outcomeRate! * 100)}% (${score.outcomeSample}건${evidence(score.outcomeCases)})`);
      }
      parts.push(`분신 성적 (분신의 예측을 채점한 것입니다 — 사용자에 대한 평가가 아닙니다): ${bits.join(' · ')}`);
    } else if (score.matchSample + score.outcomeSample > 0) {
      // 표본이 임계(3) 미달이면 숫자를 만들지 않는다 — "아직 모릅니다"가 정답이다.
      parts.push(
        `분신 성적: 아직 모릅니다 — 채점된 예측이 ${score.matchSample + score.outcomeSample}건뿐입니다 (표본 ${TWIN_SCORE_MIN_SAMPLE}건부터 숫자를 냅니다).`,
      );
    }
  }

  return ok(userId, parts.join('\n\n'));
}
