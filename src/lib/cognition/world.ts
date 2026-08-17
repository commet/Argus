import type { Crossing, ElementWorld, FrameElement, SignalReading } from './types';

/**
 * 두 세계의 경계 — 그리고 그 경계를 **자기선언으로 넘을 수 없게** 만드는 규칙.
 *
 * 창업자의 지시(2026-08-17): *"매트릭스 안에 갇혀 완벽한 세계인 것처럼 생각하는
 * 것도 아니고, 밖의 디스토피아에서 허우적거리기만 하는 것도 아니고, 두 세계를
 * 자유롭게 넘나드는 Neo."*
 *
 * 그 요구를 구조로 옮기면 세 가지다.
 *
 * 1. **어느 세계에 있는지 항상 안다.** 모든 원소가 `world` 를 갖는다.
 * 2. **건너는 데는 값이 있다.** `in_frame → reality_contact` 는 증거 없이는
 *    불가능하다. 그래서 `world` 는 저장된 의견이 아니라 **`crossings` 의
 *    함수**다 — 아래 `deriveWorld()` 가 유일한 권위이고, 프레임을 만들 때마다
 *    다시 계산해 저장값이 슬며시 어긋나는 것을 막는다.
 * 3. **어느 쪽도 열등하지 않다.** `in_frame` 은 대부분의 사고가 일어나는
 *    곳이고 일어나야 하는 곳이다. 이 모듈은 위치를 표시하지 **평가하지 않는다.**
 *
 * 근거: CLAUDE.md 가 이미 불변식으로 적어둔 문장 — *"프레임 안에서 모델과
 * 토론해 검증되는 결론은 없다. 검증은 단발의 커밋과 정산 시점의 현실뿐이다."*
 * 지금까지 그 불변식은 산문으로만 있었고, 산문은 화면을 물들이지 못한다.
 * 데이터에 없으면 UI는 두 세계를 같은 색으로 그린다.
 */

/** 증거가 실제로 증거인가. 빈 문자열·공백만은 증거가 아니다. */
export function isValidCrossing(c: Crossing): boolean {
  if (!c) return false;
  const ref = (c.evidence_ref || '').trim();
  const observed = (c.observed || '').trim();
  const at = (c.observed_at || '').trim();
  if (!ref || !observed || !at) return false;
  // ISO 8601 로 파싱되지 않는 시각은 빈티지가 될 수 없다 (P1: 당시 정보 상태로만
  // 평가 가능해야 하는데, 시각이 없으면 '당시'가 정의되지 않는다).
  if (Number.isNaN(Date.parse(at))) return false;
  // 철회된 증거는 세계 판정에서 빠진다. **행은 남지만 힘은 없다.**
  // 사유 없는 철회는 철회로 세지 않는다 — 사후 조작과 구분되지 않기 때문이다.
  if (c.retracted_at && (c.retraction_reason || '').trim()) return false;
  return true;
}

/**
 * 증거를 철회한다. 행을 지우지 않고 표시만 한다 (P1 빈티지 보존).
 *
 * 사유가 비면 철회하지 않는다 — 사유 없이 증거를 무력화할 수 있으면 불편한
 * 관측을 조용히 없앨 수 있고, 그것이 이 설계가 막으려는 실패다.
 */
export function retractCrossing(c: Crossing, at: string, reason: string): Crossing {
  const r = (reason || '').trim();
  if (!r || !at) return c;
  return { ...c, retracted_at: at, retraction_reason: r };
}

/**
 * 세계 궤적 — 원소가 두 세계를 **어떻게 오갔나.**
 *
 * 창업자의 요구("두 세계를 자유롭게 넘나드는 Neo")를 데이터로 옮기면 이것이
 * 남는다. 한 방향 승격만 있으면 그건 넘나듦이 아니라 다른 감옥이다.
 * 건넘과 철회를 시간순으로 재생해 세계가 바뀐 지점만 남긴다.
 */
export interface WorldTransition {
  at: string;
  to: ElementWorld;
  /** 이 전이를 일으킨 사건. */
  cause: 'crossing' | 'retraction';
  evidence_ref: string;
  detail: string;
}

