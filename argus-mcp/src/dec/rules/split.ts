import crypto from 'node:crypto';

/**
 * 규칙 파일을 **조항**으로 가른다 — 역이식의 둘째 걸음.
 *
 * 규율 셋:
 *  1. **원문을 바꾸지 않는다.** 조항의 `text` 는 파일에 그대로 있는 문자열이고,
 *     `verifyClauseAnchors` 가 그것을 바이트로 다시 대조한다. 요약·정규화는
 *     여기서 하지 않는다 — 지어낸 인용을 사람에게 보여주는 길이다.
 *  2. **버린 것도 이유와 함께 남긴다.** 코드·제목·표는 조항이 아니지만
 *     "몇 개를 왜 안 봤나"를 셀 수 있어야 한다.
 *  3. **모델을 안 부른다.** 여기는 자르기만 한다. 이해하는 일(범위·감지 규칙)은
 *     사람이 확인하는 순간에 한 번 부른다 — 시공 계획 §7.
 */

export interface Clause {
  /** 같은 파일을 다시 읽어도 같은 값. 줄이 밀려도 안 바뀌고, 글자가 바뀌면 바뀐다. */
  clause_id: string;
  file: string;
  line_start: number;
  line_end: number;
  /** 파일에 그대로 있는 문자열. */
  text: string;
  /** 어느 절 아래였나 — 사람이 찾아가려면 필요하다. */
  section: string;
  /** 왜 규칙으로 봤나. 사람이 판단을 되짚을 수 있게 표지를 남긴다. */
  markers: string[];
  kind: 'list_item' | 'paragraph' | 'quote';
}

export interface SkippedBlock {
  file: string;
  line_start: number;
  line_end: number;
  why: '코드' | '제목' | '표' | '규칙 표지 없음' | '너무 짧음' | '머리말';
}

export interface SplitResult {
  clauses: Clause[];
  skipped: SkippedBlock[];
}

/** 규칙임을 드러내는 표지. **찾은 표지를 조항에 적어 둔다** — 왜 뽑혔는지 보이게. */
const MARKERS: Array<[string, RegExp]> = [
  ['금지', /금지|하지 않는다|안 된다|말 것|하지 마라|쓰지 않는다|넣지 않는다|두지 않는다/],
  ['필수', /반드시|필수|해야 한다|해야만|무조건|꼭 /],
  ['규율', /규율|원칙|규약|불변식|조항/],
  ['먼저', /먼저 (읽|확인|본다|한다)|우선한다|보다 위다/],
  ['대신', /대신 |아니라 |말고 /],
  ['must', /\bmust\b|\bnever\b|\balways\b|\bdo not\b|\bdon't\b|\brequired\b|\bforbidden\b/i],
  ['avoid', /\bavoid\b|\bprefer\b|\bshould\b/i],
  // 절차형 규칙 — 이 저장소의 점검표는 화살표로 순서를 적는다
  // ("컴포넌트 삭제 → grep → import 제거"). 표지가 없다고 버렸더니 절 하나가
  // 통째로 빠졌다 (2026-08-21, Clean Removal).
  ['순서', /→/],
];

/** 서술형 규칙 문장 — 이 저장소의 규칙 문서는 대부분 이 모양이다. */
const DECLARATIVE = /(한다|된다|이다|따른다|쓴다|본다|적는다|만든다|남긴다|묻는다|막는다|확인|제거)\.?\s*$/m;

/** 문장 끝의 괄호 딸림말은 서술형 판정에서 뺀다 — "…컬럼 확인(정리는 선택)." */
const withoutTrailingParen = (text: string): string => text.replace(/\([^)]*\)\.?\s*$/, '').trimEnd();

