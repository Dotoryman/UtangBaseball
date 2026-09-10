import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const css = await readFile(new URL('../app/v081.css', import.meta.url), 'utf8');
const reactionAsset = fileURLToPath(new URL('../public/utang-pitcher-follow-v5.png', import.meta.url));
const stripAsset = fileURLToPath(new URL('../public/utang-pitcher-v122-strip.png', import.meta.url));

test('pitcher uses the cache-busted strip with the repaired reaction frame', async () => {
  assert.match(css, /url\('\/utang-pitcher-v122-strip\.png'\)/);
  const metadata = await sharp(stripAsset).metadata();
  assert.equal(metadata.width, 1536);
  assert.equal(metadata.height, 512);
  assert.equal(metadata.hasAlpha, true);
});

test('pitcher reaction uses a full opaque pants silhouette without an interior hole', async () => {
  const { data, info } = await sharp(reactionAsset).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (const [x, y] of [[205, 350], [250, 390], [290, 390], [330, 370], [390, 350], [230, 430], [230, 470]]) {
    const alpha = data[(y * info.width + x) * info.channels + 3];
    assert.ok(alpha >= 245, `pants alpha at ${x},${y} was ${alpha}`);
  }
});
