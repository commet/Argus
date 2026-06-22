/**
 * Convert an Argus markdown deliverable to Telegram-safe HTML.
 *
 * Telegram's sendMessage supports parse_mode 'HTML' with a small tag allowlist
 * (<b> <i> <code> <pre> <a>). HTML mode is far more robust than MarkdownV2 (which
 * requires escaping ~18 special chars and breaks on a single stray '.'), so we
 * escape < > & once and emit only allowlisted tags.
 *
 * Telegram hard-limits a message to 4096 chars; we budget below that to leave
 * room for the title header and footer.
 */

const TG_LIMIT = 3800;

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Inline marks over escaped text: **bold** → <b>, `code` → <code>. */
function inline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/`([^`]+?)`/g, '<code>$1</code>');
}

export function markdownToTelegramHtml(title: string, markdown: string): string {
  const lines = escape(markdown).split('\n');
  const out: string[] = [`<b>${escape(title).slice(0, 200)}</b>`, ''];

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) { out.push(`<b>${inline(h[2])}</b>`); continue; }
    const b = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (b) { out.push(`• ${inline(b[1])}`); continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) { out.push('—'); continue; }
    out.push(inline(line));
  }

  out.push('', '— Argus');
  let text = out.join('\n');
  if (text.length > TG_LIMIT) text = text.slice(0, TG_LIMIT) + '\n…';
  return text;
}
