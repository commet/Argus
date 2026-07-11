/**
 * P0 스파이크 ④ — 라우팅 검출기의 결정론 floor.
 *
 * 지위: 교체 부품. P3의 캡처 게이트(verified 신호 + 모델 계층)가 이 함수를
 * 통째로 대체한다. 영속하는 것은 이 파일이 아니라 (a) anchor-keywords.json /
 * routing-cases.json 말뭉치, (b) routing-eval.test.ts의 CI red 게이트 —
 * 새 검출기도 같은 잣대로 잰다.
 *
 * 판정 순서가 계약이다 (routing-eval.test.ts가 고정):
 *   1. 가드 먼저 — negation("~한 건 아니야") / question(끝이 '?')이
 *      키워드보다 항상 우선한다. "선언형 키워드를 포함한 부정문"이 이
 *      도메인의 대표 함정이라서다. (스펙 I-2 규칙의 "fire-or-not 게이트가
 *      form보다 먼저"와 같은 사상.)
 *   2. 선언형(declarative) — "~하기로 했다" 류. 캡처 후보.
 *   3. 유예형(deferred) — "보류/미루자" 류. 유예도 결정이다 — 캡처 후보.
 *   4. 아무것도 아니면 침묵. 침묵이 기본값이다 (BLUEPRINT §9.2-2).
 *
 * 한글 정규식 주의(여기서 실제로 밟은 함정): JS의 \b는 \w=[A-Za-z0-9_] 경계라
 * 한글에는 절대 매치되지 않는다. 한글 패턴에 \b를 쓰면 조용히 죽은 패턴이
 * 된다 — 경계가 필요하면 (\s|$|[.,!]) 처럼 명시할 것.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type RouteKind = 'declarative' | 'deferred';
export type RouteVerdict =
  | { fire: true; kind: RouteKind; matched: string }
  | { fire: false; kind: null; matched: null; guard?: 'negation' | 'question' };

interface KeywordSet {
  declarative: string[];
  deferred: string[];
  negation_guards: string[];
}
interface AnchorKeywords {
  version: number;
  ko: KeywordSet;
  en: KeywordSet;
}

const here = path.dirname(fileURLToPath(import.meta.url));

export function loadKeywords(): AnchorKeywords {
  return JSON.parse(
    fs.readFileSync(path.join(here, 'anchor-keywords.json'), 'utf8'),
  ) as AnchorKeywords;
}

function anyMatch(text: string, sources: string[], flags: string): string | null {
  for (const src of sources) {
    if (new RegExp(src, flags).test(text)) return src;
  }
  return null;
}

/** 발화 1건 → fire/silent. lang 무관하게 ko·en 패턴을 모두 적용한다 —
 *  실전 세션은 두 언어가 한 문장에 섞이기 때문(예: "queue는 SQLite로 가기로 했다"). */
export function detect(text: string, kw: AnchorKeywords = loadKeywords()): RouteVerdict {
  const t = text.trim();

  // 1. 가드 — 항상 키워드보다 먼저.
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

/** transcript JSONL에서 user 발화만 추출한다 (스파이크 ③ 픽스처 소비용).
 *  미지 라인 타입·파손 줄은 건너뛴다 — 정본 II-E의 skipped_unknown/dropped_corrupt
 *  구분은 P1의 원장 리더 몫이고, 여기서는 "crash하지 않는다"만 계약이다. */
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
