/**
 * Converts markdown content to Slack Block Kit format.
 * Used by /api/slack/send to post rich messages.
 */

interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  elements?: { type: string; text: string }[];
  [key: string]: unknown;
}

const BLOCK_TEXT_LIMIT = 3000;
const MAX_BLOCKS = 48; // Slack limit is 50, leave room for header + context

function truncate(text: string, limit = BLOCK_TEXT_LIMIT): string {
  return text.length > limit ? text.slice(0, limit - 3) + '...' : text;
}

export function markdownToSlackBlocks(title: string, markdown: string): SlackBlock[] {
  const blocks: SlackBlock[] = [];

  // Header
  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: title.slice(0, 150), emoji: true },
  });

  blocks.push({ type: 'divider' });

  // Split by headings
  const sections = markdown.split(/^(#{1,3}\s+.+)$/m);

  for (let i = 0; i < sections.length && blocks.length < MAX_BLOCKS; i++) {
    const part = sections[i].trim();
    if (!part) continue;

    if (/^#{1,3}\s+/.test(part)) {
      // Heading → bold section
      const headingText = part.replace(/^#{1,3}\s+/, '');
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*${headingText}*` },
      });
    } else {
      // Body text — convert markdown bullets to Slack mrkdwn
      const slackText = part
        .replace(/\*\*(.+?)\*\*/g, '*$1*')   // bold
        .replace(/^- /gm, '• ')               // bullets
        .replace(/^  - /gm, '  ◦ ');          // nested bullets

      // Split into chunks if too long
      if (slackText.length <= BLOCK_TEXT_LIMIT) {
        blocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text: slackText },
        });
      } else {
        const lines = slackText.split('\n');
        let chunk = '';
        for (const line of lines) {
          if ((chunk + '\n' + line).length > BLOCK_TEXT_LIMIT) {
            if (chunk) {
              blocks.push({ type: 'section', text: { type: 'mrkdwn', text: chunk } });
            }
            chunk = line;
          } else {
            chunk = chunk ? chunk + '\n' + line : line;
          }
        }
        if (chunk) {
          blocks.push({ type: 'section', text: { type: 'mrkdwn', text: truncate(chunk) } });
        }
      }
    }
  }

  // Footer context
  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: 'Shared from *Argus* — Decision Harness for AI' }],
  });

  return blocks.slice(0, 50);
}
