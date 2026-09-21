import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import sharp from 'sharp';

const variants = ['aluminum', 'gold', 'ruby', 'diamond'];

test('uniform foul pose ships with every earned bat color', async () => {
  const files = [
    'public/utang-pose-foul-uniform.png',
    ...variants.map((bat) => `public/utang-pose-foul-uniform-${bat}.png`),
  ];
  for (const file of files) {
    const metadata = await sharp(file).metadata();
    assert.equal(metadata.width, 512, file);
    assert.equal(metadata.height, 512, file);
    assert.equal(metadata.hasAlpha, true, file);
  }
});

test('foul reaction selects the currently equipped bat without a wood fallback', async () => {
  const page = await readFile('app/page.tsx', 'utf8');
  const ui = await readFile('lib/game-ui.ts', 'utf8');
  assert.match(page, /function foulPoseForBat\(bat: BatType\)/);
  assert.match(page, /foulPoseForBat\(activeBat\)/);
  assert.match(page, /utang-pose-foul-uniform-\$\{bat\}\.png/);
  assert.match(ui, /pose: '\/utang-pose-foul-uniform\.png'/);
});

test('every earned bat visibly changes the dropped bat pixels', async () => {
  const base = await sharp('public/utang-pose-foul-uniform.png')
    .extract({ left: 45, top: 366, width: 301, height: 104 })
    .raw()
    .toBuffer();
  for (const variant of variants) {
    const colored = await sharp(`public/utang-pose-foul-uniform-${variant}.png`)
      .extract({ left: 45, top: 366, width: 301, height: 104 })
      .raw()
      .toBuffer();
    let changed = 0;
    for (let index = 0; index < base.length; index += 4) {
      if (
        Math.abs(base[index] - colored[index]) +
          Math.abs(base[index + 1] - colored[index + 1]) +
          Math.abs(base[index + 2] - colored[index + 2]) >
        45
      ) {
        changed += 1;
      }
    }
    assert.ok(changed > 900, `${variant} only changed ${changed} bat pixels`);
  }
});
