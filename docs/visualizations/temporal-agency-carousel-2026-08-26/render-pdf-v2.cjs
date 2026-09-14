const path = require('path');
const { chromium } = require('/Users/yc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const root = __dirname;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: 1080px 1350px; margin: 0; }
    html, body { margin: 0; padding: 0; }
    img { display: block; width: 1080px; height: 1350px; page-break-after: always; }
    img:last-child { page-break-after: auto; }
  </style></head><body>
    <img src="argus-temporal-agency-v2-1.png" />
    <img src="argus-temporal-agency-v2-2.png" />
    <img src="argus-temporal-agency-v2-3.png" />
  </body></html>`;

  const fs = require('fs');
  const tmp = path.join(root, 'output', 'pdf-source.html');
  fs.writeFileSync(tmp, html);

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });
  const page = await browser.newPage();
  await page.goto(`file://${path.join(root, 'output', 'pdf-source.html').replace(/ /g, '%20')}`, { waitUntil: 'networkidle' });
  await page.pdf({
    path: path.join(root, 'output', 'argus-temporal-agency-v2.pdf'),
    width: '1080px',
    height: '1350px',
    printBackground: true,
    pageRanges: '1-3',
  });
  await browser.close();
  fs.unlinkSync(tmp);
})();
