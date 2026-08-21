import type { Clause } from '../rules/split.js';
import { isUsablePhrase, type WatchRule } from './rule.js';

/**
 * 조항 → 어긋난 걸 아는 방법의 **초안**. 모델 없이, 글자만 보고.
 *
 * 왜 모델 없는 초안이 따로 있나:
 *  - 키 없이도 제품이 **덜 좋게라도** 돈다. 모델이 없으면 아무것도 안 되는
 *    설계는 오프라인·회사망·크레딧 소진에서 통째로 죽는다.
 *  - 모델이 낸 것을 **대볼 것**이 생긴다. 모델이 초안보다 나쁘면 그건 신호다.
 *  - 무엇보다 **여기서는 아무것도 지어내지 않는다.** 조항에 그대로 적힌
 *    글자만 옮긴다. 모르는 것은 "못 잡는 것"에 적는다.
 */

/**
 * 백틱 안의 토막 — 이 저장소의 규칙 문서는 파일·명령을 전부 백틱에 넣는다.
 *
 * **줄바꿈을 넘어가는 것을 허용한다.** 규칙 문서는 80칸에서 접히기 때문에
 * `` `taskkill /IM\n   claude*` `` 처럼 백틱 안에서 줄이 바뀐다. 줄바꿈을
 * 막아 놨더니 짝이 어긋나 `","` 같은 쓰레기가 뽑혔다 (2026-08-21, 실제 조항에
 * 대보고 발견). 길이 상한이 피해를 가둔다.
 */
const BACKTICK = /`([^`]{2,80})`/g;
/** 따옴표 안의 말 — 규칙이 겨냥하는 표현이 여기 들어 있다. */
const QUOTED = /["“]([^"”\n]{2,60})["”]/g;

const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|md|json|ya?ml|css|scss|sql|sh|toml)$/;
const PATH_SHAPE = /^[\w.@~-]+(\/[\w.@*?-]+)*\/?$/;

/** 백틱 토막이 **자리**인가 (파일·폴더), 아니면 **말**인가 (명령·표현). */
function looksLikePath(token: string): boolean {
  if (/\s/.test(token)) return false;              // 공백이 있으면 명령이다
  if (!PATH_SHAPE.test(token)) return false;        // 괄호·기호가 있으면 표현이다
  return token.includes('/') || CODE_EXT.test(token);
}

const uniq = (list: readonly string[]): string[] => [...new Set(list)];

/** 글자가 둘 이상 있는가 — 쉼표·따옴표만 남은 토막을 말로 삼지 않는다. */
const hasWords = (text: string): boolean => (text.match(/[\p{L}\p{N}]/gu) ?? []).length >= 2;

function collect(text: string, re: RegExp): string[] {
  const out: string[] = [];
  for (const match of text.matchAll(new RegExp(re.source, re.flags))) {
    // 접힌 줄은 한 줄로 펴서 담는다 — 대화에서는 한 줄로 나타나기 때문이다.
    const value = match[1]?.replace(/\s+/g, ' ').trim();
    if (value && hasWords(value)) out.push(value);
  }
  return out;
}

export interface WatchDraft {
  rule: WatchRule;
  /** 무엇을 보고 이렇게 뽑았나 — 사람이 되짚을 수 있게. */
  from: { paths_from: string[]; phrases_from: string[] };
}

export function draftWatchFromClause(clause: Clause): WatchDraft {
  const ticks = collect(clause.text, BACKTICK);
  const quotes = collect(clause.text, QUOTED);

  const paths = uniq(ticks.filter(looksLikePath));
  // 백틱 안의 명령·표현 + 따옴표 안의 말이 전부 "말" 채널이다.
  const candidates = uniq([...ticks.filter((t) => !looksLikePath(t)), ...quotes]);
  const phrases = candidates.filter(isUsablePhrase);
  const dropped = candidates.filter((c) => !isUsablePhrase(c));

  const blind: string[] = [];
  if (paths.length === 0 && phrases.length > 0) {
    blind.push('어느 파일을 건드렸는지로는 못 잡는다. 말이 나올 때만 걸린다.');
  }
  if (phrases.length === 0 && paths.length > 0) {
    blind.push('말로는 못 잡는다. 그 자리를 건드릴 때만 걸린다.');
  }
  if (dropped.length > 0) {
    blind.push(`너무 흔해서 뺀 말이 있다: ${dropped.join(', ')}. 이 말만 나오는 경우는 못 잡는다.`);
  }
  if (paths.length > 0 || phrases.length > 0) {
    blind.push('같은 뜻의 다른 표현은 못 잡는다.');
  }
  const machine = paths.length > 0 || phrases.length > 0;
  if (!machine) {
    blind.push('이 규칙에는 기계가 볼 수 있는 자리가 없다. 읽어주기만 한다.');
  }

  return {
    rule: {
      paths, phrases,
      except_paths: [], except_phrases: [],
      blind_spots: blind,
      mode: machine ? 'machine' : 'inject_only',
    },
    from: { paths_from: paths, phrases_from: phrases },
  };
}
