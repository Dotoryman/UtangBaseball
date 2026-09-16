import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const css = await readFile(
  new URL('../app/styles/game-hud.css', import.meta.url),
  'utf8',
);
const reactionAsset = fileURLToPath(
  new URL('../public/utang-pitcher-follow-v7.png', import.meta.url),
);
const stripAsset = fileURLToPath(
  new URL('../public/utang-pitcher-v124-strip.png', import.meta.url),
);

test('pitcher uses the cache-busted strip with the repaired reaction frame', async () => {
  assert.match(css, /url\('\/utang-pitcher-v124-strip\.png'\)/);
  const metadata = await sharp(stripAsset).metadata();
  assert.equal(metadata.width, 1536);
  assert.equal(metadata.height, 512);
  assert.equal(metadata.hasAlpha, true);
});

test('new pitcher reaction keeps a binary transparent edge without ghost pixels', async () => {
  const { data, info } = await sharp(reactionAsset)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let visible = 0;
  for (let offset = 3; offset < data.length; offset += info.channels) {
    assert.ok(
      data[offset] === 0 || data[offset] === 255,
      `semi-transparent alpha ${data[offset]}`,
    );
    if (data[offset] === 255) visible += 1;
  }
  assert.ok(
    visible > 75_000,
    `unexpectedly small pitcher silhouette: ${visible}`,
  );
});
