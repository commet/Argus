import type { CognitiveFrame } from './types';

/**
 * M5 귀속 비대칭 — **이 파일이 이 저장소에서 가장 선에 가깝다.** 규율을 앞에 둔다.
 *
 * ── 무엇을 재는가 ────────────────────────────────────────────────────
 *
 * Miller-Ross(1975) 자기 위주 귀인: 성공은 자기 판단으로, 실패는 운으로
 * 귀속된다. 이것이 3층(판정자 오염)의 핵심 기제 중 하나이고, 브리프 §1.3의
 * M5 다. E-0에서는 성공/실패 쌍의 표본이 없어 **미측정**이었다.
 *
 * ── 왜 위험한가, 그리고 어디에 선을 긋는가 ──────────────────────────
 *
 * "당신은 자기 위주 귀인 성향이 있습니다"는 **정체성 판정**이고 이 제품에
 * 존재할 수 없다 (CLAUDE.md Zero-Judgment 게이트). 그런데 M5는 본질적으로
 * 사람의 패턴에 대한 것이므로, 잘못 만들면 정확히 그 금지된 문장이 된다.
 *
 * 선은 여기다:
 *
 *   금지  "당신은 실패를 운으로 돌리는 경향이 있습니다"        ← 성향 판정
 *   허용  "성공 4건은 판단으로, 실패 3건은 운으로 귀속됐습니다" ← 기록의 분포
 *
 * 차이는 수사가 아니다. 앞의 문장은 **사람에 대한 주장**이고 반증할 수 없다.
 * 뒤의 문장은 **기록에 대한 사실**이고 사례 id로 되짚어 반박할 수 있다.
 * 그 사실이 무엇을 뜻하는지는 사용자가 해석한다 (P8: 채택의 주체는 사람).
 *
 * TWIN 수정조항의 조건 셋을 그대로 따른다:
 *   1. 표본 임계 미달이면 숫자 대신 "아직 모릅니다"
 *   2. 증거(사례 id) 동반
 *   3. 채점 대상이 **기록**임을 문장에서 밝힌다
 *
 * 그리고 하나 더 — **귀속은 사용자가 직접 고른다.** 기계가 정산 문장을 읽고
 * "이건 운으로 돌린 것 같다"고 분류하면 그 순간 이 지표가 오염된다
 * (Nisbett-Wilson: 자기보고도 못 믿는데, 타자의 해석은 더하다).
 */

/** 정산 시점에 사용자가 스스로 고르는 귀속. 기계가 추론하지 않는다. */
export type OutcomeAttribution =
  /** 내 판단이 맞았다/틀렸다 — 결과의 원인을 자기 판단에 둔다. */
  | 'judgment'
  /** 외부 요인·운이 갈랐다 — 결과의 원인을 자기 밖에 둔다. */
  | 'luck'
  /** 둘 다 — 정직한 선택지이므로 지운다면 데이터가 왜곡된다. */
  | 'both'
  /** 모르겠다 — 이것도 남긴다. 강제 선택은 응답을 만들어낸다. */
  | 'unclear';

export interface AttributedSettlement {
  frame_id: string;
  /** 예측이 맞았나 (falsifier 가 관찰되지 않았으면 맞음). */
  succeeded: boolean;
  attribution: OutcomeAttribution;
  /** 되짚을 근거. */
  evidence_ref: string;
  observed_at: string;
}

/**
 * 표본 임계. 성공·실패 **양쪽에** 최소 이만큼 있어야 비대칭을 말할 수 있다.
 * 한쪽만 있으면 비교 대상이 없으므로 숫자를 내는 것이 무의미하다.
 *
 * 3을 고른 근거: 2는 한 건이 뒤집으면 방향이 바뀌고, 5는 이 제품의 실제
 * 정산 빈도(월 2~4회)에서 반 년이 걸린다. **근거가 강해서 3이 아니라, 3이라고
 * 미리 말해두면 나중에 사후 조정이 드러나기 때문에 3이다.**
 */
export const MIN_PER_SIDE = 3;

export type M5Reading =
  | {
      state: 'unknown';
      reason: string;
      success_sample: number;
      failure_sample: number;
      min_per_side: number;
      case_refs: string[];
    }
  | {
      state: 'measured';
      success_sample: number;
      failure_sample: number;
      min_per_side: number;
      /** 성공 건 중 '내 판단'으로 귀속된 비율. */
      success_judgment_ratio: number;
      /** 실패 건 중 '내 판단'으로 귀속된 비율. */
      failure_judgment_ratio: number;
      /**
       * 비대칭 = 성공의 판단 귀속률 − 실패의 판단 귀속률.
       * 양수면 성공을 판단으로, 실패를 운으로 돌린 쪽. **부호가 좋고 나쁨을
       * 뜻하지 않는다** — 방향을 가리키는 숫자다.
       */
      asymmetry: number;
      case_refs: string[];
      /** 채점 대상이 기록임을 밝히는 문장 (TWIN 조건 3). */
      subject_sentence: string;
      /** 사실 진술 — 성향 어휘 없음. */
      statement: string;
    };

/**
 * 정산에서 귀속을 뽑는다.
 *
 * `attribution` 이 없는 정산은 **제외한다.** 기본값을 끼워넣으면 (예: 없으면
 * 'judgment') 그 기본값이 지표를 만들어낸다.
 */
