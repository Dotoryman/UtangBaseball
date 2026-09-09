import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';

const variants = ['aluminum', 'ruby'];

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
