
const fs = require('fs');
const p = 'C:/Users/admin/documents/github/argus/.claude/skills/refine/SKILL.md';
let c = fs.readFileSync(p, 'utf8');

// Normalize line endings to LF for processing
c = c.replace(/\r\n/g, '\n');

// CHANGE 1: Rendering rule (line 20)
c = c.replace(
  '**Rendering:** Final output in ONE code block (the "card"). Changes shown as \x60- old \u2192 + new\x60 inline. Convergence bars (\x60\u2588\u2591\x60) for progress visualization.',
  '**Rendering:** Final output in markdown sections separated by \x60---\x60. NOT a single code block. Changes shown as markdown tables. Convergence as simplified text.\n\n**No box drawing.** Do NOT use \u256D\u256E\u2570\u256F, \u250C\u2502\u2514, \u2550\u2550\u2550\u256A, \u2500\u2500\u2500\u253C, \u2501\u2501\u2501, or any Unicode box characters.\n**No fixed width.** Do NOT enforce 76-char width. Markdown auto-wraps.\n**diff blocks = color tool.** Use \x60diff\x60 fenced blocks for convergence/persona verdict changes. \x60+\x60 = improved. \x60-\x60 = worsened/remaining.'
);

console.log('Change 1 done');
fs.writeFileSync(p, c, 'utf8');
console.log('Saved after change 1');
