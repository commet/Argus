/**
 * Key-finding extractor — pulls the single most important sentence out of a
 * worker's (often very long) markdown draft so the report step can surface it
 * up front instead of forcing the user to read the whole thing.
 *
 * Strategy, in priority order:
 *   1. The first content line under a "KEY FINDING / 핵심 발견" heading.
 *   2. The first **bold** span (LLMs bold the takeaway).
 *   3. The first non-heading, non-empty line.
 * The result is stripped of markdown markers and capped so it fits one or two
 * lines on a card.
 */

const FINDING_HEADING = /(key\s*finding|핵심\s*발견|핵심발견|핵심\s*결론|bottom\s*line|결론)/i;
const MAX_LEN = 160;

/** Remove inline markdown decorations and tree-drawing glyphs from one line. */
function stripInline(line: string): string {
  return line
    .replace(/^#{1,6}\s*/, '')           // heading hashes
    .replace(/\*\*(.+?)\*\*/g, '$1')      // bold
    .replace(/\*(.+?)\*/g, '$1')          // italic
    .replace(/`(.+?)`/g, '$1')            // inline code
    .replace(/^[\s>*\-•·–—│├└┣┗┃┌┐┤┴┬┼─]+/, '') // leading bullets / tree glyphs
    .replace(/\s*[#*`]+\s*$/, '')         // trailing markers
    .trim();
}

function cap(s: string): string {
  const t = s.trim();
  if (t.length <= MAX_LEN) return t;
  return t.slice(0, MAX_LEN - 1).trimEnd() + '…';
}

/**
 * Extract a one-line key finding from a markdown draft. Returns null when the
 * text is empty or yields nothing meaningful (caller falls back to the task name).
 */
export function extractKeyFinding(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const lines = raw.split('\n');

  // 1) Content directly under a KEY FINDING heading.
  for (let i = 0; i < lines.length; i++) {
    const isHeading = /^#{1,6}\s/.test(lines[i]) || /^\*\*.+\*\*\s*$/.test(lines[i].trim());
    if (isHeading && FINDING_HEADING.test(lines[i])) {
      // The heading line itself may already carry the finding after a colon.
      const afterColon = lines[i].split(/[:：]/).slice(1).join(':');
      const inline = stripInline(afterColon);
      if (inline.length > 4) return cap(inline);
      // Otherwise take the next non-empty line.
      for (let j = i + 1; j < lines.length; j++) {
        const c = stripInline(lines[j]);
        if (c.length > 4) return cap(c);
      }
    }
  }

  // 2) First bold span anywhere.
  const bold = raw.match(/\*\*(.+?)\*\*/);
  if (bold) {
    const c = stripInline(bold[1]);
    if (c.length > 4) return cap(c);
  }

  // 3) First substantial non-heading line.
  for (const line of lines) {
    if (/^#{1,6}\s/.test(line)) continue;
    if (/^[-=_]{3,}\s*$/.test(line.trim())) continue; // divider
    const c = stripInline(line);
    if (c.length > 8) return cap(c);
  }

  return null;
}
