/**
 * Behavioral drift guard: the MCP detector (detect-signals.ts) and the plugin's
 * CJS mirror (argus-plugin-v2/scripts/lib/decision-signals.js) MUST detect the
 * SAME senses on the SAME text. A string-compare of the regexes would be brittle;
 * running BOTH over a shared corpus and asserting identical kinds is the real
 * contract (CLAUDE.md single-source rule, the web↔mcp parity pattern). If the two
 * ever diverge, this fails and names the sentence that split them.
 *
 * Skips gracefully when the sibling plugin package is absent (a standalone
 * argus-mcp checkout / published-package CI) — the guard is a monorepo invariant.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { detectSignals as tsDetect } from '../detect-signals.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const pluginPath = path.resolve(here, '../../../../argus-plugin-v2/scripts/lib/decision-signals.js');
const havePlugin = fs.existsSync(pluginPath);

const CORPUS: Array<{ text: string; open?: string[] }> = [
  { text: 'I think we will ship the app to TestFlight by Friday.' },
  { text: 'Churn should drop below 3% once we launch the new onboarding.' },
  { text: 'This hire will get us to weekly deploys within 2 months.' },
  { text: '이번 채용으로 배포가 주 1회로 빨라질 거예요.' },
  { text: '가격을 올려도 이탈률은 5% 아래로 유지될 겁니다.' },
  { text: '다음 분기까지 매출 20% 성장할 것으로 예상합니다.' },
  { text: 'I will think about it.' },
  { text: '그건 나중에 생각해볼게요.' },
  { text: 'Which database should we use?' },
  { text: 'Run the test suite and show me the output.' },
  { text: '오늘 날씨 어때?' },
  { text: 'This only works as long as the vendor API stays under 200ms.' },
  { text: '배포를 주 1회로 늘리는 건 새 채용이 6월까지 온보딩된다는 전제로 가능해요.' },
  { text: 'I skipped lunch because I was tired.' },
  { text: '피곤해서 그냥 집에 갔어요.' },
  { text: 'We will cut churn below 3% by Q3, as long as the new pricing holds.' },
  { text: '아 그 서버 이전은 결국 무중단으로 잘 끝났어요.', open: ['서버 이전 후에도 다운타임은 없다'] },
  { text: 'Turns out the hire really did get us to weekly deploys.', open: ['this hire gets us to weekly deploys'] },
  { text: '아 어제 점심은 결국 국밥으로 잘 먹었어요.', open: ['서버 이전 후에도 다운타임은 없다'] },
  { text: 'It turned out fine, thanks for asking.', open: ['this hire gets us to weekly deploys'] },
];

describe('detect-signals drift guard (TS ↔ plugin CJS)', () => {
  it.skipIf(!havePlugin)('both surfaces detect the SAME kinds on every corpus sentence', () => {
    const require = createRequire(import.meta.url);
    const jsDetect = require(pluginPath).detectSignals as typeof tsDetect;
    expect(typeof jsDetect).toBe('function');
    for (const { text, open } of CORPUS) {
      const ts = tsDetect(text, { openPredicates: open }).map((s) => s.kind).sort();
      const js = jsDetect(text, { openPredicates: open }).map((s) => s.kind).sort();
      expect(js, `drift on: "${text}"`).toEqual(ts);
    }
  });
});
