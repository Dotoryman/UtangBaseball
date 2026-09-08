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
      await page.waitForTimeout(650);
      await page.locator('.play-field').dispatchEvent('pointerdown', { pointerType: 'mouse', button: 0, isPrimary: true });
      await page.waitForTimeout(80);

      assert.equal(await page.locator('.baseball.pitch-paused').count(), 1, 'incoming ball must pause in the input frame');
      const frozenA = await page.locator('.baseball').boundingBox();
      await page.waitForTimeout(260);
      const frozenB = await page.locator('.baseball').boundingBox();
      assert(frozenA && frozenB);
      assert(Math.abs(frozenA.x - frozenB.x) < 0.75 && Math.abs(frozenA.y - frozenB.y) < 0.75, `ball moved while awaiting verdict: ${JSON.stringify({ frozenA, frozenB })}`);
      assert.notEqual(await page.locator('.batter-sprite-v6').evaluate((node) => getComputedStyle(node).backgroundPosition), '28.5714% 0px', 'bat animation must continue while the ball is paused');

      await page.locator('.flying-ball').waitFor({ timeout: 3000 });
      assert.equal(await page.locator('.baseball').count(), 0, 'incoming ball must disappear when contact is confirmed');
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
