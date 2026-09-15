import sharp from 'sharp';

const clear = { r: 0, g: 0, b: 0, alpha: 0 };

await sharp('assets/source/utang-stadium-v124-source.png')
  .resize(864, 1536, { fit: 'fill' })
  .webp({ quality: 91 })
  .toFile('public/utang-stadium-v124.webp');

const source = 'assets/source/utang-pitcher-follow-v124-source.png';
const reactionOutput = 'public/utang-pitcher-follow-v7.png';
const stripOutput = 'public/utang-pitcher-v124-strip.png';
const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

// Remove the generated checkerboard from the outside only. The continuous
// rough black brush line protects every interior white uniform detail.
const outside = new Uint8Array(info.width * info.height);
const queue = [];
const isBackdrop = (point) => {
  const offset = point * 4;
  const r = data[offset]; const g = data[offset + 1]; const b = data[offset + 2];
  return Math.max(r, g, b) - Math.min(r, g, b) < 26 && Math.min(r, g, b) > 104;
};
const add = (point) => {
  if (!outside[point] && isBackdrop(point)) {
    outside[point] = 1;
    queue.push(point);
  }
};
for (let x = 0; x < info.width; x += 1) {
  add(x);
  add((info.height - 1) * info.width + x);
}
for (let y = 0; y < info.height; y += 1) {
  add(y * info.width);
  add(y * info.width + info.width - 1);
}
while (queue.length) {
  const point = queue.pop();
  const x = point % info.width;
  const y = Math.floor(point / info.width);
  if (x) add(point - 1);
  if (x + 1 < info.width) add(point + 1);
  if (y) add(point - info.width);
  if (y + 1 < info.height) add(point + info.width);
}
for (let point = 0; point < outside.length; point += 1) {
  data[point * 4 + 3] = outside[point] ? 0 : 255;
}

const cutout = await sharp(data, { raw: info })
  .trim({ background: clear })
  .resize(496, 496, { fit: 'contain', background: clear })
  .png()
  .toBuffer();
const padded = await sharp({ create: { width: 512, height: 512, channels: 4, background: clear } })
  .composite([{ input: cutout, gravity: 'centre' }])
  .raw()
  .toBuffer({ resolveWithObject: true });
for (let offset = 3; offset < padded.data.length; offset += 4) {
  padded.data[offset] = padded.data[offset] < 128 ? 0 : 255;
}
await sharp(padded.data, { raw: padded.info })
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

console.log('Built v1.2.4 field and pitcher hotfix assets.');
