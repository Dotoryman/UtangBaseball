import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';

const variants = ['aluminum', 'ruby'];

test('every colored ready pose recolors the exposed grip beside the hands', async () => {
  const base = await sharp('public/utang-batter-v8-strip.png')
    .extract({ left: 0, top: 0, width: 320, height: 288 })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (const variant of ['aluminum', 'gold', 'ruby', 'diamond']) {
    const colored = await sharp(`public/utang-batter-v8-${variant}-strip.png`)
      .extract({ left: 0, top: 0, width: 320, height: 288 })
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let changedGripPixels = 0;
    for (let y = 120; y < 174; y += 1) {
      for (let x = 94; x < 144; x += 1) {
        const offset = (y * 320 + x) * 4;
        const delta = Math.abs(base.data[offset] - colored.data[offset])
          + Math.abs(base.data[offset + 1] - colored.data[offset + 1])
          + Math.abs(base.data[offset + 2] - colored.data[offset + 2]);
        if (base.data[offset + 3] > 80 && delta > 35) changedGripPixels += 1;
      }
    }
    assert.ok(changedGripPixels > 80, `${variant} changed only ${changedGripPixels} grip pixels`);
  }
});

test('v1.1.3 bat icons and animation assets preserve real transparency', async () => {
  for (const variant of variants) {
    for (const path of [
      `public/utang-bat-${variant}-v113.png`,
      `public/utang-batter-v8-${variant}-strip.png`,
      `public/utang-batter-v8-${variant}-follow.png`,
      `public/utang-pose-miss-v093-${variant}.png`,
    ]) {
      const metadata = await sharp(path).metadata();
      const stats = await sharp(path).stats();
      assert.equal(metadata.hasAlpha, true, path);
      assert.equal(stats.isOpaque, false, path);
    }
  }
});

test('new swing strips keep the approved eight-frame geometry', async () => {
  for (const variant of variants) {
    const metadata = await sharp(`public/utang-batter-v8-${variant}-strip.png`).metadata();
    assert.deepEqual([metadata.width, metadata.height], [2560, 288]);
  }
});
