const path = require('path');
const { chromium } = require('/Users/yc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const root = __dirname;
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1500 }, deviceScaleFactor: 1 });
  await page.goto(`file://${path.join(root, 'carousel.html')}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);

  for (let index = 1; index <= 3; index += 1) {
    const slide = page.locator(`#slide-${index}`);
    await slide.screenshot({
      path: path.join(root, 'output', `argus-temporal-agency-${index}.png`),
      type: 'png',
    });
  }

  await browser.close();
})();
