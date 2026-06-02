/**
 * extract-options.ts — 판단 텍스트에서 선택지 추출
 *
 * "질문: A vs B vs C" 형태의 decision/judgment 텍스트를 파싱해서
 * 칩 버튼으로 표시할 수 있는 선택지 배열을 반환.
 *
 * WorkflowGraph (RecastStep)와 WorkerCard (ProgressiveFlow) 양쪽에서 사용.
 */

/** Strip Korean particles from end of option text */
export function stripParticles(text: string): string {
  return text
    // Trailing josa attach to the END of a word, so only strip a particle that
    // has a non-space char before it. Without the lookbehind, a word whose FIRST
    // syllable is a particle-homograph (이직, 가격, 은행, 도시, 만남 …) was wiped
    // to "" and silently dropped.
    .replace(/(?<=\S)\s*(중에서|사이에서|으로|에서|를|을|이|가|은|는|와|과|도|만|로)\s*.*$/, '')
    // Trailing decision verb only (preceded by whitespace) — so an option that
    // *starts* with 비교/검토/… (e.g. "비교 우위 전략") isn't wiped to empty.
    .replace(/\s+(결정|선택|판단|비교|검토).*$/, '')
    .trim();
}

/** Drop duplicate options while preserving order. */
function dedupe(opts: string[]): string[] {
  return Array.from(new Set(opts));
}

/** Extract selectable options from judgment/decision text */
export function extractOptions(text?: string): string[] {
  if (!text) return [];

  // Strategy 1: "vs" separated
  if (text.includes(' vs ')) {
    const sentences = text.split(/[.]\s*/);
    for (const sentence of sentences) {
      if (!sentence.includes(' vs ')) continue;
      const cleaned = sentence.replace(/^[^:]*:\s*/, '');
      const opts = dedupe(cleaned
        .split(/\s+vs\.?\s+/)
        .map(o => stripParticles(o))
        .filter(o => o.length >= 2 && o.length <= 40));
      if (opts.length >= 2) return opts;
    }
  }

  // Strategy 2: "/" separated (but not dates like 2024/2025)
  if (text.includes('/') && !/\d{4}\/\d/.test(text)) {
    const clauses = text.split(/[,.]\s*/);
    for (const clause of clauses) {
      if (!clause.includes('/')) continue;
      const opts = dedupe(clause.split('/').map(o => o.trim()).filter(o => o.length >= 2 && o.length <= 40));
      if (opts.length >= 2 && opts.length <= 5) return opts;
    }
  }

  // Strategy 3: "~할지 ~할지" pattern (Korean decision phrasing)
  const haljiMatch = text.match(/(.{2,20})할지[,\s]+(.{2,20})할지/);
  if (haljiMatch) {
    return [haljiMatch[1].trim() + '하기', haljiMatch[2].trim() + '하기'];
  }

  // Strategy 4: "~인지 ~인지" pattern
  const injiMatch = text.match(/(.{2,20})인지[,\s]+(.{2,20})인지/);
  if (injiMatch) {
    return [injiMatch[1].trim(), injiMatch[2].trim()];
  }

  // Strategy 5: numbered list "1) A 2) B" or "1. A 2. B"
  const numbered = text.match(/[1-5][.)]\s*([^1-5]{2,30})/g);
  if (numbered && numbered.length >= 2) {
    const opts = dedupe(numbered.map(n => n.replace(/^[1-5][.)]\s*/, '').trim()).filter(o => o.length >= 2));
    if (opts.length >= 2) return opts;
  }

  return [];
}