const FENCE = /^\s*(```|~~~)/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const TABLE_ROW = /^\s*\|/;
const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const QUOTE = /^\s*>/;

function markersIn(text: string): string[] {
  const found = MARKERS.filter(([, re]) => re.test(text)).map(([name]) => name);
  if (found.length === 0 && DECLARATIVE.test(withoutTrailingParen(text))) found.push('서술형');
  return found;
}

/** 굵게·인용·링크 같은 꾸밈을 걷어낸 길이 — "너무 짧음"을 재는 데만 쓴다. */
const bare = (text: string): string => text.replace(/[*_`>#[\]()|-]/g, '').trim();

export function splitRuleFile(file: string, source: string): SplitResult {
  const lines = source.split('\n');
  const clauses: Clause[] = [];
  const skipped: SkippedBlock[] = [];
  const seen = new Map<string, number>();
  let section = '';
  let inFence = false;
  let fenceStart = 0;

  /** ":" 로 끝나고 바로 아래가 목록이면 그건 조항이 아니라 **머리말**이다
   *  ("PRODUCT.md의 제약은 코드 규율보다 위다. 특히:"). 진짜 조항은 그 아래
   *  항목들이고, 머리말까지 후보로 올리면 사람이 같은 규칙을 두 번 본다. */
  const isLeadIn = (text: string, endLine: number): boolean => {
    if (!/[:：]\s*$/.test(text.trimEnd())) return false;
    for (let k = endLine; k < lines.length; k += 1) {
      const next = lines[k]!;
      if (!next.trim()) continue;
      return LIST_ITEM.test(next);
    }
    return false;
  };

  const push = (kind: Clause['kind'], start: number, end: number, text: string): void => {
    // 머리말 판정이 길이보다 먼저다 — 짧은 머리말("지켜야 할 것 셋:")을
    // "너무 짧음"으로 적으면 왜 뺐는지가 틀리게 남는다.
    if (isLeadIn(text, end)) { skipped.push({ file, line_start: start, line_end: end, why: '머리말' }); return; }
    if (bare(text).length < 12) { skipped.push({ file, line_start: start, line_end: end, why: '너무 짧음' }); return; }
    const markers = markersIn(text);
    if (markers.length === 0) { skipped.push({ file, line_start: start, line_end: end, why: '규칙 표지 없음' }); return; }
    const digest = crypto.createHash('sha1').update(text, 'utf8').digest('hex').slice(0, 10);
    const nth = (seen.get(digest) ?? 0) + 1;
    seen.set(digest, nth);
    clauses.push({
      clause_id: `${file}#${digest}${nth > 1 ? `-${nth}` : ''}`,
      file, line_start: start, line_end: end, text, section, markers, kind,
    });
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;

    if (FENCE.test(line)) {
      if (!inFence) { inFence = true; fenceStart = i + 1; }
      else { inFence = false; skipped.push({ file, line_start: fenceStart, line_end: i + 1, why: '코드' }); }
      i += 1; continue;
    }
    if (inFence) { i += 1; continue; }

    if (!line.trim()) { i += 1; continue; }

    const heading = HEADING.exec(line);
    if (heading) {
      section = heading[2]!.trim();
      skipped.push({ file, line_start: i + 1, line_end: i + 1, why: '제목' });
      i += 1; continue;
    }

    if (TABLE_ROW.test(line)) {
      const start = i;
      while (i < lines.length && TABLE_ROW.test(lines[i]!)) i += 1;
      skipped.push({ file, line_start: start + 1, line_end: i, why: '표' });
      continue;
    }

    if (QUOTE.test(line)) {
      const start = i;
      while (i < lines.length && (QUOTE.test(lines[i]!) || (lines[i]!.trim() === '' && QUOTE.test(lines[i + 1] ?? '')))) i += 1;
      push('quote', start + 1, i, lines.slice(start, i).join('\n'));
      continue;
    }

    const item = LIST_ITEM.exec(line);
    if (item) {
      const indent = item[1]!.length;
      const start = i;
      i += 1;
      // 이어지는 줄: 더 깊이 들여쓴 **본문**만 딸려온다. 더 깊은 항목은
      // 그 자체가 조항이므로 따로 뽑는다 (조항 하나 = 서명 하나).
      while (i < lines.length) {
        const next = lines[i]!;
        if (!next.trim()) {
          const after = lines[i + 1] ?? '';
          if (!after.trim() || FENCE.test(after)) break;
          const afterIndent = after.length - after.trimStart().length;
          if (afterIndent <= indent || LIST_ITEM.test(after)) break;
          i += 1; continue;
        }
        if (LIST_ITEM.test(next)) break;
        if (HEADING.test(next) || FENCE.test(next) || TABLE_ROW.test(next)) break;
        const nextIndent = next.length - next.trimStart().length;
        if (nextIndent <= indent) break;
        i += 1;
      }
      push('list_item', start + 1, i, lines.slice(start, i).join('\n'));
      continue;
    }

    const start = i;
    while (i < lines.length && lines[i]!.trim() &&
           !HEADING.test(lines[i]!) && !FENCE.test(lines[i]!) &&
           !TABLE_ROW.test(lines[i]!) && !QUOTE.test(lines[i]!) && !LIST_ITEM.test(lines[i]!)) i += 1;
    push('paragraph', start + 1, i, lines.slice(start, i).join('\n'));
  }

  if (inFence) skipped.push({ file, line_start: fenceStart, line_end: lines.length, why: '코드' });
  return { clauses, skipped };
}

/**
 * 조항의 원문이 파일에 **그대로** 있는지 바이트로 다시 본다.
 * (`harvest.ts` 가 인용에 하는 것과 같은 규율 — 이 검사를 끄면 제품이 지어낸
 * 문장을 사람에게 보여주게 된다.)
 */
export function verifyClauseAnchors(source: string, clauses: readonly Clause[]): { ok: boolean; missing: string[] } {
  const missing = clauses.filter((c) => !source.includes(c.text)).map((c) => c.clause_id);
  return { ok: missing.length === 0, missing };
}

/**
 * 표지가 없어 후보로 안 올린 덩어리의 **원문**을 돌려준다.
 *
 * 세기만 하고 감추면 "우리가 못 본 규칙"이 조용한 공백이 된다. 실제로
 * 그렇게 절 하나(Clean Removal)를 통째로 놓쳤고, 사람이 눈으로 보고 잡았다.
 * 이제는 안 올린 것도 같이 나오므로 다음 단계와 사람이 볼 수 있다.
 */
export function unmarkedBlocks(
  source: string, split: SplitResult,
): Array<{ file: string; line_start: number; text: string }> {
  const lines = source.split('\n');
  return split.skipped
    .filter((block) => block.why === '규칙 표지 없음')
    .map((block) => ({
      file: block.file,
      line_start: block.line_start,
      text: lines.slice(block.line_start - 1, block.line_end).join('\n'),
    }));
}