export function attributedSettlements(
  frames: readonly CognitiveFrame[],
  attributions: ReadonlyMap<string, OutcomeAttribution>,
): AttributedSettlement[] {
  const out: AttributedSettlement[] = [];
  for (const f of frames ?? []) {
    if (f?.status !== 'settled' || !f.settlement) continue;
    const attribution = attributions.get(f.id);
    if (!attribution) continue;
    out.push({
      frame_id: f.id,
      succeeded: !f.settlement.falsifier_observed,
      attribution,
      evidence_ref: f.settlement.evidence_ref || `frame:${f.id}`,
      observed_at: f.settlement.observed_at,
    });
  }
  return out;
}

const r4 = (x: number): number => Math.round(x * 10_000) / 10_000;

/**
 * M5 판독.
 *
 * `both`·`unclear` 는 분모에 들어가고 분자에는 안 들어간다 — 지우면 응답
 * 분포가 왜곡되고, 분자에 넣으면 애매함을 확신으로 바꾼다.
 */
export function measureM5(settlements: readonly AttributedSettlement[]): M5Reading {
  const list = settlements ?? [];
  const wins = list.filter((s) => s.succeeded);
  const losses = list.filter((s) => !s.succeeded);
  const case_refs = list.map((s) => s.evidence_ref);

  if (wins.length < MIN_PER_SIDE || losses.length < MIN_PER_SIDE) {
    return {
      state: 'unknown',
      reason:
        `성공 ${wins.length}건 · 실패 ${losses.length}건입니다 (양쪽 각 ${MIN_PER_SIDE}건 필요). ` +
        '비교 대상이 한쪽밖에 없으면 비대칭이라는 말이 성립하지 않습니다 — 아직 모릅니다.',
      success_sample: wins.length,
      failure_sample: losses.length,
      min_per_side: MIN_PER_SIDE,
      case_refs,
    };
  }

  const judgmentRatio = (arr: readonly AttributedSettlement[]) =>
    r4(arr.filter((s) => s.attribution === 'judgment').length / arr.length);

  const sJ = judgmentRatio(wins);
  const fJ = judgmentRatio(losses);
  const asymmetry = r4(sJ - fJ);

  return {
    state: 'measured',
    success_sample: wins.length,
    failure_sample: losses.length,
    min_per_side: MIN_PER_SIDE,
    success_judgment_ratio: sJ,
    failure_judgment_ratio: fJ,
    asymmetry,
    case_refs,
    subject_sentence:
      '아래는 **당신이 남긴 정산 기록의 귀속 분포**입니다 — 당신이 어떤 사람인지에 대한 판정이 아닙니다.',
    statement:
      `맞은 판단 ${wins.length}건 중 ${Math.round(sJ * 100)}%가 '내 판단' 으로, ` +
      `틀린 판단 ${losses.length}건 중 ${Math.round(fJ * 100)}%가 '내 판단' 으로 귀속됐습니다. ` +
      `차이 ${asymmetry >= 0 ? '+' : ''}${Math.round(asymmetry * 100)}%p. ` +
      '이 차이가 무엇을 뜻하는지는 당신이 해석합니다.',
  };
}

/**
 * 귀속을 **정산 전에** 사전등록할 때 쓰는 술어.
 *
 * 왜 필요한가: 결과를 본 뒤에 귀속을 고르면 그 선택 자체가 사후 합리화의
 * 산물이다 (Fischhoff: 사후확신은 경고로 줄지 않는다). 봉인 시점에 "이 판단이
 * 맞으면/틀리면 각각 무엇 때문일 것인가"를 미리 적어두면, 정산에서 그 사전
 * 등록과 사후 귀속을 **나란히** 볼 수 있다.
 *
 * 이것이 M5를 단순 관찰에서 **개입**으로 바꾸는 자리다 — 그리고 개입은
 * 강제가 아니다. 사전등록이 없으면 사후 귀속만 기록되고, 그 사실이 남는다.
 */
export interface PreregisteredAttribution {
  frame_id: string;
  /** 맞았을 때 무엇 때문일 것인가. */
  if_right: OutcomeAttribution;
  /** 틀렸을 때 무엇 때문일 것인가. */
  if_wrong: OutcomeAttribution;
  registered_at: string;
}

export interface AttributionDrift {
  frame_id: string;
  succeeded: boolean;
  /** 봉인 시점에 미리 적어둔 귀속. */
  preregistered: OutcomeAttribution;
  /** 정산 시점에 고른 귀속. */
  actual: OutcomeAttribution;
  /** 둘이 달라졌나. */
  drifted: boolean;
  evidence_ref: string;
}

/**
 * 사전등록과 사후 귀속을 대조한다. **어느 쪽이 옳다고 말하지 않는다** —
 * 생각이 바뀔 수 있고 그것이 잘못은 아니다. 다만 바뀌었다는 사실은 남는다.
 */
export function attributionDrift(
  settlements: readonly AttributedSettlement[],
  prereg: readonly PreregisteredAttribution[],
): AttributionDrift[] {
  const byFrame = new Map(prereg.map((p) => [p.frame_id, p]));
  const out: AttributionDrift[] = [];
  for (const s of settlements ?? []) {
    const p = byFrame.get(s.frame_id);
    if (!p) continue;
    const expected = s.succeeded ? p.if_right : p.if_wrong;
    out.push({
      frame_id: s.frame_id,
      succeeded: s.succeeded,
      preregistered: expected,
      actual: s.attribution,
      drifted: expected !== s.attribution,
      evidence_ref: s.evidence_ref,
    });
  }
  return out;
}
