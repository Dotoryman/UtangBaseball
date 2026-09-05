const { createRequire } = require('node:module');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = createRequire(process.env.QA_RUNTIME + '/package.json')('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const evidence = 'artifacts/qa-v081';
  fs.mkdirSync(evidence, { recursive: true });
  const results = [];
  try {
    for (const width of [360, 430]) {
      const context = await browser.newContext({ viewport: { width, height: 844 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      // No production access or persistent ranking writes, including accidental redirects.
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.hostname !== 'localhost') return route.abort();
        if (url.pathname === '/api/scores') return route.fulfill({ contentType: 'application/json', body: '{"records":[]}' });
        return route.continue();
      });
      await page.addInitScript(() => { Math.random = () => .5; });
      await page.goto('http://localhost:3000/?qa=automated-v081');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: 'PLAY BALL!', exact: true }).waitFor();
      await page.screenshot({ path: `${evidence}/intro-${width}.png`, fullPage: true });
      await page.getByRole('button', { name: 'PLAY BALL!', exact: true }).click();
      await page.locator('.countdown-card').waitFor();
      assert.equal(await page.locator('.baseball').count(), 0, 'no pitch during countdown');
      await page.screenshot({ path: `${evidence}/countdown-${width}.png` });
      await page.locator('.countdown-card').waitFor({ state: 'detached' });
      await page.screenshot({ path: `${evidence}/hud-${width}.png` });
      const fonts = await page.locator('.hud-score strong, .hud-pitches > span > strong, .combo strong').evaluateAll(nodes => nodes.map(n => getComputedStyle(n).fontSize));
      assert.equal(new Set(fonts).size, 1, 'HUD numeral font sizes match');
      await page.waitForFunction(() => {
        const b = document.querySelector('.baseball')?.getBoundingClientRect();
        const t = document.querySelector('.contact-core')?.getBoundingClientRect();
        return b && t && Math.hypot(b.x+b.width/2-t.x-t.width/2, b.y+b.height/2-t.y-t.height/2) < 9;
      }, null, { polling: 'raf', timeout: 12000 });
      // Real input through browser, not changing component state or scores.
      await page.mouse.click(width / 2, 500);
      await page.locator('.homer-celebration').waitFor({ timeout: 2000 });
      assert.equal(await page.locator('.baseball').count(), 0, 'incoming ball removed at contact');
      await page.locator('.flying-ball').waitFor();
      assert.equal(await page.locator('.batter-impact-bubble').count(), 1);
      const shake = await page.locator('.stadium').evaluate(n => getComputedStyle(n).animationName);
      assert.equal(shake, 'homer-shake');
      await page.screenshot({ path: `${evidence}/homer-${width}.png` });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(await page.locator('.stadium').evaluate(n => getComputedStyle(n).animationName), 'none');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.locator('.homer-celebration').waitFor({ state: 'detached' });
      assert.equal(await page.locator('.flying-ball').count(), 0, 'outgoing ball removed before next pitch');
      console.log(`PASS ${width}px: countdown, HUD, home run, incoming/outgoing ball cleanup, reduced motion`);
      // Leave the next pitch untouched: catcher must catch and remove the ball.
      await page.locator('.catcher-catch').waitFor({ timeout: 8000 });
      assert.equal(await page.locator('.baseball').count(), 0);
      await page.screenshot({ path: `${evidence}/miss-${width}.png` });
      await page.locator('.result-panel').waitFor({ timeout: 45000 });
      await page.screenshot({ path: `${evidence}/result-${width}.png`, fullPage: true });
      await page.setViewportSize({ width, height: 600 });
      await page.mouse.move(width / 2, 400);
      await page.mouse.wheel(0, 700);
      await page.waitForTimeout(350);
      assert(await page.locator('.result-panel').evaluate(n => n.scrollTop > 0), 'result scroll works on short viewport');
      await page.screenshot({ path: `${evidence}/result-scrolled-${width}.png` });
      assert.equal(await page.locator('.homer-celebration, .baseball, .flying-ball').count(), 0);
      await page.getByRole('button', { name: '다시 도전', exact: true }).click();
      assert.equal(await page.locator('.baseball, .flying-ball, .homer-celebration').count(), 0);
      await page.getByRole('button', { name: '처음 화면으로', exact: true }).click();
      await page.getByRole('button', { name: 'PLAY BALL!', exact: true }).waitFor();
      assert.deepEqual(errors, [], 'no browser exceptions');
      results.push({ width, passed: true, fonts, browserErrors: errors });
      console.log(`PASS ${width}px: miss/catch, result, restart, home; no browser exceptions`);
      await context.close();
    }
    fs.writeFileSync(`${evidence}/report.json`, JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
