import sharp from 'sharp';

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
const batterFrames = [
  'ready',
  'load',
  'stride',
  'start',
  'mid',
  'contact',
  'extension',
  'follow',
];

async function buildStrip(sources, output, frameWidth, frameHeight) {
  const layers = await Promise.all(
    sources.map(async (source, index) => ({
      input: await sharp(source)
        .resize(frameWidth, frameHeight, {
          fit: 'contain',
          background: transparent,
        })
        .png()
        .toBuffer(),
      left: frameWidth * index,
      top: 0,
    })),
  );
  return sharp({
    create: {
      width: frameWidth * sources.length,
      height: frameHeight,
      channels: 4,
      background: transparent,
    },
  })
    .composite(layers)
    .png({ compressionLevel: 9 })
    .toFile(output);
}

const batterSources = batterFrames.map(
  (frame) =>
    `${frame === 'follow' ? 'public' : 'old/public'}/utang-batter-v8-${frame}.png`,
);
await buildStrip(batterSources, 'public/utang-batter-v8-strip.png', 320, 288);
const batterWebp = sharp('public/utang-batter-v8-strip.png')
  .webp({ lossless: true, effort: 6 })
  .toFile('public/utang-batter-v8-strip.webp');

await Promise.all([
  batterWebp,
  buildStrip(
    [
      'public/utang-pitcher-authentic.png',
      'public/utang-pitcher-follow-v2.png',
    ],
    'public/utang-pitcher-v6-strip.png',
    512,
    512,
  ),
  buildStrip(
    ['public/utang-catcher-authentic.png', 'public/utang-catcher-catch-v4.png'],
    'public/utang-catcher-v6-strip.png',
    512,
    512,
  ),
]);

console.log('Built current base character sprites.');
