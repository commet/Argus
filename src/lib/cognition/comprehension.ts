import type { Comprehension } from './types';
import { axisSpec, type AxisId } from './axes';
import type { Authorship } from './types';

/**
 * 이해 재진술 게이트 — 이 프로젝트가 문헌에 **보태는** 한 가지.
 *
 * ── 왜 (E-0 2026-08-16 실측) ─────────────────────────────────────────
 *
 * 이 저장소의 창업자 대화 92턴에서:
 *   · 새로 생긴 하중 개념구 **11/11이 AI 최초 발화**
 *   · AI가 만든 이름으로만 구성된 지시 5건, 명명→명령 최단 **5분**
 *   · **같은 92턴에 이해 거부가 12건** ("이게 뭔 말이야", "너가 너맘대로 써서")
 *
 * 두 사실이 동시에 참이다. 정확한 서술은 "저자성이 넘어갔다"가 아니라
 * **"어휘와 의제는 넘어가고 이해는 넘어가지 않는다"** 다.
 *
 * 그리고 이것이 왜 새로운 문제인가: **출처 태깅은 이 실패를 막지 못한다.**
 * "이 문장은 AI가 만들었습니다"라고 붙여놔도 사람은 그 말로 지시를 계속
 * 내린다. 이 저장소는 이미 provenance 를 151개 파일에서 다루는데도 실측값이
 * 저랬다. 방어해야 하는 것은 출처 표시가 아니라 **이해**다.
 *
 * ── 어떻게 (판정하지 않으면서) ───────────────────────────────────────
 *
 * 퀴즈를 내면 사용자를 채점하는 것이고 그것은 Zero-Judgment 게이트 위반이다.
 * 대신 **재진술 슬롯**을 둔다: "이 문장을 당신 말로 다시 써 보세요."
 *
 * 기계가 하는 일은 딱 하나 — 재진술이 원문의 어휘를 되풀이한 것인지
 * **결정론적으로** 센다 (LLM 없이, 내용어 겹침 비율). 그리고 그 결과를
 * *기록의 상태*로 적는다:
 *
 *   own_words  자기 어휘로 다시 말했다
 *   echo       다시 말했지만 원문 어휘를 되풀이했다
 *   absent     아직 다시 말하지 않았다
 *
 * **이 셋 중 어느 것도 사람에 대한 평가가 아니다.** "당신은 이해가 부족합니다"
 * 라고 말하지 않는다. "이 칸은 아직 당신 말이 아닙니다"라고 말한다. 판정
 * 대상은 사람이 아니라 **기록**이다 (P4 굿하트 내성).
 *
 * 탈출구는 남긴다 (CLAUDE.md 저자성 조항: 마찰 탈출구를 전부 없애면 가장 지친
 * 사용자가 이탈해 소유권이 0이 된다). 게이트는 **하중 축에만** 걸리고,
 * `acceptAsIs()` 로 명시적으로 넘어갈 수 있다 — 다만 그 사실이 기록에 남는다.
 */

/**
 * 되풀이 판정 임계. **검증 불가능한 사전 믿음이므로 상수로 숨기지 않고
 * 모든 판정 결과에 동봉한다** (P6 잔여의 공시, 그리고 문헌 상충 1의 교훈:
 * 모든 탐지기의 임계는 데이터에서 도출되지 않는다).
 *
 * 0.6 을 고른 근거: 한국어 재진술은 조사·어미가 달라도 내용어를 상당히
 * 공유하므로 0.5 는 너무 엄하고, 0.8 은 문장을 거의 복사해도 통과한다.
 * **이 숫자는 관측으로 조정될 수 있으며, 조정하면 원장에 남긴다** — 사후에
 * 조여서 지표를 좋게 만드는 것이 Goodhart 그 자체다.
 */
export const ECHO_THRESHOLD = 0.6;

/** 겹침 계산에서 빼는 기능어. 조사·어미·접속사는 이해의 증거가 아니다. */
const STOPWORDS = new Set([
  '그리고', '그래서', '하지만', '그러나', '또는', '즉', '것', '수', '등', '및',
  '이것', '그것', '저것', '여기', '거기', '때문', '위해', '대해', '통해', '따라',
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'for', 'is', 'are',
  'this', 'that', 'it', 'be', 'as', 'with', 'by', 'from',
]);

