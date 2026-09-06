const { createRequire } = require('node:module');
const { chromium } = createRequire(process.env.QA_RUNTIME + '/package.json')('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const width of [360, 430]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.hostname !== 'localhost') return route.abort();
        if (url.pathname === '/api/scores') return route.fulfill({ contentType: 'application/json', body: '{"records":[]}' });
        return route.continue();
      });
      await page.goto('http://localhost:3000');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: 'PLAY BALL!', exact: true }).click();
      await page.locator('.countdown-card').waitFor({ state: 'detached' });
      await page.locator('.arcade-board').waitFor();
      const geometry = await page.evaluate(() => {
        const rect = selector => document.querySelector(selector).getBoundingClientRect();
        const board = rect('.arcade-board'), score = rect('.arcade-score'), home = rect('.arcade-home'), combo = rect('.arcade-combo');
        return { scoreCenterOffset: score.x + score.width / 2 - board.x - board.width / 2, sideCenterYDifference: home.y + home.height / 2 - combo.y - combo.height / 2, leftInset: home.x - board.x, rightInset: board.right - combo.right };
      });
      console.log({ width, geometry });
      assert(Math.abs(geometry.scoreCenterOffset) < 1, 'score centered on board');
      assert(Math.abs(geometry.sideCenterYDifference) < 1, 'home and combo vertically aligned');
      assert(Math.abs(geometry.leftInset - geometry.rightInset) < 1, 'equal outer spacing');
      // Layout-only fixture, not game state and never submitted to any API.
      await page.locator('.arcade-score > strong').evaluate(n => { n.firstChild.nodeValue = '200,000'; });
      await page.locator('.arcade-combo > strong').evaluate(n => { n.lastChild.nodeValue = '10'; });
      const fits = await page.locator('.arcade-score, .arcade-combo').evaluateAll(nodes => nodes.every(n => n.scrollWidth <= n.clientWidth));
      await page.locator('.arcade-board').screenshot({ path: `artifacts/qa-scoreboard/scoreboard-max-${width}.png` });
      console.log(await page.locator('.arcade-score, .arcade-combo').evaluateAll(nodes => nodes.map(n => ({ className: n.className, scroll: n.scrollWidth, client: n.clientWidth }))));
      assert(fits, `maximum score/combo fit at ${width}px`);
      console.log(`PASS ${width}px max score/combo layout`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
