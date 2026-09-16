import sharp from 'sharp';
const clear = { r: 0, g: 0, b: 0, alpha: 0 };
// Only border-connected background was removed; enclosed white clothing stays opaque.
for (const name of ['pitcher-release', 'umpire']) {
  const path = `public/utang-${name}-v090.png`;
  const image = await sharp(path).trim().resize(512, 512, { fit: 'contain', background: clear }).png().toBuffer();
  await sharp(image).toFile(path);
}
const sources = ['public/utang-pitcher-authentic.png', 'public/utang-pitcher-follow-v2.png', 'public/utang-pitcher-release-v090.png'];
const layers = await Promise.all(sources.map(async (path, index) => ({ input: await sharp(path).resize(512, 512, { fit: 'contain', background: clear }).png().toBuffer(), left: index * 512, top: 0 })));
await sharp({ create: { width: 1536, height: 512, channels: 4, background: clear } }).composite(layers).png().toFile('public/utang-pitcher-v090-strip.png');
