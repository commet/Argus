const path = require('path');
const { chromium } = require('/Users/yc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const root = __dirname;
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1500 }, deviceScaleFactor: 2 });
  await page.goto(`file://${path.join(root, 'linkedin-3.html')}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  for (let i = 1; i <= 3; i++) {
    await page.locator(`#img-${i}`).screenshot({ path: path.join(root, 'output', `linkedin-${i}.png`), type: 'png' });
  }
  await browser.close();
})();
