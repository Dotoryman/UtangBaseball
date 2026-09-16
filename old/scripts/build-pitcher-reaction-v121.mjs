import sharp from 'sharp';

const clear = { r: 0, g: 0, b: 0, alpha: 0 };
const source = 'assets/source/utang-pitcher-follow-v121-source.png';
const reactionOutput = 'public/utang-pitcher-follow-v4.png';
const stripOutput = 'public/utang-pitcher-v121-strip.png';

const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const background = new Uint8Array(info.width * info.height);
const queue = [];
const isCheckerboard = (point) => {
  const offset = point * 4;
  const r = data[offset]; const g = data[offset + 1]; const b = data[offset + 2];
  return Math.min(r, g, b) > 135 && Math.max(r, g, b) - Math.min(r, g, b) < 18;
};
const add = (point) => {
  if (!background[point] && isCheckerboard(point)) {
    background[point] = 1;
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
  const x = point % info.width; const y = Math.floor(point / info.width);
  if (x) add(point - 1);
  if (x + 1 < info.width) add(point + 1);
  if (y) add(point - info.width);
  if (y + 1 < info.height) add(point + info.width);
}
for (let point = 0; point < background.length; point += 1) {
  if (background[point]) data[point * 4 + 3] = 0;
}

const cutout = await sharp(data, { raw: info })
  .trim({ background: clear })
  .resize(496, 496, { fit: 'contain', background: clear })
  .png()
  .toBuffer();
const uniformUnderlay = Buffer.from(`<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <path d="M177 317 L185 291 C218 273 258 257 292 254
    C316 256 328 270 334 296 L360 322
    C304 340 245 370 189 397 L168 329 Z" fill="#fffdf7"/>
  <path d="M113 291 C134 299 155 309 177 317 L168 329 L105 307 Z"
    fill="#fffdf7" stroke="#0b0908" stroke-width="6" stroke-linejoin="round"/>
  <path d="M300 205 L330 205 L333 278 L302 278 Z"
    fill="#fffdf7" stroke="#0b0908" stroke-width="6" stroke-linejoin="round"/>
</svg>`);
await sharp({ create: { width: 512, height: 512, channels: 4, background: clear } })
  .composite([{ input: uniformUnderlay }, { input: cutout, gravity: 'centre' }])
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

const metadata = await sharp(reactionOutput).metadata();
if (!metadata.hasAlpha) throw new Error('Pitcher reaction must keep a transparent outer background.');
console.log(`Built ${reactionOutput} and ${stripOutput} with complete opaque pants.`);
