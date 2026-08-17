import type { CognitiveFrame, FrameElement, SignalReading } from './types';
import { isKnownAxis, type AxisId } from './axes';
import { reconcileWorld } from './world';

/**
 * 인지 프레임의 행 ↔ 객체 변환. **여기에 판정 로직을 두지 않는다** —
 * 판정은 전부 순수 엔진(`frame.ts`·`world.ts`·`comprehension.ts`)의 몫이고,
 * 이 파일은 모양만 바꾼다.
 *
 * 왜 굳이 나누나: 지속 계층에 판정이 섞이면 그 판정은 테스트가 닿기 어려운
 * 곳으로 숨는다. 이 저장소가 이미 한 번 겪은 실수다 — 저자성 판정이
 * `SealMoment` 컴포넌트 안에 있던 시절 순수 테스트가 못 읽었다
 * (`judgment-authorship.ts` 상단 주석).
 *
 * 방어적 읽기 (CLAUDE.md Defensive Data Access): Supabase 병합은 모양이
 * 다르고 옛 행에는 새 필드가 없다. 모든 접근이 옵셔널 + fallback 이다.
 * 단 **fallback 이 사실을 왜곡하면 안 된다** — 예컨대 `revision_distance` 의
 * fallback 은 1(=완전히 다른 문장)이다. 0으로 두면 "손대지 않았다"는 정반대
 * 사실이 조용히 기록된다.
 */

/** DB 행 → 원소. 알 수 없는 축은 **버리지 않고** 호출자에게 알린다. */
export function rowToElement(row: Record<string, unknown>): FrameElement | null {
  const axis = String(row?.axis ?? '');
  if (!isKnownAxis(axis)) return null;

  const crossings = Array.isArray(row?.crossings) ? (row.crossings as FrameElement['crossings']) : [];
  const el: FrameElement = {
    id: String(row?.id ?? ''),
    axis: axis as AxisId,
    text: String(row?.body ?? ''),
    authorship: {
      authored: (row?.authored as 'user' | 'ai_surfaced') ?? 'user',
      wording_source: (row?.wording_source as FrameElement['authorship']['wording_source']) ?? 'legacy_unknown',
      // fallback 1 = "초안이 없었거나 완전히 다른 문장". 0을 쓰면 거짓 안심이 된다.
      revision_distance: Number(row?.revision_distance ?? 1),
      revision_rounds: Number(row?.revision_rounds ?? 0),
      recorded_at: String(row?.created_at ?? ''),
    },
    world: (row?.world as FrameElement['world']) ?? 'in_frame',
    crossings,
    comprehension: {
      state: (row?.comprehension_state as FrameElement['comprehension']['state']) ?? 'not_required',
      restatement: String(row?.comprehension_restatement ?? ''),
      overlap: Number(row?.comprehension_overlap ?? 0),
      echo_threshold: Number(row?.comprehension_echo_threshold ?? 0.6),
    },
    bindings: Array.isArray(row?.bindings) ? (row.bindings as FrameElement['bindings']) : [],
    supersedes: (row?.supersedes as string | null) ?? null,
    created_at: String(row?.created_at ?? ''),
  };
  // 저장된 world 가 증거와 어긋나면 증거를 믿는다 (world.ts의 규칙).
  return reconcileWorld(el);
}

export function rowToReading(row: Record<string, unknown>): SignalReading {
  return {
    binding_kind: String(row?.binding_kind ?? ''),
    target: String(row?.target ?? ''),
    value: row?.value === null || row?.value === undefined ? null : String(row.value),
    unread_reason: row?.unread_reason ? String(row.unread_reason) : undefined,
    verdict: (row?.verdict as SignalReading['verdict']) ?? 'unread',
    observed_at: String(row?.observed_at ?? ''),
  };
}

