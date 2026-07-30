/**
 * clause-split — where a landing line is ALLOWED to break.
 *
 * The bug this exists to end, permanently: landing copy is written as whole
 * sentences and handed to the browser, which then breaks each line wherever it
 * happens to run out of room. `break-keep` only stops breaks *inside* a word;
 * it says nothing about breaking between "그 팀장과" and "일하는 데". So a
 * sentence lands as
 *
 *     세이렌은 모든 것을 알려주겠다고 노래했고, 항해자들은
 *     그 확신에 이끌렸습니다.
 *
 * — the second clause split across two lines at an arbitrary point. Authoring a
 * "\n" fixes exactly one line at exactly one viewport width and regresses the
 * moment the font, the container, or the copy moves. That is why this keeps
 * coming back.
 *
 * The fix is to stop hoping and constrain the break points structurally:
 * split a line into CLAUSE UNITS at real punctuation, render each unit as an
 * inline-block (an atom the line-breaker places whole), and let the browser
 * balance the units across lines. A break can then only ever land on a clause
 * boundary. If one unit is genuinely wider than its container it still wraps
 * internally — graceful, and the only remaining case is copy that needs an
 * authored break.
 *
 * Pure module on purpose: the rule is testable without a DOM or React.
 */

/** A clause boundary marker that stays attached to the clause it closes. */
const TRAILING = /[,，;；:：…]|—|–|·/;

/**
 * Korean words that must never end a line — 관형사 and counters, which modify
 * the word after them and mean nothing alone.
 *
 * This is the half that punctuation cannot reach. "그 팀장이 조직 개편으로 다른
 * 본부로 옮겼습니다." has no comma anywhere, so clause splitting leaves it as one
 * atom and the browser breaks it wherever the column runs out — which landed on
 * "…다른 | 본부로", tearing a determiner off its noun. Standard Korean
 * typesetting binds these pairs; we do it by gluing the modifier to its noun
 * with a non-breaking space, so the break moves to the nearest real boundary.
 */
const BIND_TO_NEXT = new Set([
  // 지시·성상 관형사
  '그', '이', '저', '그런', '이런', '저런', '어떤', '무슨', '웬', '다른', '딴',
  '새', '헌', '옛', '온', '첫', '온갖', '갖은', '모든', '여러', '각', '매',
  // 수 관형사 (한 달 뒤, 두 번째 …)
  '몇', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열',
  '전', '총', '약',
]);

const NBSP = ' ';

/** Glue every 관형사 to the word it modifies, so no line can end on one. */
function bindModifiers(words: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    let w = words[i];
    // Chain them: "그 다른 팀장" binds through to the noun.
    while (BIND_TO_NEXT.has(w) && i + 1 < words.length) {
      w = w + NBSP + words[++i];
    }
    out.push(w);
  }
  return out;
}

/**
 * Split ONE line (no newlines) into clause units.
 *
 * Boundaries, in order of strength:
 *   1. sentence end — `. ` / `다. ` / `요. ` / `죠. ` / `?` / `!` followed by space
 *   2. trailing punctuation — `,` `;` `:` `…` followed by space
 *   3. a free-standing dash aside — ` — ` (the dash opens the NEXT unit, since
 *      an em dash dangling at a line end reads as a typo)
 *
 * Units shorter than MIN_UNIT are merged back into the previous unit so the
 * renderer never emits a lonely two-character atom.
 */
export function splitClauses(line: string): string[] {
  const MIN_UNIT = 6;
  const words = bindModifiers(line.split(' ').filter(Boolean));
  const units: string[] = [];
  let current: string[] = [];

  const flush = () => {
    if (current.length) units.push(current.join(' '));
    current = [];
  };

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const next = words[i + 1];
    // A free-standing dash opens the next unit rather than closing this one.
    if (next !== undefined && /^[—–]$/.test(next)) {
      current.push(w);
      flush();
      continue;
    }
    if (/^[—–]$/.test(w)) {
      current.push(w);
      continue;
    }
    current.push(w);
    if (next === undefined) continue;
    // Sentence end, or a clause closed by trailing punctuation.
    const endsSentence = /[.?!。？！]$/.test(w);
    const endsClause = TRAILING.test(w.slice(-1));
    if (endsSentence || endsClause) flush();
  }
  flush();

  // Merge fragments too small to stand as their own line. FORWARD, not backward:
  // a short clause belongs with what follows it, because that is how it reads.
  // Merging backward produced ["가려던 이유가 달라졌어요. 이 결정,", "다시 볼까요?"]
  // — it welded "이 결정," onto the sentence BEFORE it and then had to break
  // inside that overlong atom. Forward gives the natural pair,
  // ["가려던 이유가 달라졌어요.", "이 결정, 다시 볼까요?"]. A short unit in final
  // position has nothing ahead of it, so that one still merges backward.
  const merged: string[] = [];
  for (let i = units.length - 1; i >= 0; i--) {
    const u = units[i];
    if (merged.length && u.replace(/\s/g, '').length < MIN_UNIT) {
      merged[0] = u + ' ' + merged[0];
    } else {
      merged.unshift(u);
    }
  }
  if (merged.length > 1) {
    const last = merged[merged.length - 1];
    if (last.replace(/\s/g, '').length < MIN_UNIT) {
      merged[merged.length - 2] += ' ' + merged.pop();
    }
  }
  return merged.length ? merged : [line];
}

/**
 * Split authored copy into hard lines (the author's own "\n") and, inside each,
 * the clause units the line may break between.
 */
export function splitLines(text: string): string[][] {
  return text.split('\n').map((line) => splitClauses(line.trim()));
}
