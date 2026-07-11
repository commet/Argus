/**
 * 캡처 게이트 (P3-1) — P0 스파이크 ④의 결정론 floor를 src로 졸업.
 *
 * 구조 계약 (스파이크에서 물려받아 여기서도 유지):
 *  - **fire-or-not 판정이 form보다 먼저다** (스파인 refinement (b)):
 *    가드(negation/question) → 선언형 → 유예형 → 침묵-기본. 침묵이 기본값이다.
 *  - **측정 대상 = 배송 대상**: spikes/p0/routing-skeleton.ts는 이 모듈의
 *    재수출이 되었다 — eval 하네스(routing-eval.test.ts, CI red)가 재는
 *    검출기와 서버가 배송하는 검출기가 같은 함수라서, 측정본과 배송본이
 *    드리프트할 방법이 없다.
 *  - **호출률 계측은 분모 포함**: runGate는 fired/silent 양쪽 모두
 *    gate_result 이벤트로 기록한다 (Release Matrix "Capture" 행: "게이트
 *    호출률 측정 존재" — fired만 기록하면 호출률의 분모가 없다).
 *    reason에는 발화 원문을 절대 넣지 않는다 — 매치된 것은 우리 말뭉치의
 *    패턴 문자열뿐이다 (규칙 19: transcript는 untrusted, 원장은 telemetry
 *    아님이지만 같은 위생을 적용).
 *
 * 키워드는 gate-keywords.ts(TS 데이터 모듈)가 단일 원천이다 — JSON이 아닌
 * 이유는 dist 포장(tsc)에 데이터가 자동 동반되게 하기 위해서고, 컴파일러가
 * 형태를 검사해 주는 덤이 있다. 패턴 추가는 그 파일에서만.
 */
import fs from 'node:fs';
import { ANCHOR_KEYWORDS, type AnchorKeywords } from './gate-keywords.js';
import { gateResultV2, type V2Context } from './bridge.js';

export type RouteKind = 'declarative' | 'deferred';
export type RouteVerdict =
  | { fire: true; kind: RouteKind; matched: string }
  | { fire: false; kind: null; matched: null; guard?: 'negation' | 'question' };

/** 스파이크 API 호환 — 키워드 말뭉치를 반환한다 (이제 TS 모듈이 원천). */
export function loadKeywords(): AnchorKeywords {
  return ANCHOR_KEYWORDS;
}

function anyMatch(text: string, sources: readonly string[], flags: string): string | null {
  for (const src of sources) {
    if (new RegExp(src, flags).test(text)) return src;
  }
  return null;
}

/** 발화 1건 → fire/silent. lang 무관하게 ko·en 패턴을 모두 적용한다 —
 *  실전 세션은 두 언어가 한 문장에 섞이기 때문(예: "queue는 SQLite로 가기로 했다").
 *
 *  한글 정규식 주의(스파이크에서 실제로 밟은 함정): JS의 \b는 \w=[A-Za-z0-9_]
 *  경계라 한글에는 절대 매치되지 않는다. 한글 패턴에 \b를 쓰면 조용히 죽은
 *  패턴이 된다 — 경계가 필요하면 (\s|$|[.,!]) 처럼 명시할 것. */
export function detect(text: string, kw: AnchorKeywords = ANCHOR_KEYWORDS): RouteVerdict {
  const t = text.trim();

  // 1. 가드 — 항상 키워드보다 먼저. ("선언형 키워드를 포함한 부정문"이 대표 함정)
  if (anyMatch(t, kw.ko.negation_guards, '') || anyMatch(t, kw.en.negation_guards, 'i')) {
    return { fire: false, kind: null, matched: null, guard: 'negation' };
  }
  if (/[?？]\s*$/.test(t)) {
    return { fire: false, kind: null, matched: null, guard: 'question' };
  }

  // 2. 선언형.
  const decl = anyMatch(t, kw.ko.declarative, '') ?? anyMatch(t, kw.en.declarative, 'i');
  if (decl) return { fire: true, kind: 'declarative', matched: decl };

  // 3. 유예형.
  const def = anyMatch(t, kw.ko.deferred, '') ?? anyMatch(t, kw.en.deferred, 'i');
  if (def) return { fire: true, kind: 'deferred', matched: def };

  // 4. 침묵-기본.
  return { fire: false, kind: null, matched: null };
}

export const GATE_NAME = 'capture_anchor_floor';

/** 판정 + 계측을 한 번에: 발화 1건을 판정하고, 결과를 fired/silent 무관하게
 *  gate_result로 원장에 기록한다. 판정은 순수 detect가 하고, 이 함수는
 *  "판정이 일어났다"는 사실의 기록 책임만 더한다 — 기록 실패는 던진다
 *  (게이트 호출률이 조용히 구멍나면 측정 존재 자체가 거짓이 된다). */
export function runGate(ctx: V2Context, text: string): RouteVerdict {
  const verdict = detect(text);
  const reason = verdict.fire
    ? `${verdict.kind}:${verdict.matched}`
    : verdict.guard ?? 'no_anchor';
  gateResultV2(ctx, { gate: GATE_NAME, fired: verdict.fire, reason: reason.slice(0, 400) });
  return verdict;
}

/** transcript JSONL에서 user 발화만 추출한다 (수확 처리 단계 소비용).
 *  미지 라인 타입·파손 줄은 건너뛴다 — "crash하지 않는다"가 계약이고,
 *  skipped/dropped 구분 계상은 원장 리더의 몫이지 transcript 리더의 몫이
 *  아니다 (transcript는 우리 데이터가 아니라 호스트의 데이터). */
export function userUtterances(jsonlPath: string): string[] {
  const out: string[] = [];
  for (const line of fs.readFileSync(jsonlPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let e: unknown;
    try { e = JSON.parse(line); } catch { continue; } // 파손 줄 → skip (crash 금지)
    const rec = e as { type?: string; message?: { role?: string; content?: unknown } };
    if (rec.type !== 'user') continue; // 미지 타입 포함 전부 skip
    if (typeof rec.message?.content === 'string') out.push(rec.message.content);
  }
  return out;
}