const TOKEN = /[가-힣A-Za-z0-9]+/g;

/**
 * 내용어 집합으로 쪼갠다.
 *
 * 한국어는 교착어라 어절에 조사가 붙는다("전제가", "전제를"). 어절 그대로
 * 비교하면 같은 낱말을 다른 낱말로 센다. 그래서 **2글자 이상 한글 어절은
 * 앞 2글자를 어간 대용으로 삼는다.** 완벽한 형태소 분석이 아니지만,
 * 형태소 분석기를 넣으면 결정론과 무의존성을 잃는다 — 이 판정은 CI에서
 * 같은 답을 내야 하므로 정확도보다 재현성을 택했다. (이 근사가 이 파일의
 * 알려진 한계이며, 그래서 `overlap` 원값을 항상 함께 노출한다.)
 */
function contentTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of (text || '').toLowerCase().match(TOKEN) ?? []) {
    if (raw.length < 2) continue;
    if (STOPWORDS.has(raw)) continue;
    const isHangul = /^[가-힣]+$/.test(raw);
    out.add(isHangul && raw.length > 2 ? raw.slice(0, 2) : raw);
  }
  return out;
}

/**
 * 재진술이 원문 어휘를 얼마나 되풀이하는가 (0~1).
 *
 * 분모는 **재진술의 내용어 수**다. 원문 기준으로 나누면 짧게 답한 사용자가
 * 자동으로 통과해버린다("응"으로 원문 어휘 0% → own_words). 재진술 기준으로
 * 나누면 "내가 쓴 낱말 중 몇 개가 원문에서 왔나"가 되어 의도한 질문이 된다.
 */
export function echoOverlap(sourceText: string, restatement: string): number {
  const src = contentTokens(sourceText);
  const re = contentTokens(restatement);
  if (re.size === 0) return 0;
  let shared = 0;
  for (const t of re) if (src.has(t)) shared += 1;
  return Math.round((shared / re.size) * 10_000) / 10_000;
}

/**
 * 이 원소에 이해 게이트가 걸리는가.
 *
 * 두 조건이 **모두** 참일 때만 걸린다:
 *   1. 하중 축이다 (모든 축에 걸면 마찰이 채택을 죽인다 — 문헌 상충 5)
 *   2. 문장이 기계 발원이다 (사람이 직접 쓴 문장에 재진술을 요구하는 것은
 *      무의미하고 모욕적이다)
 */
export function gateApplies(axis: AxisId, authorship: Authorship): boolean {
  if (!axisSpec(axis).loadBearing) return false;
  return authorship.wording_source === 'ai_surfaced';
}

/** 게이트가 걸리지 않는 원소의 기본 상태. */
export function comprehensionNotRequired(): Comprehension {
  return { state: 'not_required', restatement: '', overlap: 0, echo_threshold: ECHO_THRESHOLD };
}

/**
 * 재진술을 평가한다. **사람이 아니라 기록의 상태를 낸다.**
 */
export function evaluateRestatement(input: {
  axis: AxisId;
  authorship: Authorship;
  sourceText: string;
  restatement: string;
}): Comprehension {
  if (!gateApplies(input.axis, input.authorship)) return comprehensionNotRequired();

  const restatement = (input.restatement || '').trim();
  if (!restatement) {
    return { state: 'absent', restatement: '', overlap: 0, echo_threshold: ECHO_THRESHOLD };
  }

  const overlap = echoOverlap(input.sourceText, restatement);
  return {
    state: overlap >= ECHO_THRESHOLD ? 'echo' : 'own_words',
    restatement,
    overlap,
    echo_threshold: ECHO_THRESHOLD,
  };
}

/**
 * 명시적 탈출구 — "그대로 쓰겠다".
 *
 * 게이트를 없애는 것이 아니라 **넘어간 사실을 기록에 남긴다.** 재진술을
 * 강제하면 가장 지친 사용자가 이탈하고, 이탈하면 소유권이 0이 된다.
 * `echo` 로 적는 이유: 사용자가 원문을 그대로 채택했다는 것이 정확한 사실이고,
 * `own_words` 로 적으면 그것이 세탁이다.
 */
export function acceptAsIs(sourceText: string): Comprehension {
  return {
    state: 'echo',
    restatement: sourceText,
    overlap: 1,
    echo_threshold: ECHO_THRESHOLD,
  };
}
