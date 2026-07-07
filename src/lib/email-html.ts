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
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <style>
      @media (prefers-color-scheme: dark) {
        .argus-ledger { background:#0f1115 !important; color:#f4f1ea !important; }
        .argus-ledger-body p, .argus-ledger-body li { color:#d8d3c7 !important; }
        .argus-rule { border-color:#3a342a !important; }
      }
    </style>
    <div class="argus-ledger" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;padding:28px;background:#fffdf8;color:#1a1a1a;">
      <div class="argus-rule" style="border-top:1px solid #d8c7a3;border-bottom:1px solid #d8c7a3;padding:16px 0;margin-bottom:24px;">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.2;color:#111827;">${safeTitle}</div>
        <div style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace;font-size:11px;letter-spacing:0.08em;color:#9a7b3f;margin-top:8px;">ARGUS LEDGER</div>
      </div>
      <div class="argus-ledger-body">${body}</div>
      <p class="argus-rule" style="font-size:11px;color:#9C8F7A;margin-top:32px;border-top:1px solid #eadfca;padding-top:16px;">
        Sent by <a href="https://argus.voyage" style="color:#8a6724;text-decoration:none;">Argus</a>. No score. No AI verdict.
      </p>
    </div>
  `;
}
