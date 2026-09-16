import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import sharp from 'sharp';

const missAssets = [
  'public/utang-pose-miss-v121.png',
  ...['aluminum', 'gold', 'ruby', 'diamond'].map(
    (bat) => `public/utang-pose-miss-v121-${bat}.png`,
  ),
];

async function opaqueRatio(path, box) {
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let visible = 0;
  let opaque = 0;
  for (let y = box.top; y < Math.min(box.bottom, info.height); y += 1) {
    for (let x = box.left; x < Math.min(box.right, info.width); x += 1) {
      const alpha = data[(y * info.width + x) * 4 + 3];
      if (alpha > 12) {
        visible += 1;
        if (alpha > 245) opaque += 1;
      }
    }
  }
  return opaque / visible;
}

test('miss poses keep the dropped bat and lower body visibly opaque', async () => {
  for (const path of missAssets) {
    assert.ok(
      (await opaqueRatio(path, {
        left: 0,
        top: 430,
        right: 310,
        bottom: 588,
      })) > 0.96,
      `${path} bat`,
    );
    assert.ok(
      (await opaqueRatio(path, {
        left: 220,
        top: 360,
        right: 525,
        bottom: 588,
      })) > 0.96,
      `${path} lower body`,
    );
  }
});

test('hand-drawn stadium and umpire assets have production geometry', async () => {
  const stadium = await sharp('public/utang-stadium-v124.webp').metadata();
  const umpire = await sharp('public/utang-umpire-v121-strip.png').metadata();
  assert.deepEqual([stadium.width, stadium.height], [864, 1536]);
  assert.deepEqual(
    [umpire.width, umpire.height, umpire.hasAlpha],
    [1152, 384, true],
  );
});

test('runtime references the v1.2.4 field hotfix art', () => {
  const page = fs.readFileSync('app/page.tsx', 'utf8');
  const css = fs.readFileSync('app/styles/game-hud.css', 'utf8');
  assert.match(page, /utang-stadium-v124\.webp/);
  assert.match(page, /utang-pose-miss-v121/);
  assert.match(css, /utang-umpire-v121-strip\.png/);
  assert.doesNotMatch(page, /utang-stadium-v121\.webp/);
  assert.doesNotMatch(css, /utang-umpire-v091-strip\.png/);
});