export function worldTrajectory(crossings: readonly Crossing[]): WorldTransition[] {
  // 건넘(관찰 시각)과 철회(철회 시각)를 하나의 사건 열로 합쳐 시간순 재생.
  type Ev = { at: string; kind: 'crossing' | 'retraction'; c: Crossing };
  const events: Ev[] = [];
  for (const c of crossings ?? []) {
    if (!c) continue;
    const at = (c.observed_at || '').trim();
    if (at && !Number.isNaN(Date.parse(at))) events.push({ at, kind: 'crossing', c });
    const rt = (c.retracted_at || '').trim();
    if (rt && !Number.isNaN(Date.parse(rt)) && (c.retraction_reason || '').trim()) {
      events.push({ at: rt, kind: 'retraction', c });
    }
  }
  events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.kind.localeCompare(b.kind));

  const out: WorldTransition[] = [];
  const live = new Set<string>();
  let world: ElementWorld = 'in_frame';

  for (const ev of events) {
    const key = `${ev.c.evidence_ref}@${ev.c.observed_at}`;
    if (ev.kind === 'crossing') {
      // 철회 시각이 이 건넘보다 앞이면 애초에 살아 있던 적이 없다.
      live.add(key);
    } else {
      live.delete(key);
    }
    const next: ElementWorld = live.size > 0 ? 'reality_contact' : 'in_frame';
    if (next !== world) {
      world = next;
      out.push({
        at: ev.at,
        to: next,
        cause: ev.kind,
        evidence_ref: ev.c.evidence_ref,
        detail:
          ev.kind === 'crossing'
            ? ev.c.observed
            : `증거 철회: ${ev.c.retraction_reason ?? ''}`,
      });
    }
  }
  return out;
}

/**
 * 세계는 파생값이다. **이 함수가 유일한 권위다.**
 *
 * 유효한 건넘이 하나라도 있으면 `reality_contact`, 없으면 `in_frame`.
 * "곧 확인할 것이다"·"아마 맞을 것이다"는 건넘이 아니다.
 */
export function deriveWorld(crossings: readonly Crossing[]): ElementWorld {
  const valid = (crossings ?? []).filter(isValidCrossing);
  return valid.length > 0 ? 'reality_contact' : 'in_frame';
}

/**
 * 원소의 `world` 를 증거와 일치시킨다. 저장된 값이 증거와 다르면 **증거를
 * 믿는다** — 반대로 하면 낙관적 오기입이 사실을 이긴다.
 */
export function reconcileWorld(el: FrameElement): FrameElement {
  const world = deriveWorld(el.crossings ?? []);
  return world === el.world ? el : { ...el, world };
}

/** 증거 없는 건넘을 주장하는 원소들 — 봉인을 막는 사유가 된다. */
export function elementsClaimingUnevidencedCrossing(elements: readonly FrameElement[]): FrameElement[] {
  return (elements ?? []).filter(
    (el) => el.world === 'reality_contact' && deriveWorld(el.crossings ?? []) === 'in_frame',
  );
}

export interface WorldBalance {
  in_frame: number;
  reality_contact: number;
  /** 전체 원소 수. 비율은 화면에서 만들되 분모를 숨기지 않는다. */
  total: number;
  /** 현실에 닿은 원소들의 id — 모든 주장에 증거 id를 동봉한다. */
  reality_contact_ids: string[];
}

/**
 * 이 프레임이 어느 세계에 얼마나 걸쳐 있나.
 *
 * **점수가 아니다.** "6개는 프레임 안, 1개는 현실에 닿았다"는 위치 진술이고,
 * 그것이 좋은지 나쁜지는 판단의 종류에 달렸다 (아직 실행 전인 계획은 당연히
 * 대부분 프레임 안에 있다). 화면은 이 숫자로 등급을 만들지 않는다.
 */
export function worldBalance(elements: readonly FrameElement[]): WorldBalance {
  const list = (elements ?? []).map(reconcileWorld);
  const contact = list.filter((el) => el.world === 'reality_contact');
  return {
    in_frame: list.length - contact.length,
    reality_contact: contact.length,
    total: list.length,
    reality_contact_ids: contact.map((el) => el.id),
  };
}

/**
 * 신호 판독을 건넘 증거로 승격한다.
 *
 * `unread` 는 승격되지 않는다 — **읽지 못한 것은 현실 접촉이 아니다.** 이것이
 * 이 모듈에서 가장 중요한 한 줄이다. B 실험에서 실제로 겪었듯, 판독 실패를
 * 조용히 "이상 없음"으로 처리하면 센서가 켜져 있다는 사실 자체가 거짓 안심이
 * 된다 (P5 시끄러운 실패).
 */
export function readingToCrossing(r: SignalReading): Crossing | null {
  if (!r || r.verdict === 'unread' || r.value === null) return null;
  return {
    kind: 'signal_reading',
    evidence_ref: `${r.binding_kind}:${r.target}@${r.observed_at}`,
    observed_at: r.observed_at,
    observed: `${r.target} = ${r.value} (${r.verdict})`,
  };
}
