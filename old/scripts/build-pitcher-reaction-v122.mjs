import sharp from 'sharp';

const clear = { r: 0, g: 0, b: 0, alpha: 0 };
const reactionOutput = 'public/utang-pitcher-follow-v5.png';
const stripOutput = 'public/utang-pitcher-v122-strip.png';

// Keep the approved upper body pixel-for-pixel. Only the repaired pants slice
// is taken from the closed-outline edit, avoiding any new transparency above
// the waist or any change to the face and jersey.
const pantsTop = 320;
const pantsPatch = await sharp('public/utang-pitcher-follow-v4.png')
  .extract({ left: 0, top: pantsTop, width: 512, height: 512 - pantsTop })
  .png()
  .toBuffer();

await sharp('public/utang-pitcher-follow-v3.png')
  .composite([{ input: pantsPatch, left: 0, top: pantsTop }])
  .png({ compressionLevel: 9 })
  .toFile(reactionOutput);

const frameSources = [
  'public/utang-pitcher-authentic.png',
  reactionOutput,
  'public/utang-pitcher-release-v090.png',
];
const frames = await Promise.all(frameSources.map(async (path, index) => ({
  input: await sharp(path).resize(512, 512, { fit: 'contain', background: clear }).png().toBuffer(),
  left: index * 512,
  top: 0,
})));
await sharp({ create: { width: 1536, height: 512, channels: 4, background: clear } })
  .composite(frames)
  .png({ compressionLevel: 9 })
  .toFile(stripOutput);

console.log(`Built ${reactionOutput} and ${stripOutput} with a closed pants silhouette.`);
