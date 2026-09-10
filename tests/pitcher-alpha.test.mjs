import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const css = await readFile(new URL('../app/v081.css', import.meta.url), 'utf8');
const reactionAsset = fileURLToPath(new URL('../public/utang-pitcher-follow-v3.png', import.meta.url));
const stripAsset = fileURLToPath(new URL('../public/utang-pitcher-v120-strip.png', import.meta.url));

test('pitcher uses the cache-busted strip with the repaired reaction frame', async () => {
  assert.match(css, /url\('\/utang-pitcher-v120-strip\.png'\)/);
  const metadata = await sharp(stripAsset).metadata();
  assert.equal(metadata.width, 1536);
  assert.equal(metadata.height, 512);
  assert.equal(metadata.hasAlpha, true);
});

test('pitcher reaction uniform remains opaque after contact', async () => {
  const { data, info } = await sharp(reactionAsset).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (const [x, y] of [[200, 395], [220, 430], [230, 455], [211, 475], [350, 350], [400, 365], [455, 380]]) {
    const alpha = data[(y * info.width + x) * info.channels + 3];
    assert.ok(alpha >= 245, `uniform alpha at ${x},${y} was ${alpha}`);
  }
});
