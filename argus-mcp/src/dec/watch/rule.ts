import { anyGlobMatches } from './glob.js';

/**
 * 어긋난 걸 아는 방법 — 조항 하나를 기계가 볼 수 있는 모양으로.
 *
 * 두 채널만 쓴다: **어떤 파일에 손댔나** 와 **무슨 말이 오갔나**.
 * (기획서 §4.3 의 3채널 중 도구 호출과 git diff 는 둘 다 "어떤 파일"로
 * 들어오므로 여기서는 한 채널이다.)
 *
 * 규율 셋:
 *  1. **정규식을 안 쓴다.** 말은 문자열 그대로 찾는다. 모델이 만든 정규식은
 *     사람이 못 읽고, 못 읽는 규칙은 고칠 수도 서명할 수도 없다.
 *  2. **못 잡는 것을 반드시 적는다.** 빈 `blind_spots` 는 "다 잡는다"는
 *     거짓말이다. 비어 있으면 규칙으로 받지 않는다.
 *  3. **`inject_only` 는 절대 안 걸린다.** 기계가 못 잡는다고 적어 놓고
 *     걸리는 시늉을 하면 그게 제일 나쁜 거짓말이다.
 */

export interface WatchRule {
  /** 이 자리를 건드리면 걸린다. */
  paths: string[];
  /** 이 말이 나오면 걸린다. 문자열 그대로 찾는다. */
  phrases: string[];
  /** 이 자리는 봐준다 (문서·픽스처 같은 것). */
  except_paths: string[];
  /** 이 말이 같이 있으면 봐준다 (인용·예시 같은 것). */
  except_phrases: string[];
  /** 기계가 못 잡는 것 — 사람이 읽는 문장. **비어 있을 수 없다.** */
  blind_spots: string[];
  mode: 'machine' | 'inject_only';
}

export type WatchEvent =
  | { kind: 'file_change'; path: string }
  | { kind: 'utterance'; text: string };

export type WatchVerdict =
  | { fire: true; channel: 'file' | 'word'; matched: string }
  | { fire: false; reason: 'inject_only' | 'no_match' | 'excepted'; excepted_by?: string };

/** 말 비교는 대소문자·연속 공백을 무시한다. 그 이상은 안 한다 — 사람이 예측할 수 있어야 한다. */
const norm = (text: string): string => text.toLowerCase().replace(/\s+/g, ' ');

export function matchWatch(rule: WatchRule, event: WatchEvent): WatchVerdict {
  if (rule.mode === 'inject_only') return { fire: false, reason: 'inject_only' };

  if (event.kind === 'file_change') {
    const hit = anyGlobMatches(rule.paths, event.path);
    if (!hit) return { fire: false, reason: 'no_match' };
    const spared = anyGlobMatches(rule.except_paths, event.path);
    if (spared) return { fire: false, reason: 'excepted', excepted_by: spared };
    return { fire: true, channel: 'file', matched: hit };
  }

  const text = norm(event.text);
  const hit = rule.phrases.find((phrase) => text.includes(norm(phrase)));
  if (!hit) return { fire: false, reason: 'no_match' };
  const spared = rule.except_phrases.find((phrase) => text.includes(norm(phrase)));
  if (spared) return { fire: false, reason: 'excepted', excepted_by: spared };
  return { fire: true, channel: 'word', matched: hit };
}

/**
 * 이 말로 규칙을 걸 수 있나.
 *
 * 실주행에서 `user` 라는 낱말 하나가 말 채널에 들어가 30일 동안 57번
 * "걸렸다" (2026-08-21). 규칙이 겨냥한 것과 아무 상관 없는 곳이었다.
 * 짧고 흔한 한 낱말은 규칙이 아니라 잡음이다. 셋 중 하나는 돼야 한다:
 *  - 낱말이 둘 이상이거나
 *  - 한 낱말이면 여섯 글자 이상이거나
 *  - 글자 아닌 것이 섞여 있거나 (`db.ts` · `npm-run` 같은 것)
 */
export function isUsablePhrase(phrase: string): boolean {
  const text = phrase.trim();
  if (text.length < 2) return false;
  if (/[^\p{L}\p{N}\s]/u.test(text)) return true;
  if (/\s/.test(text)) return true;
  return text.length >= 6;
}

/** 규칙으로 받을 수 있는 모양인가. 못 받는 이유를 문장으로 돌려준다. */
export function watchProblems(rule: WatchRule): string[] {
  const problems: string[] = [];
  if (rule.blind_spots.length === 0) {
    problems.push('못 잡는 것을 안 적었다 — 다 잡는다는 말은 거짓이다');
  }
  if (rule.mode === 'machine' && rule.paths.length === 0 && rule.phrases.length === 0) {
    problems.push('걸릴 자리도 말도 없는데 기계가 잡는다고 돼 있다');
  }
  if (rule.mode === 'inject_only' && (rule.paths.length > 0 || rule.phrases.length > 0)) {
    problems.push('기계가 못 잡는다면서 걸릴 자리를 적었다');
  }
  for (const phrase of rule.phrases) {
    if (!isUsablePhrase(phrase)) {
      problems.push(`너무 짧거나 흔한 말이라 아무데나 걸린다: ${JSON.stringify(phrase)}`);
    }
  }
  return problems;
}
