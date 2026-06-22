/**
 * Render an Argus markdown deliverable as a safe HTML email body.
 *
 * Security: the deliverable contains user text AND LLM output, so we HTML-escape
 * FIRST, then apply a light markdown→HTML pass over the escaped text. Because
 * escaping only touches < > & " ', the markdown markers (#, *, -) survive intact
 * and the regex transforms can never reintroduce an executable tag.
 */

const MAX_EMAIL_CHARS = 40_000;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Light markdown → HTML over already-escaped text. Block-level, line-based. */
function renderBody(escaped: string): string {
  const lines = escaped.split('\n');
  const out: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) { out.push('</ul>'); inList = false; }
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');

    // Headings (#, ##, ###)
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      closeList();
      const size = h[1].length === 1 ? 19 : h[1].length === 2 ? 16 : 14;
      const top = h[1].length === 1 ? 28 : 20;
      out.push(
        `<p style="font-size:${size}px;font-weight:700;color:#111827;margin:${top}px 0 8px 0;">${inline(h[2])}</p>`,
      );
      continue;
    }

    // Bullets (-, *, •)
    const b = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (b) {
      if (!inList) { out.push('<ul style="margin:6px 0 6px 0;padding-left:20px;">'); inList = true; }
      out.push(`<li style="font-size:14px;color:#374151;line-height:1.6;margin:2px 0;">${inline(b[1])}</li>`);
      continue;
    }

    closeList();

    if (line.trim() === '') { out.push('<div style="height:8px;"></div>'); continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      out.push('<hr style="border:none;border-top:1px solid #E5E7EB;margin:16px 0;" />');
      continue;
    }
    out.push(`<p style="font-size:14px;color:#374151;line-height:1.6;margin:6px 0;">${inline(line)}</p>`);
  }
  closeList();
  return out.join('\n');
}

/** Inline marks over escaped text: **bold**, *italic*, `code`. */
function inline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+?)`/g, '<code style="background:#F3F4F6;padding:1px 4px;border-radius:4px;font-size:13px;">$1</code>')
    .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
}

export function markdownToEmailHtml(title: string, markdown: string): string {
  const safeTitle = escapeHtml(title.slice(0, 200));
  const body = renderBody(escapeHtml(markdown.slice(0, MAX_EMAIL_CHARS)));

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#ffffff;">
      <div style="border-bottom:2px solid #D97706;padding-bottom:14px;margin-bottom:24px;">
        <span style="font-size:14px;font-weight:700;color:#D97706;">Argus</span>
        <span style="font-size:12px;color:#9CA3AF;margin-left:8px;">${safeTitle}</span>
      </div>
      ${body}
      <p style="font-size:11px;color:#9CA3AF;margin-top:32px;border-top:1px solid #F3F4F6;padding-top:16px;">
        Shared from <a href="https://argus.voyage" style="color:#D97706;text-decoration:none;">Argus</a> — Decision Harness for AI
      </p>
    </div>
  `;
}