export function rowsToFrame(input: {
  frame: Record<string, unknown>;
  elements: Array<Record<string, unknown>>;
  readings: Array<Record<string, unknown>>;
}): CognitiveFrame {
  const f = input.frame ?? {};
  const confidenceValue = f?.confidence_value;
  return {
    id: String(f?.id ?? ''),
    user_id: (f?.user_id as string | null) ?? null,
    title: String(f?.title ?? ''),
    status: (f?.status as CognitiveFrame['status']) ?? 'drafting',
    elements: (input.elements ?? []).map(rowToElement).filter((e): e is FrameElement => e !== null),
    confidence:
      confidenceValue === null || confidenceValue === undefined
        ? null
        : {
            value: Number(confidenceValue),
            about_element_id: String(f?.confidence_about_element_id ?? ''),
            // 미지정을 `true` 로 두면 판정 불가능한 문장이 채점 분모에 들어간다.
            // 모르면 채점하지 않는 쪽이 정직하다.
            resolvable: f?.confidence_resolvable === true,
            resolvable_reason: String(f?.confidence_resolvable_reason ?? ''),
          },
    settlement:
      f?.settled_observed_at
        ? {
            falsifier_observed: f?.settled_falsifier_observed === true,
            observed: String(f?.settled_observed ?? ''),
            evidence_ref: String(f?.settled_evidence_ref ?? ''),
            observed_at: String(f.settled_observed_at),
            retrospective: String(f?.settled_retrospective ?? ''),
          }
        : null,
    readings: (input.readings ?? []).map(rowToReading),
    sealed_at: (f?.sealed_at as string | null) ?? null,
    created_at: String(f?.created_at ?? ''),
    updated_at: String(f?.updated_at ?? ''),
  };
}

/** 프레임 → 행 (upsert 용). `elements`·`readings` 는 별도 테이블이므로 빠진다. */
export function frameToRow(frame: CognitiveFrame): Record<string, unknown> {
  return {
    id: frame.id,
    user_id: frame.user_id,
    title: frame.title,
    status: frame.status,
    confidence_value: frame.confidence?.value ?? null,
    confidence_about_element_id: frame.confidence?.about_element_id ?? null,
    confidence_resolvable: frame.confidence?.resolvable ?? null,
    confidence_resolvable_reason: frame.confidence?.resolvable_reason ?? null,
    settled_falsifier_observed: frame.settlement?.falsifier_observed ?? null,
    settled_observed: frame.settlement?.observed ?? null,
    settled_evidence_ref: frame.settlement?.evidence_ref ?? null,
    settled_observed_at: frame.settlement?.observed_at ?? null,
    settled_retrospective: frame.settlement?.retrospective ?? null,
    sealed_at: frame.sealed_at,
  };
}

/** 원소 → 행. 컬럼명이 `body` 인 이유: `text` 는 Postgres 타입명과 겹쳐 읽기 어렵다. */
export function elementToRow(el: FrameElement, frameId: string, userId: string | null): Record<string, unknown> {
  return {
    id: el.id,
    frame_id: frameId,
    user_id: userId,
    axis: el.axis,
    body: el.text,
    authored: el.authorship.authored,
    wording_source: el.authorship.wording_source,
    revision_distance: el.authorship.revision_distance,
    revision_rounds: el.authorship.revision_rounds,
    world: el.world,
    crossings: el.crossings,
    comprehension_state: el.comprehension.state,
    comprehension_restatement: el.comprehension.restatement,
    comprehension_overlap: el.comprehension.overlap,
    comprehension_echo_threshold: el.comprehension.echo_threshold,
    bindings: el.bindings,
    supersedes: el.supersedes,
  };
}

export function readingToRow(r: SignalReading, frameId: string, userId: string | null): Record<string, unknown> {
  return {
    frame_id: frameId,
    user_id: userId,
    binding_kind: r.binding_kind,
    target: r.target,
    value: r.value,
    unread_reason: r.unread_reason ?? null,
    verdict: r.verdict,
    observed_at: r.observed_at,
  };
}
