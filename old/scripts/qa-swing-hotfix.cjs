const { createRequire } = require('node:module');
const assert = require('node:assert/strict');

const runtime = process.env.QA_RUNTIME;
if (!runtime) throw new Error('QA_RUNTIME is required');
const { chromium } = createRequire(`${runtime}/package.json`)('playwright');

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const width of [390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: width < 500 ? 844 : 900 } });
      const actions = [];
      let swingPayload = null;
      await page.route('**/api/scores**', (route) => route.fulfill({ contentType: 'application/json', body: '{"records":[]}' }));
      await page.route('**/api/game', async (route) => {
        const body = route.request().postDataJSON();
        actions.push(body.action);
        if (body.action === 'start') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ sessionId: '00000000-0000-0000-0000-000000000001' }) });
        if (body.action === 'pitch') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ pitch: { type: '직구', duration: 1650 }, windupMs: 760 }) });
        if (body.action === 'release') {
          await sleep(120);
          return route.fulfill({ contentType: 'application/json', body: '{"released":true}' });
        }
        if (body.action === 'swing') {
          swingPayload = body;
          await sleep(420);
          return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ contact: { outcome: 'SINGLE', distance: 64, exitVelocity: 118, launchAngle: 20, points: 1840 }, stats: { score: 2024, combo: 1, maxCombo: 1, homeRuns: 0, maxDistance: 64 }, completed: false }) });
        }
        return route.fulfill({ status: 400, body: '{}' });
      });

      await page.goto('http://127.0.0.1:8787/?qa=swing-hotfix');
      await page.getByRole('button', { name: 'PLAY BALL!', exact: true }).click();
      await page.locator('.baseball').waitFor({ timeout: 10000 });
      await page.waitForFunction(() => {
        const ball = document.querySelector('.baseball')?.getBoundingClientRect();
        const target = document.querySelector('.contact-core')?.getBoundingClientRect();
        return ball && target && Math.hypot(ball.x + ball.width / 2 - target.x - target.width / 2, ball.y + ball.height / 2 - target.y - target.height / 2) < 9;
      }, {}, { polling: 'raf', timeout: 5000 });
      await page.locator('.play-field').dispatchEvent('pointerdown', { pointerType: 'mouse', button: 0, isPrimary: true });
      await page.waitForTimeout(110);

      assert.equal(await page.locator('.baseball').count(), 0, 'incoming ball must leave on the bat contact frame');
      assert.equal(await page.locator('.flying-ball.flying-preview').count(), 1, 'outgoing ball must launch before the delayed verdict');
      assert.equal(await page.locator('.judgment').count(), 0, 'the preview must not expose a verdict before the server responds');
      assert.notEqual(await page.locator('.batter-sprite-v6').evaluate((node) => getComputedStyle(node).backgroundPosition), '28.5714% 0px', 'bat animation must continue while the outgoing ball launches');

      await page.locator('.judgment').waitFor({ timeout: 3000 });
      assert.equal(await page.locator('.baseball').count(), 0, 'incoming ball must disappear when contact is confirmed');
      assert.equal(await page.locator('.flying-ball').count(), 1, 'only one outgoing ball may remain after contact is confirmed');
      assert.equal(actions.indexOf('release') < actions.indexOf('swing'), true, `release must finish before swing: ${actions.join(',')}`);
      assert.equal(typeof swingPayload?.swingElapsedMs, 'number');
      assert(swingPayload.swingElapsedMs > 0 && swingPayload.swingElapsedMs < 2063);
      console.log(`PASS ${width}px`, { actions, swingElapsedMs: swingPayload.swingElapsedMs });
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
