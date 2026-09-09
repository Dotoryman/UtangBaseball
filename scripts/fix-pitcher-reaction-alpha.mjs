import sharp from 'sharp';

const frameSize = 512;
const reactionSource = 'public/utang-pitcher-follow-authentic.png';
const reactionOutput = 'public/utang-pitcher-follow-v3.png';
const stripOutput = 'public/utang-pitcher-v111-strip.png';

// The original drawing intentionally left the uniform interior transparent.
// Keep every original ink pixel and place a solid uniform layer underneath it.
const uniformUnderlay = Buffer.from(`
  <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
    <path d="M151 300
      C211 297 287 294 352 316
      C397 331 438 350 475 358
      L468 384
      C425 379 385 363 350 360
      C319 376 281 423 239 482
      L205 484
      C209 440 197 394 169 351
      Z" fill="#fffdf7"/>
    <path d="M205 411
      C220 426 229 448 230 475
      L211 478
      C214 452 209 430 198 414
      Z" fill="#e7edf4" opacity=".88"/>
    <path d="M349 351
      C388 355 426 371 463 376
      L455 382
      C416 376 381 365 350 362
      Z" fill="#e7edf4" opacity=".72"/>
  </svg>
`);

await sharp({
  create: {
    width: frameSize,
    height: frameSize,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([{ input: uniformUnderlay }, { input: reactionSource }])
  .png({ compressionLevel: 9 })
  .toFile(reactionOutput);

const frameSources = [
  'public/utang-pitcher-authentic.png',
  reactionOutput,
  'public/utang-pitcher-release-v090.png',
];
const frames = await Promise.all(frameSources.map(async (source, index) => ({
  input: await sharp(source)
    .resize(frameSize, frameSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer(),
  left: index * frameSize,
  top: 0,
})));

await sharp({
  create: {
    width: frameSize * frameSources.length,
    height: frameSize,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(frames)
  .png({ compressionLevel: 9 })
  .toFile(stripOutput);

const { data, info } = await sharp(reactionOutput).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const opaqueSamples = [
  [220, 430],
  [230, 455],
  [350, 350],
  [400, 365],
];
for (const [x, y] of opaqueSamples) {
  const alpha = data[(y * info.width + x) * info.channels + 3];
  if (alpha < 245) throw new Error(`Pitcher uniform alpha regression at ${x},${y}: ${alpha}`);
}

console.log(`Built ${reactionOutput} and ${stripOutput}; uniform alpha samples are opaque.`);
